const mongoose = require("mongoose");

mongoose.set("strictQuery", true);
mongoose.set("debug", true); // 👈 This shows all MongoDB queries Mongoose runs

mongoose
	.connect(process.env.MONGODB_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(async () => {
		console.log("✅ Database connected");

		const dbName = mongoose.connection.name;
		console.log("📂 Connected to database:", dbName);

		const collections = await mongoose.connection.db
			.listCollections()
			.toArray();
		console.log(
			"📦 Collections in DB:",
			collections.map((c) => c.name)
		);
	})
	.catch((error) => {
		console.error("❌ MongoDB connection error:", error);
	});
