const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Faltan usuario y/o contraseña." });
  }

  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  }

  const token = jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
}

module.exports = { login };
