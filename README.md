# Corkboard — a mini social media app

A small full-stack social app: profiles, posts, comments, likes, and follows.

- **Backend:** Node.js + Express + SQLite (via `better-sqlite3`), JWT auth
- **Frontend:** Plain HTML / CSS / JavaScript (no build step, no framework)
- **Database:** SQLite file, created automatically on first run (`server/social.db`)

## Project structure

```
social-app/
└── server/
    ├── server.js              # Express app entry point
    ├── db.js                  # SQLite schema (users, posts, comments, likes, follows)
    ├── middleware/auth.js     # JWT auth middleware
    ├── routes/
    │   ├── auth.js            # POST /api/auth/register, /api/auth/login
    │   ├── users.js           # profiles, follow/unfollow, followers/following
    │   ├── posts.js           # create/read/delete posts, feed, likes
    │   └── comments.js        # comments on posts
    ├── public/                # the frontend (served as static files)
    │   ├── index.html
    │   ├── css/style.css
    │   └── js/app.js
    ├── package.json
    └── .env.example
```

## Setup

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
cd server
npm install
cp .env.example .env      # then edit JWT_SECRET to a random string
npm start
```

Open **http://localhost:5000** — the frontend and API are served from the same
Express server, so there's nothing else to configure.

## What it does

- **Sign up / log in** with a username, email, and password (passwords are hashed
  with bcrypt; sessions are JWTs stored in the browser).
- **Profiles**: display name, bio, follower/following/post counts, and an
  editable "My profile" page.
- **Posts**: pin a short text post to the board from the composer in the sidebar.
- **Feed**: "The whole board" (everyone's posts) or "Pinned by people I follow"
  (a personalized feed).
- **Likes**: like/unlike any post, with a live count.
- **Comments**: expand a post to read and add comments.
- **Follow system**: follow/unfollow other users from their profile, and browse
  a user's followers/following lists in a modal.

## API overview

| Method | Path                              | Description                       |
|--------|-----------------------------------|------------------------------------|
| POST   | /api/auth/register                | Create an account                  |
| POST   | /api/auth/login                   | Log in, get a JWT                  |
| GET    | /api/users/:username               | Public profile                     |
| PATCH  | /api/users/me/update                | Update your own display name/bio  |
| POST   | /api/users/:username/follow         | Follow a user                     |
| DELETE | /api/users/:username/follow         | Unfollow a user                   |
| GET    | /api/users/:username/followers      | List followers                    |
| GET    | /api/users/:username/following      | List who they follow               |
| GET    | /api/posts/feed?scope=all\|following | Feed of posts                    |
| GET    | /api/posts/user/:username           | A user's posts                    |
| POST   | /api/posts                          | Create a post                     |
| DELETE | /api/posts/:id                      | Delete your own post               |
| POST   | /api/posts/:id/like                 | Like a post                       |
| DELETE | /api/posts/:id/like                 | Unlike a post                     |
| GET    | /api/posts/:postId/comments          | List comments on a post           |
| POST   | /api/posts/:postId/comments          | Add a comment                     |
| DELETE | /api/posts/:postId/comments/:id      | Delete your own comment           |

All endpoints except register/login (and read-only GETs) require an
`Authorization: Bearer <token>` header — the frontend handles this automatically
once you're logged in.

## Notes / next steps

This is a self-contained starting point, not a production deployment. If you
want to take it further, worth adding:
- Rate limiting and stricter input validation
- Image uploads for avatars/post media
- Pagination on the feed and comment lists (currently capped at 100 posts)
- A production database (Postgres/MySQL) instead of SQLite if you expect concurrent write load
- HTTPS + a real secrets manager for `JWT_SECRET` in production
