const express = require("express");
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

function serializePost(row, viewerId) {
  const likeCount = db
    .prepare("SELECT COUNT(*) c FROM likes WHERE post_id = ?")
    .get(row.id).c;
  const commentCount = db
    .prepare("SELECT COUNT(*) c FROM comments WHERE post_id = ?")
    .get(row.id).c;
  const liked = viewerId
    ? !!db.prepare("SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?").get(row.id, viewerId)
    : false;

  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarColor: row.avatar_color,
    },
    likeCount,
    commentCount,
    likedByViewer: liked,
    isOwn: viewerId === row.user_id,
  };
}

const POST_JOIN = `
  SELECT posts.*, users.username, users.display_name, users.avatar_color
  FROM posts JOIN users ON users.id = posts.user_id
`;

// GET /api/posts/feed?scope=all|following
router.get("/feed", optionalAuth, (req, res) => {
  const scope = req.query.scope === "following" ? "following" : "all";

  let rows;
  if (scope === "following" && req.userId) {
    rows = db
      .prepare(
        `${POST_JOIN}
         WHERE posts.user_id IN (
           SELECT following_id FROM follows WHERE follower_id = ?
         ) OR posts.user_id = ?
         ORDER BY posts.created_at DESC LIMIT 100`
      )
      .all(req.userId, req.userId);
  } else {
    rows = db.prepare(`${POST_JOIN} ORDER BY posts.created_at DESC LIMIT 100`).all();
  }

  res.json(rows.map((r) => serializePost(r, req.userId)));
});

// GET /api/posts/user/:username
router.get("/user/:username", optionalAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });

  const rows = db
    .prepare(`${POST_JOIN} WHERE posts.user_id = ? ORDER BY posts.created_at DESC`)
    .all(user.id);

  res.json(rows.map((r) => serializePost(r, req.userId)));
});

// GET /api/posts/:id
router.get("/:id", optionalAuth, (req, res) => {
  const row = db.prepare(`${POST_JOIN} WHERE posts.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Post not found" });
  res.json(serializePost(row, req.userId));
});

// POST /api/posts
router.post("/", requireAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Post content can't be empty" });
  }
  if (content.length > 2000) {
    return res.status(400).json({ error: "Post is too long (max 2000 characters)" });
  }

  const info = db
    .prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)")
    .run(req.userId, content.trim());

  const row = db.prepare(`${POST_JOIN} WHERE posts.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(serializePost(row, req.userId));
});

// DELETE /api/posts/:id
router.delete("/:id", requireAuth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.user_id !== req.userId) {
    return res.status(403).json({ error: "You can only delete your own posts" });
  }

  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// POST /api/posts/:id/like
router.post("/:id/like", requireAuth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  db.prepare("INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?, ?)").run(
    req.userId,
    req.params.id
  );

  const row = db.prepare(`${POST_JOIN} WHERE posts.id = ?`).get(req.params.id);
  res.json(serializePost(row, req.userId));
});

// DELETE /api/posts/:id/like
router.delete("/:id/like", requireAuth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  db.prepare("DELETE FROM likes WHERE user_id = ? AND post_id = ?").run(
    req.userId,
    req.params.id
  );

  const row = db.prepare(`${POST_JOIN} WHERE posts.id = ?`).get(req.params.id);
  res.json(serializePost(row, req.userId));
});

module.exports = router;
