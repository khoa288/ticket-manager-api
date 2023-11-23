const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let CounterSchema = new Schema({
	_id: String,
	seq: Number,
});

CounterSchema.statics.getNextSequence = async function (sequenceName) {
	const counter = await this.findByIdAndUpdate(
		{ _id: sequenceName },
		{ $inc: { seq: 1 } },
		{ upsert: true, new: true }
	);

	return counter.seq;
};

module.exports = mongoose.model("Counter", CounterSchema);
