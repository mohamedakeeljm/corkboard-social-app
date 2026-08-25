const express = require("express");
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

function profileFor(row, viewerId) {
  const followerCount = db
    .prepare("SELECT COUNT(*) c FROM follows WHERE following_id = ?")
    .get(row.id).c;
  const followingCount = db
    .prepare("SELECT COUNT(*) c FROM follows WHERE follower_id = ?")
    .get(row.id).c;
  const postCount = db
    .prepare("SELECT COUNT(*) c FROM posts WHERE user_id = ?")
    .get(row.id).c;

  let isFollowing = false;
  if (viewerId) {
    isFollowing = !!db
      .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?")
      .get(viewerId, row.id);
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    followerCount,
    followingCount,
    postCount,
    isFollowing,
    isSelf: viewerId === row.id,
  };
}

// GET /api/users/:username - public profile
router.get("/:username", optionalAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(profileFor(user, req.userId));
});

// PATCH /api/users/me - update own profile
router.patch("/me/update", requireAuth, (req, res) => {
  const { displayName, bio } = req.body || {};
  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);

  db.prepare("UPDATE users SET display_name = ?, bio = ? WHERE id = ?").run(
    displayName !== undefined ? displayName : current.display_name,
    bio !== undefined ? bio : current.bio,
    req.userId
  );

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  res.json(profileFor(updated, req.userId));
});

// POST /api/users/:username/follow
router.post("/:username/follow", requireAuth, (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === req.userId) {
    return res.status(400).json({ error: "You can't follow yourself" });
  }

  db.prepare(
    "INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)"
  ).run(req.userId, target.id);

  res.json(profileFor(target, req.userId));
});

// DELETE /api/users/:username/follow
router.delete("/:username/follow", requireAuth, (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!target) return res.status(404).json({ error: "User not found" });

  db.prepare(
    "DELETE FROM follows WHERE follower_id = ? AND following_id = ?"
  ).run(req.userId, target.id);

  res.json(profileFor(target, req.userId));
});

// GET /api/users/:username/followers
router.get("/:username/followers", optionalAuth, (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!target) return res.status(404).json({ error: "User not found" });

  const rows = db
    .prepare(
      `SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? ORDER BY f.created_at DESC`
    )
    .all(target.id);

  res.json(rows.map((r) => profileFor(r, req.userId)));
});

// GET /api/users/:username/following
router.get("/:username/following", optionalAuth, (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!target) return res.status(404).json({ error: "User not found" });

  const rows = db
    .prepare(
      `SELECT u.* FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ? ORDER BY f.created_at DESC`
    )
    .all(target.id);

  res.json(rows.map((r) => profileFor(r, req.userId)));
});

module.exports = router;
