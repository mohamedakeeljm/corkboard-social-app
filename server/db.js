const path = require("path");
const os = require("os");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const dbPath = process.env.VERCEL
  ? path.join(os.tmpdir(), "social.db")
  : path.join(__dirname, "social.db");

const db = new DatabaseSync(dbPath);
try {
  db.exec("PRAGMA journal_mode = WAL");
} catch (e) {
  try {
    db.exec("PRAGMA journal_mode = DELETE");
  } catch (err) {}
}
db.exec("PRAGMA foreign_keys = ON");

// ---------- Schema ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    bio           TEXT DEFAULT '',
    avatar_color  TEXT DEFAULT '#3B5BA9',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at  TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
  );

  CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
`);

module.exports = db;
