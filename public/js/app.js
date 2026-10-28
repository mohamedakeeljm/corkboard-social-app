(() => {
  "use strict";

  const API = "/api";

  // ---------- State ----------
  let token = localStorage.getItem("corkboard_token") || null;
  let currentUser = JSON.parse(localStorage.getItem("corkboard_user") || "null");
  let view = { name: "feed", scope: "all", profileUsername: null };

  // ---------- DOM refs ----------
  const authScreen = document.getElementById("authScreen");
  const appScreen = document.getElementById("appScreen");

  // ---------- API helper ----------
  async function api(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* no body */
    }

    if (!res.ok) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  }

  function setSession(newToken, user) {
    token = newToken;
    currentUser = user;
    localStorage.setItem("corkboard_token", token);
    localStorage.setItem("corkboard_user", JSON.stringify(user));
  }

  function clearSession() {
    token = null;
    currentUser = null;
    localStorage.removeItem("corkboard_token");
    localStorage.removeItem("corkboard_user");
  }

  function initials(name) {
    return (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  function timeAgo(isoString) {
    const then = new Date(isoString.replace(" ", "T") + "Z").getTime();
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(then).toLocaleDateString();
  }

  // ============================================================
  // AUTH SCREEN
  // ============================================================
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginError = document.getElementById("loginError");
  const registerError = document.getElementById("registerError");

  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      loginForm.classList.toggle("hidden", !isLogin);
      registerForm.classList.toggle("hidden", isLogin);
      loginError.textContent = "";
      registerError.textContent = "";
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const fd = new FormData(loginForm);
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { username: fd.get("username"), password: fd.get("password") },
      });
      setSession(data.token, data.user);
      enterApp();
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerError.textContent = "";
    const fd = new FormData(registerForm);
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: {
          displayName: fd.get("displayName"),
          username: fd.get("username"),
          email: fd.get("email"),
          password: fd.get("password"),
        },
      });
      setSession(data.token, data.user);
      enterApp();
    } catch (err) {
      registerError.textContent = err.message;
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    location.reload();
  });

  // ============================================================
  // APP SHELL
  // ============================================================
  function enterApp() {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    document.getElementById("currentUserChip").textContent = `@${currentUser.username}`;
    goToFeed("all");
  }

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (btn.dataset.view === "feed") {
        goToFeed(btn.dataset.scope);
      } else if (btn.dataset.view === "profile") {
        goToProfile(currentUser.username);
      }
    });
  });

  // ---------- Composer ----------
  const composerForm = document.getElementById("composerForm");
  const composerInput = document.getElementById("composerInput");
  const charCount = document.getElementById("charCount");

  composerInput.addEventListener("input", () => {
    charCount.textContent = `${2000 - composerInput.value.length} left`;
  });

  composerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = composerInput.value.trim();
    if (!content) return;
    try {
      const post = await api("/posts", { method: "POST", body: { content } });
      composerInput.value = "";
      charCount.textContent = "2000 left";
      if (view.name === "feed") {
        prependPost(post);
      } else if (view.name === "profile" && view.profileUsername === currentUser.username) {
        prependPost(post);
      }
    } catch (err) {
      alert(err.message);
    }
  });

  // ============================================================
  // FEED VIEW
  // ============================================================
  const feedEl = document.getElementById("feed");
  const feedEmpty = document.getElementById("feedEmpty");
  const viewTitle = document.getElementById("viewTitle");
  const profilePanel = document.getElementById("profilePanel");

  async function goToFeed(scope) {
    view = { name: "feed", scope, profileUsername: null };
    profilePanel.classList.add("hidden");
    viewTitle.textContent = scope === "following" ? "Pinned by people I follow" : "The whole board";
    feedEl.innerHTML = "";
    feedEmpty.classList.add("hidden");

    try {
      const posts = await api(`/posts/feed?scope=${scope}`);
      if (!posts.length) {
        feedEmpty.textContent =
          scope === "following"
            ? "Nobody you follow has pinned anything yet."
            : "Nothing pinned here yet.";
        feedEmpty.classList.remove("hidden");
      }
      posts.forEach((p) => feedEl.appendChild(buildPostCard(p)));
    } catch (err) {
      feedEmpty.textContent = err.message;
      feedEmpty.classList.remove("hidden");
    }
  }

  function prependPost(post) {
    feedEmpty.classList.add("hidden");
    feedEl.insertBefore(buildPostCard(post), feedEl.firstChild);
  }

  // ---------- Post card building ----------
  const postTpl = document.getElementById("postTemplate");
  const commentTpl = document.getElementById("commentTemplate");

  function buildPostCard(post) {
    const node = postTpl.content.firstElementChild.cloneNode(true);
    node.dataset.postId = post.id;

    const avatar = node.querySelector(".avatar");
    avatar.textContent = initials(post.author.displayName);
    avatar.style.background = post.author.avatarColor;

    const authorLink = node.querySelector(".author-name");
    authorLink.textContent = post.author.displayName;
    authorLink.addEventListener("click", (e) => {
      e.preventDefault();
      goToProfile(post.author.username);
    });

    node.querySelector(".timestamp").textContent = `@${post.author.username} · ${timeAgo(post.createdAt)}`;
    node.querySelector(".pinned-content").textContent = post.content;

    const deleteBtn = node.querySelector(".delete-post");
    if (post.isOwn) {
      deleteBtn.classList.remove("hidden");
      deleteBtn.addEventListener("click", async () => {
        if (!confirm("Unpin this post? This can't be undone.")) return;
        try {
          await api(`/posts/${post.id}`, { method: "DELETE" });
          node.remove();
        } catch (err) {
          alert(err.message);
        }
      });
    }

    const likeBtn = node.querySelector(".like-btn");
    const likeCount = node.querySelector(".like-count");
    likeCount.textContent = post.likeCount;
    if (post.likedByViewer) {
      likeBtn.classList.add("liked");
      likeBtn.firstChild.textContent = "♥ ";
    }
    likeBtn.addEventListener("click", async () => {
      const liked = likeBtn.classList.contains("liked");
      try {
        const updated = await api(`/posts/${post.id}/like`, { method: liked ? "DELETE" : "POST" });
        likeCount.textContent = updated.likeCount;
        likeBtn.classList.toggle("liked", updated.likedByViewer);
        likeBtn.firstChild.textContent = updated.likedByViewer ? "♥ " : "♡ ";
      } catch (err) {
        alert(err.message);
      }
    });

    const commentCount = node.querySelector(".comment-count");
    commentCount.textContent = post.commentCount;

    const commentsSection = node.querySelector(".comments-section");
    const commentToggle = node.querySelector(".comment-toggle");
    let commentsLoaded = false;

    commentToggle.addEventListener("click", async () => {
      commentsSection.classList.toggle("hidden");
      if (!commentsSection.classList.contains("hidden") && !commentsLoaded) {
        commentsLoaded = true;
        await loadComments(post.id, node);
      }
    });

    const commentForm = node.querySelector(".comment-form");
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = commentForm.querySelector("input");
      const content = input.value.trim();
      if (!content) return;
      try {
        const comment = await api(`/posts/${post.id}/comments`, {
          method: "POST",
          body: { content },
        });
        input.value = "";
        node.querySelector(".comments-list").appendChild(buildCommentRow(comment, node));
        commentCount.textContent = Number(commentCount.textContent) + 1;
      } catch (err) {
        alert(err.message);
      }
    });

    return node;
  }

  async function loadComments(postId, cardNode) {
    const list = cardNode.querySelector(".comments-list");
    list.innerHTML = `<li class="comment-item">Loading…</li>`;
    try {
      const comments = await api(`/posts/${postId}/comments`);
      list.innerHTML = "";
      if (!comments.length) {
        list.innerHTML = `<li class="comment-item">No comments yet — be the first.</li>`;
      }
      comments.forEach((c) => list.appendChild(buildCommentRow(c, cardNode)));
    } catch (err) {
      list.innerHTML = `<li class="comment-item">${err.message}</li>`;
    }
  }

  function buildCommentRow(comment, cardNode) {
    const row = commentTpl.content.firstElementChild.cloneNode(true);
    const authorEl = row.querySelector(".comment-author");
    authorEl.textContent = `@${comment.author.username}`;
    authorEl.addEventListener("click", () => goToProfile(comment.author.username));
    row.querySelector(".comment-text").textContent = comment.content;

    const delBtn = row.querySelector(".delete-comment");
    if (comment.isOwn) {
      delBtn.classList.remove("hidden");
      delBtn.addEventListener("click", async () => {
        try {
          await api(`/posts/${comment.postId}/comments/${comment.id}`, { method: "DELETE" });
          row.remove();
          const countEl = cardNode.querySelector(".comment-count");
          countEl.textContent = Math.max(0, Number(countEl.textContent) - 1);
        } catch (err) {
          alert(err.message);
        }
      });
    }
    return row;
  }

  // ============================================================
  // PROFILE VIEW
  // ============================================================
  const profileAvatar = document.getElementById("profileAvatar");
  const profileDisplayName = document.getElementById("profileDisplayName");
  const profileUsername = document.getElementById("profileUsername");
  const profileBio = document.getElementById("profileBio");
  const statPosts = document.getElementById("statPosts");
  const statFollowers = document.getElementById("statFollowers");
  const statFollowing = document.getElementById("statFollowing");
  const followBtn = document.getElementById("followBtn");
  const editProfileToggle = document.getElementById("editProfileToggle");
  const editProfileForm = document.getElementById("editProfileForm");

  async function goToProfile(username) {
    view = { name: "profile", scope: null, profileUsername: username };
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    if (username === currentUser.username) {
      document.querySelector('.nav-item[data-view="profile"]').classList.add("active");
    }

    viewTitle.textContent = username === currentUser.username ? "My profile" : `@${username}`;
    profilePanel.classList.remove("hidden");
    feedEl.innerHTML = "";
    feedEmpty.classList.add("hidden");

    try {
      const [profile, posts] = await Promise.all([
        api(`/users/${username}`),
        api(`/posts/user/${username}`),
      ]);
      renderProfilePanel(profile);
      if (!posts.length) {
        feedEmpty.textContent = "No pins here yet.";
        feedEmpty.classList.remove("hidden");
      }
      posts.forEach((p) => feedEl.appendChild(buildPostCard(p)));
    } catch (err) {
      feedEmpty.textContent = err.message;
      feedEmpty.classList.remove("hidden");
    }
  }

  function renderProfilePanel(profile) {
    profileAvatar.textContent = initials(profile.displayName);
    profileAvatar.style.background = profile.avatarColor;
    profileDisplayName.textContent = profile.displayName;
    profileUsername.textContent = `@${profile.username}`;
    profileBio.textContent = profile.bio || "No bio yet.";
    statPosts.textContent = profile.postCount;
    statFollowers.querySelector("strong").textContent = profile.followerCount;
    statFollowing.querySelector("strong").textContent = profile.followingCount;

    statFollowers.onclick = () => openPeopleModal(profile.username, "followers");
    statFollowing.onclick = () => openPeopleModal(profile.username, "following");

    if (profile.isSelf) {
      followBtn.classList.add("hidden");
      editProfileToggle.classList.remove("hidden");
      editProfileForm.querySelector('[name="displayName"]').value = profile.displayName;
      editProfileForm.querySelector('[name="bio"]').value = profile.bio || "";
    } else {
      followBtn.classList.remove("hidden");
      editProfileToggle.classList.add("hidden");
      editProfileForm.classList.add("hidden");
      followBtn.textContent = profile.isFollowing ? "Following ✓" : "Follow";
      followBtn.classList.toggle("following", profile.isFollowing);
      followBtn.onclick = async () => {
        try {
          const updated = await api(`/users/${profile.username}/follow`, {
            method: profile.isFollowing ? "DELETE" : "POST",
          });
          renderProfilePanel(updated);
        } catch (err) {
          alert(err.message);
        }
      };
    }
  }

  editProfileToggle.addEventListener("click", () => {
    editProfileForm.classList.toggle("hidden");
  });

  editProfileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(editProfileForm);
    try {
      const updated = await api("/users/me/update", {
        method: "PATCH",
        body: { displayName: fd.get("displayName"), bio: fd.get("bio") },
      });
      renderProfilePanel(updated);
      editProfileForm.classList.add("hidden");
      document.getElementById("currentUserChip").textContent = `@${updated.username}`;
    } catch (err) {
      alert(err.message);
    }
  });

  // ---------- Followers / following modal ----------
  const peopleModal = document.getElementById("peopleModal");
  const peopleModalTitle = document.getElementById("peopleModalTitle");
  const peopleList = document.getElementById("peopleList");
  const personTpl = document.getElementById("personTemplate");

  document.getElementById("peopleModalClose").addEventListener("click", () => {
    peopleModal.classList.add("hidden");
  });
  peopleModal.addEventListener("click", (e) => {
    if (e.target === peopleModal) peopleModal.classList.add("hidden");
  });

  async function openPeopleModal(username, kind) {
    peopleModalTitle.textContent = kind === "followers" ? "Followers" : "Following";
    peopleList.innerHTML = "<li>Loading…</li>";
    peopleModal.classList.remove("hidden");
    try {
      const people = await api(`/users/${username}/${kind}`);
      peopleList.innerHTML = "";
      if (!people.length) {
        peopleList.innerHTML = `<li class="empty-note">Nobody here yet.</li>`;
      }
      people.forEach((p) => peopleList.appendChild(buildPersonRow(p)));
    } catch (err) {
      peopleList.innerHTML = `<li>${err.message}</li>`;
    }
  }

  function buildPersonRow(person) {
    const row = personTpl.content.firstElementChild.cloneNode(true);
    const avatar = row.querySelector(".avatar");
    avatar.textContent = initials(person.displayName);
    avatar.style.background = person.avatarColor;

    const nameLink = row.querySelector(".person-name");
    nameLink.textContent = person.displayName;
    nameLink.addEventListener("click", (e) => {
      e.preventDefault();
      peopleModal.classList.add("hidden");
      goToProfile(person.username);
    });
    row.querySelector(".person-bio").textContent = person.bio || `@${person.username}`;

    const followBtnRow = row.querySelector(".person-follow");
    if (person.isSelf) {
      followBtnRow.classList.add("hidden");
    } else {
      followBtnRow.textContent = person.isFollowing ? "Following" : "Follow";
      followBtnRow.classList.toggle("following", person.isFollowing);
      followBtnRow.addEventListener("click", async () => {
        try {
          const updated = await api(`/users/${person.username}/follow`, {
            method: person.isFollowing ? "DELETE" : "POST",
          });
          person.isFollowing = updated.isFollowing;
          followBtnRow.textContent = updated.isFollowing ? "Following" : "Follow";
          followBtnRow.classList.toggle("following", updated.isFollowing);
        } catch (err) {
          alert(err.message);
        }
      });
    }
    return row;
  }

  // ============================================================
  // BOOTSTRAP
  // ============================================================
  if (token && currentUser) {
    enterApp();
  }
})();
