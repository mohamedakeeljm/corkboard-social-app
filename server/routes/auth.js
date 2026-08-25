const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    bio: user.bio,
    avatarColor: user.avatar_color,
    createdAt: user.created_at,
  };
}

router.post("/register", (req, res) => {
  const { username, email, password, displayName } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "username, email and password are required" });
  }
  if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3-20 characters, letters/numbers/underscore only" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ? OR email = ?")
    .get(username, email);
  if (existing) {
    return res.status(409).json({ error: "Username or email already in use" });
  }

  const colors = ["#3B5BA9", "#C4622D", "#2F7A5C", "#8A4FA0", "#B8863B", "#4C6E9A"];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  const passwordHash = bcrypt.hashSync(password, 10);

  const info = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, display_name, avatar_color)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(username, email, passwordHash, displayName || username, avatarColor);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE username = ? OR email = ?")
    .get(username, username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: publicUser(user) });
});

module.exports = router;
