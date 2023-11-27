const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

require("dotenv").config();
require("./config/db");

const authRoutes = require("./controllers/authController");
const ticketRoutes = require("./controllers/ticketController");

// Port.
const port = process.env.PORT || 3000;

// Initialize Express app.
const app = express();
app.use(express.json());
app.use(cookieParser());

app.options(
	"*",
	cors({
		credentials: true,
		origin: process.env.CLIENT_URL,
	})
);

app.use(
	cors({
		credentials: true,
		origin: process.env.CLIENT_URL,
	})
);

// Routes.
app.use("/auth", authRoutes);
app.use("/tickets", ticketRoutes);

// Default route for unmatched routes
app.all("*", (req, res) => {
	res.status(404).json({ message: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({ message: "Internal server error" });
});

module.exports = app;
