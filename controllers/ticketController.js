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

	let mail = `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ticket Email</title>
            <style>
                body {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                color: #333;
                }
                .header {
                background-color: #007BFF;
                padding: 20px;
                text-align: center;
                }
                .header h1 {
                color: #fff;
                margin-bottom: 0;
                font-size: 28px;			
                line-height :1.5em ;
                }
                .content {
                background-color:#f9f9f9 ;            
                padding-left :40px ;
                padding-right :40px ;
                padding-top :30px ;	    
                padding-bottom :30px ;
                }
                p{
                line-height :1.7em ;
                font-size :20px ;
                }
                img{
                width :100%;
                height:auto ;	     
                }        
                .ticket-info {                
                border-top :2px solid #007BFF ;		
                border-bottom :2px solid #007BFF ;		
                padding-top :15 px ;		
                padding-bottom :15 px ;
                text-align:center;	        
                font-size :24 px ;
                font-weight:bold;	
                margin-top :10 px ;
                margin-bottom :10 px ;	        
                }       
                a{
                color:#007BFF ;
                text-decoration:none ;
                font-size:16px;	   
                }
                a:hover{
                text-decoration :underline ;
                }
                .footer {                
                background-color:#f2f2f2 ;		
                padding-left:30 px ;		
                padding-right:30 px ;		
                padding-top:20 px ;		
                padding-bottom:20 px ;
                font-size :16 px ;	        
                }       
                .contact-info {
                display:flex;
                align-items:center;
                margin-bottom:5px;
                font-size:16px;
                }
                .contact-logo {
                width:16px;
                height:auto;
                margin-right:8px;
                }
                .ticket-number {
                font-size: 48px;
                font-weight: bold;
                color: #007BFF;            
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>WORKSHOP C.A.T</h1>
            </div>
            <div class="content">
                <p>Chào [name], [studentID]</p>
                <div class="ticket-info">
                    <p>Mã vé của bạn là:</p><br>
                    [ticketNumbers]
                </div>
                <p>Đội cảm ơn và hẹn gặp lại bạn tại workshop!</p>
                <img src="https://res.cloudinary.com/ddo8wsmdc/image/upload/v1700850580/q5lox73slzyzibhuecpu.jpg" alt="C.A.T logo">
            </div>
            <div class="footer">
                <p><strong>ĐỘI CỘNG TÁC VIÊN HỘI SINH VIÊN ĐẠI HỌC Y DƯỢC TP.HCM</strong></p>
                <div class="contact-info">
                    <img src="https://res.cloudinary.com/ddo8wsmdc/image/upload/v1700854864/whnir1idslsnxpgdevkq.png" alt="Address" class="contact-logo">
                    217 Hồng Bàng, Phường 11, Quận 5, TP.HCM
                </div>
                <div class="contact-info">
                    <img src="https://res.cloudinary.com/ddo8wsmdc/image/upload/v1700854864/x6dtyuugx55hlajr2y8o.png" alt="Facebook" class="contact-logo">
                    <a href="https://www.facebook.com/doictvhsvump" target="_blank">facebook.com/doictvhsvump</a>
                </div>
                <div class="contact-info">
                    <img src="https://res.cloudinary.com/ddo8wsmdc/image/upload/v1700854863/mhn5ifo9qmgnlidi97rx.png" alt="Email" class="contact-logo">
                    <a href="mailto:doictvhsv@gmail.com">doictvhsv@gmail.com</a>
                </div>
                <div class="contact-info">
                    <img src="https://res.cloudinary.com/ddo8wsmdc/image/upload/v1700854864/usqyopqlibrit54wd96f.png" alt="Contact" class="contact-logo">
                    Phạm Thị Hương - 0899919264
                </div>
            </div>
        </body>
    </html>
`;

	// Replace placeholders with actual data
	mail = mail.replace("[name]", name);
	mail = mail.replace("[studentID]", studentId);
	let formattedTicketNumbers = ticketNumbers
		.map((number) => `<span class='ticket-number'>${number}</span><br>`)
		.join("");
	mail = mail.replace("[ticketNumbers]", formattedTicketNumbers);

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
