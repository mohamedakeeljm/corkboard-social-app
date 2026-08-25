const express = require("express");
const db = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

function serializeComment(row, viewerId) {
  return {
    id: row.id,
    postId: row.post_id,
    content: row.content,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarColor: row.avatar_color,
    },
    isOwn: viewerId === row.user_id,
  };
}

const COMMENT_JOIN = `
  SELECT comments.*, users.username, users.display_name, users.avatar_color
  FROM comments JOIN users ON users.id = comments.user_id
`;

// GET /api/posts/:postId/comments
router.get("/:postId/comments", optionalAuth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const rows = db
    .prepare(`${COMMENT_JOIN} WHERE comments.post_id = ? ORDER BY comments.created_at ASC`)
    .all(req.params.postId);

  res.json(rows.map((r) => serializeComment(r, req.userId)));
});

// POST /api/posts/:postId/comments
router.post("/:postId/comments", requireAuth, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const { content } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Comment can't be empty" });
  }
  if (content.length > 1000) {
    return res.status(400).json({ error: "Comment is too long (max 1000 characters)" });
  }

  const info = db
    .prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
    .run(req.params.postId, req.userId, content.trim());

  const row = db.prepare(`${COMMENT_JOIN} WHERE comments.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(serializeComment(row, req.userId));
});

// DELETE /api/posts/:postId/comments/:commentId
router.delete("/:postId/comments/:commentId", requireAuth, (req, res) => {
  const comment = db
    .prepare("SELECT * FROM comments WHERE id = ? AND post_id = ?")
    .get(req.params.commentId, req.params.postId);
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.user_id !== req.userId) {
    return res.status(403).json({ error: "You can only delete your own comments" });
  }

  db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.commentId);
  res.status(204).end();
});

module.exports = router;
