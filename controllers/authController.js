const router = require("express").Router();
const jwt = require("jsonwebtoken");

// Get JWT secret.
const jwtSecret = process.env.JWT_SECRET;

router.post("/login", async (req, res) => {
	const { secret } = req.body;
	if (secret === process.env.ADMIN_PASSWORD) {
		try {
			const token = await new Promise((resolve, reject) => {
				jwt.sign(
					{ userId: "admin" },
					jwtSecret,
					{ expiresIn: "1h" },
					(err, token) => {
						if (err) reject(err);
						resolve(token);
					}
				);
			});

			res.cookie("token", token, {
				sameSite: "none",
				secure: true,
			}).json({ token: token });
		} catch (error) {
			res.status(500).json({ error });
		}
	} else {
		res.status(401).json({ error: "Unauthorized" });
	}
});

router.get("/check", async (req, res) => {
	const token = req.cookies?.token;
	if (!token) return res.status(401).json({ error: "Unauthorized" });

	try {
		const userData = await new Promise((resolve, reject) => {
			jwt.verify(
				token,
				jwtSecret,
				{ expiresIn: "1h" },
				(err, userData) => {
					if (err) reject(err);
					resolve(userData);
				}
			);
		});

		res.json(userData);
	} catch (error) {
		res.status(401).json({ error: "Unauthorized" });
	}
});

router.post("/logout", (_, res) => {
	res.cookie("token", "", { sameSite: "none", secure: true }).json();
});

module.exports = router;
