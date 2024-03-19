const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let TicketInfoSchema = new Schema({
	ticketId: { type: String, required: true },
	ticketSecret: { type: String, required: true },
});

module.exports = mongoose.model("TicketInfo", TicketInfoSchema);
