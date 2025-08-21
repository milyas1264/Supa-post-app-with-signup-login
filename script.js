// ========== Supabase Config ==========
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"; // <-- replace
const SUPABASE_KEY = "YOUR-ANON-KEY";                         // <-- replace
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========== Elements ==========
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");

const compose = document.getElementById("compose");
const titleEl = document.getElementById("title");
const contentEl = document.getElementById("content");
const addBtn = document.getElementById("addBtn");
const postsWrap = document.getElementById("postList");
const myPostsToggle = document.getElementById("myPostsToggle");

let currentUser = null;

// ========== Auth Handlers ==========
signupBtn.onclick = async () => {
  const { error } = await sb.auth.signUp({
    email: emailEl.value.trim(),
    password: passwordEl.value.trim()
  });
  if (error) {
    alert("Signup error: " + error.message);
  } else {
    alert("Signed up! Check your email (if confirmations are enabled).");
  }
};

loginBtn.onclick = async () => {
  const { error } = await sb.auth.signInWithPassword({
    email: emailEl.value.trim(),
    password: passwordEl.value.trim()
  });
  if (error) alert("Login error: " + error.message);
};

logoutBtn.onclick = async () => {
  await sb.auth.signOut();
};

sb.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  updateAuthUI();
  await loadPosts();
});

function updateAuthUI() {
  if (currentUser) {
    authStatus.textContent = `Logged in as ${currentUser.email}`;
    compose.classList.remove("hidden");
  } else {
    authStatus.textContent = "Not logged in";
    compose.classList.add("hidden");
  }
}

// ========== Posts ==========
addBtn.onclick = async () => {
  if (!currentUser) { alert("Please login first"); return; }

  const title = titleEl.value.trim();
  const content = contentEl.value.trim();
  if (!title || !content) { alert("Please fill all fields"); return; }

  const { error } = await sb.from("posts").insert([
    { title, content, user_id: currentUser.id }
  ]);

  if (error) {
    alert("Add failed: " + error.message);
  } else {
    titleEl.value = "";
    contentEl.value = "";
    await loadPosts();
  }
};

myPostsToggle.onchange = async () => { await loadPosts(); };

async function loadPosts() {
  const onlyMine = myPostsToggle.checked && !!currentUser;

  let query = sb.from("posts").select("*").order("id", { ascending: false });
  if (onlyMine && currentUser) query = query.eq("user_id", currentUser.id);

  const { data, error } = await query;
  if (error) { console.error(error); return; }

  postsWrap.innerHTML = "";
  (data || []).forEach(renderPost);
}

function renderPost(post) {
  const isOwner = currentUser && post.user_id === currentUser.id;

  const card = document.createElement("div");
  card.className = "post";

  const created = new Date(post.created_at || Date.now()).toLocaleString();

  card.innerHTML = `
    <h3 class="post-title">${escapeHTML(post.title)}</h3>
    <p class="post-content">${escapeHTML(post.content || "")}</p>
    <div class="meta">#${post.id} • ${created}</div>
    <div class="actions">
      <button class="btn-like" data-id="${post.id}" data-likes="${post.likes}">👍 Like (${post.likes})</button>
      <button class="btn-share" data-id="${post.id}">🔗 Share</button>
      ${isOwner ? `
        <button class="btn-edit" data-id="${post.id}">✏️ Edit</button>
        <button class="btn-delete" data-id="${post.id}">🗑 Delete</button>
      ` : ``}
    </div>
  `;

  // attach handlers
  card.querySelector(".btn-like").onclick = () => likePost(post.id, post.likes);
  card.querySelector(".btn-share").onclick = () => sharePost(post.id);
  if (isOwner) {
    card.querySelector(".btn-edit").onclick = () => editPost(post);
    card.querySelector(".btn-delete").onclick = () => deletePost(post.id);
  }

  postsWrap.appendChild(card);
}

// Secure like: policy only allows +1
async function likePost(id, currentLikes) {
  const { error } = await sb
    .from("posts")
    .update({ likes: currentLikes + 1 })
    .eq("id", id);

  if (error) alert("Like failed: " + error.message);
  else loadPosts();
}

function sharePost(id) {
  const url = `${location.origin}/post/${id}`;
  navigator.clipboard.writeText(url);
  alert("Copied: " + url);
}

async function editPost(post) {
  const title = prompt("Edit title:", post.title);
  if (title === null) return;
  const content = prompt("Edit content:", post.content || "");
  if (content === null) return;

  const { error } = await sb
    .from("posts")
    .update({ title, content })
    .eq("id", post.id);

  if (error) alert("Edit failed: " + error.message);
  else loadPosts();
}

async function deletePost(id) {
  if (!confirm("Delete this post?")) return;
  const { error } = await sb.from("posts").delete().eq("id", id);
  if (error) alert("Delete failed: " + error.message);
  else loadPosts();
}

// XSS-safe helper
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// initial load (handles already-logged-in sessions)
(async () => {
  const { data: { user } } = await sb.auth.getUser();
  currentUser = user ?? null;
  updateAuthUI();
  await loadPosts();
})();
