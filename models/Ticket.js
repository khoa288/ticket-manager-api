const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let TicketSchema = new Schema(
	{
		name: { type: String, required: true },
		studentId: { type: String, required: true },
		email: {
			type: String,
			required: true,
			match: /^\S+@\S+\.\S+$/,
		},
		ticketNumber: { type: String, required: true, unique: true },
		isUsed: { type: Boolean, default: false },
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model("Ticket", TicketSchema);
