const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
	const token = req.cookies?.token;
	if (!token) return res.status(401).json({ error: "Unauthorized" });

	try {
		jwt.verify(token, process.env.JWT_SECRET, { expiresIn: "1h" });
		next();
	} catch (err) {
		return res.status(401).json({ error: "Unauthorized" });
	}
};
