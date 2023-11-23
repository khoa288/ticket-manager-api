const router = require("express").Router();
const Excel = require("exceljs");
const authMiddleware = require("../middleware/authMiddleware");
const nodemailer = require("nodemailer");
const Ticket = require("../models/Ticket");
const Counter = require("../models/Counter");

const transporterConfig = require("../config/mail").transporterConfig;
const transporter = nodemailer.createTransport(transporterConfig);

router.post("/sendTicket", authMiddleware.verifyToken, async (req, res) => {
	const { name, email, studentId, amount } = req.body;

	// Generate unique 4-digit ticket numbers
	const ticketNumbers = [];
	for (let i = 0; i < amount; i++) {
		const ticketNumber = await Counter.getNextSequence("ticket");
		ticketNumbers.push(ticketNumber.toString().padStart(4, "0"));
	}

	let mail = ""; // Just leave it here

	let message = {
		from: process.env.EMAIL_ADDRESS,
		to: email,
		subject: "[ĐỘI CTV HSV] VÉ THAM GIA WORKSHOP C.A.T",
		html: mail,
	};

	try {
		await transporter.sendMail(message);

		// Save the ticket information to MongoDB
		const tickets = ticketNumbers.map((ticketNumber) => ({
			name,
			studentId,
			email,
			ticketNumber,
		}));

		await Ticket.insertMany(tickets);

		return res.status(201).json({ message: "Email sent" });
	} catch (error) {
		return res.status(500).json({ error });
	}
});

router.get(
	"/searchTickets/:studentId",
	authMiddleware.verifyToken,
	async (req, res) => {
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
	}
);

router.get(
	"/ticketInfo/:ticketNumber",
	authMiddleware.verifyToken,
	async (req, res) => {
		try {
			const ticket = await Ticket.findOne({
				ticketNumber: req.params.ticketNumber,
			});

			if (!ticket) {
				return res.status(404).json({ message: "Ticket not found" });
			}

			return res.status(200).json(ticket);
		} catch (error) {
			return res.status(500).json({ error });
		}
	}
);

router.put(
	"/useTicket/:ticketNumber",
	authMiddleware.verifyToken,
	async (req, res) => {
		try {
			const ticket = await Ticket.findOneAndUpdate(
				{ ticketNumber: req.params.ticketNumber },
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
	}
);

router.get("/ticketStats", authMiddleware.verifyToken, async (req, res) => {
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

router.get("/exportTickets", authMiddleware.verifyToken, async (req, res) => {
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
			{ header: "Ticket Number", key: "ticketNumber" },
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

module.exports = router;
