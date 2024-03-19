const router = require("express").Router();
const Excel = require("exceljs");
const authMiddleware = require("../middleware/authMiddleware");
const nodemailer = require("nodemailer");
const Ticket = require("../models/Ticket");
const TicketInfo = require("../models/TicketInfo");
const mail = require("../resource/mailContent");

const multer = require("multer");
const csvParser = require("csv-parser");
const { Readable } = require("stream");

const transporterConfig = require("../config/mail").transporterConfig;
const transporter = nodemailer.createTransport(transporterConfig);

router.post("/sendTicket", async (req, res) => {
	try {
		const ticketInfo = await TicketInfo.findOneAndDelete({});
		if (!ticketInfo) {
			throw new Error("No more tickets available.");
		}
		const { name, email, studentId } = req.body;

		let mailContent = mail;

		// Replace placeholders with actual data
		mailContent = mailContent.replace("[name]", name);
		mailContent = mailContent.replace("[ticketId]", ticketInfo.ticketId);
		mailContent = mailContent.replace(
			"[ticketSecret]",
			ticketInfo.ticketSecret
		);

		let message = {
			from: process.env.EMAIL_ADDRESS,
			to: email,
			subject: "VÉ HÀNH TRÌNH THỦ LĨNH SINH VIÊN",
			html: mailContent,
		};
		await transporter.sendMail(message);

		// Save the ticket information to MongoDB
		const newTicket = new Ticket({
			name: name,
			studentId: studentId,
			email: email,
			ticketId: ticketInfo.ticketId,
			ticketSecret: ticketInfo.ticketSecret,
		});

		await newTicket.save();

		return res.status(201).json({ message: "Email sent" });
	} catch (error) {
		return res.status(500).json({ error });
	}
});

router.get("/searchTickets/:studentId", async (req, res) => {
	const { studentId } = req.params;

	try {
		const tickets = await Ticket.find({ studentId });

		if (!tickets || tickets.length === 0) {
			return res.status(404).json({
				message: "No tickets found for this student ID.",
			});
		}

		return res.status(200).json(tickets);
	} catch (error) {
		return res.status(500).json({ error });
	}
});

router.get("/ticketInfo/:ticketNumber", async (req, res) => {
	try {
		const ticket = await Ticket.findOne({
			ticketId: req.params.ticketId,
		});

		if (!ticket) {
			return res.status(404).json({ message: "Ticket not found" });
		}

		return res.status(200).json(ticket);
	} catch (error) {
		return res.status(500).json({ error });
	}
});

router.put("/useTicket/:ticketNumber", async (req, res) => {
	try {
		const ticket = await Ticket.findOneAndUpdate(
			{ ticketId: req.params.ticketId },
			{ isUsed: true },
			{ new: true }
		);

		if (!ticket) {
			return res.status(404).json({ message: "Ticket not found" });
		}

		return res.status(200).json(ticket);
	} catch (error) {
		return res.status(500).json({ error });
	}
});

router.get("/ticketStats", async (req, res) => {
	try {
		const totalTickets = await Ticket.countDocuments();
		const usedTickets = await Ticket.countDocuments({ isUsed: true });

		return res.status(200).json({
			totalTickets,
			usedTickets,
			unusedTickets: totalTickets - usedTickets,
		});
	} catch (error) {
		return res.status(500).json({ error });
	}
});

router.get("/exportTickets", async (req, res) => {
	const { startDate, endDate } = req.query;

	// Convert dates to ISO format.
	const start = new Date(startDate);
	start.setHours(0, 0, 0, 0);
	// Subtract seven hours for GMT+7
	start.setTime(start.getTime() - 7 * 60 ** 2 * 1000);

	const end = new Date(endDate);
	end.setHours(23, 59, 59, 999);
	//Subtract seven hours for GMT+7
	end.setTime(end.getTime() - 7 * 60 ** 2 * 1000);

	let query;
	if (startDate && endDate) {
		query = {
			createdAt: { $gte: start.toISOString(), $lte: end.toISOString() },
		};
	}

	try {
		const tickets = await Ticket.find(query).lean();

		// Create a new workbook and add a worksheet.
		const workbook = new Excel.Workbook();
		const worksheet = workbook.addWorksheet("Tickets");

		// Add column headers.
		worksheet.columns = [
			{ header: "Name", key: "name" },
			{ header: "Student ID", key: "studentId" },
			{ header: "Email", key: "email" },
			{ header: "Ticket ID", key: "ticketId" },
			{ header: "Ticket Secret", key: "ticketSecret" },
			{ header: "Is Used", key: "isUsed" },
			{ header: "Sold At", key: "createdAt" },
			{ header: "Used At", key: "updatedAt" },
		];

		// Add rows with ticket data.
		tickets.forEach((ticket) => {
			ticket.createdAt = new Date(ticket.createdAt).toLocaleString(
				"en-US",
				{
					timeZone: "Asia/Ho_Chi_Minh",
					hour12: false,
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				}
			);
			worksheet.addRow(ticket);
		});

		// Set the file name.
		const fileName = `tickets_${new Date().toISOString()}.xlsx`;

		// Send the Excel file as a response.
		res.setHeader(
			"Content-Disposition",
			`attachment; filename=${fileName}`
		);
		res.setHeader(
			"Content-Type",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		);

		workbook.xlsx.write(res).then(() => {
			res.status(200).end();
		});
	} catch (error) {
		return res.status(500).json({ error });
	}
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/sendTicketFile", upload.single("file"), async (req, res) => {
	if (!req.file) {
		return res.status(400).json({ error: "No file provided." });
	}

	try {
		const readableStream = new Readable();
		readableStream.push(req.file.buffer);
		readableStream.push(null);

		const results = [];
		readableStream
			.pipe(csvParser({ separator: ";" })) // Use semicolon as delimiter
			.on("data", (data) => results.push(data))
			.on("end", async () => {
				for (let i = 0; i < results.length; i++) {
					const student = results[i];
					try {
						const ticketInfo = await TicketInfo.findOneAndDelete(
							{}
						);
						if (!ticketInfo) {
							throw new Error("No more tickets available.");
						}

						let mailContent = mail;
						mailContent = mailContent.replace(
							"[name]",
							student.name
						);
						mailContent = mailContent.replace(
							"[ticketId]",
							ticketInfo.ticketId
						);
						mailContent = mailContent.replace(
							"[ticketSecret]",
							ticketInfo.ticketSecret
						);

						let message = {
							from: process.env.EMAIL_ADDRESS,
							to: student.email,
							subject: "VÉ HÀNH TRÌNH THỦ LĨNH SINH VIÊN",
							html: mailContent,
						};

						await transporter.sendMail(message);

						const newTicket = new Ticket({
							name: student.name,
							studentId: student.studentId,
							email: student.email,
							ticketId: ticketInfo.ticketId,
							ticketSecret: ticketInfo.ticketSecret,
						});

						await newTicket.save();
					} catch (error) {
						console.error(
							`Failed to send email to ${student.email}: ${error}`
						);
					}
				}
				return res.status(201).json({ message: "Emails sent" });
			});
	} catch (error) {
		return res.status(500).json({ error });
	}
});
module.exports = router;
