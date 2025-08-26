// ========== Supabase Config ==========
const SUPABASE_URL = "https://uixwmahojaiqgjxopcwo.supabase.co"; // <-- replace
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeHdtYWhvamFpcWdqeG9wY3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjEwMzIsImV4cCI6MjA3MDU5NzAzMn0.8gW9ouL8XFU8ej39qn4WmDFu94HgGMqwnP-dhSZLgSQ";                         // <-- replace
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// -------------------
// Signup
// -------------------
document.getElementById("signupBtn").onclick = async () => {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;

  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    alert("❌ Signup Error: " + error.message);
  } else {
    alert("✅ Signup successful! Please check your email.");
  }
};

// -------------------
// Login
// -------------------
document.getElementById("loginBtn").onclick = async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert("❌ Login Error: " + error.message);
  } else {
    currentUser = data.user;
    alert("✅ Login successful!");
    loadPosts();
  }
};

// -------------------
// Logout
// -------------------
document.getElementById("logoutBtn").onclick = async () => {
  await supabaseClient.auth.signOut();
  currentUser = null;
  alert("✅ Logged out!");
  document.getElementById("posts").innerHTML = "";
};

// -------------------
// Add Post with Image
// -------------------
document.getElementById("addBtn").onclick = async () => {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const file = document.getElementById("imageInput").files[0];

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert("⚠️ Please login first!");
    return;
  }

  let imageUrl = null;

  if (file) {
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error: uploadError } = await supabaseClient.storage
      .from("post-images")
      .upload(fileName, file);

    if (uploadError) {
      alert("❌ Image Upload Error: " + uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from("post-images")
      .getPublicUrl(fileName);

    imageUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabaseClient
    .from("posts")
    .insert([{ title, content, user_id: user.id, image_url: imageUrl }]);

  if (error) {
    alert("❌ Add Post Error: " + error.message);
  } else {
    alert("✅ Post added!");
    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
    document.getElementById("imageInput").value = "";
    loadPosts();
  }
};

// -------------------
// Like Post
// -------------------
async function likePost(postId, currentLikes) {
  const { error } = await supabaseClient
    .from("posts")
    .update({ likes: currentLikes + 1 })
    .eq("id", postId);

  if (error) {
    alert("❌ Like Error: " + error.message);
  } else {
    loadPosts();
  }
}

// -------------------
// Delete Post
// -------------------
async function deletePost(postId) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert("⚠️ Please login first!");
    return;
  }

  const { error } = await supabaseClient
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    alert("❌ Delete Error: " + error.message);
  } else {
    alert("✅ Post deleted!");
    loadPosts();
  }
}

// -------------------
// Edit Post
// -------------------
async function editPost(postId, oldTitle, oldContent) {
  const newTitle = prompt("Enter new title:", oldTitle);
  const newContent = prompt("Enter new content:", oldContent);

  if (!newTitle || !newContent) return;

  const { error } = await supabaseClient
    .from("posts")
    .update({ title: newTitle, content: newContent })
    .eq("id", postId);

  if (error) {
    alert("❌ Edit Error: " + error.message);
  } else {
    alert("✅ Post updated!");
    loadPosts();
  }
}

// -------------------
// Share Post
// -------------------
function sharePost(postId) {
  const postUrl = `${window.location.origin}?post=${postId}`;
  navigator.clipboard.writeText(postUrl).then(() => {
    alert("✅ Post link copied: " + postUrl);
  });
}

// -------------------
// Load Posts
// -------------------
async function loadPosts() {
  const postsDiv = document.getElementById("posts");
  postsDiv.innerHTML = "Loading...";

  const myPostsToggle = document.getElementById("myPostsToggle");
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user;

  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get("post");

  let query = supabaseClient.from("posts").select("*").order("created_at", { ascending: false });

  if (postId) {
    query = query.eq("id", postId);
  } else if (myPostsToggle && myPostsToggle.checked && currentUser) {
    query = query.eq("user_id", currentUser.id);
  }

  const { data, error } = await query;

  if (error) {
    postsDiv.innerHTML = "❌ Error loading posts: " + error.message;
    return;
  }

  postsDiv.innerHTML = "";
  data.forEach(post => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <h3>${post.title}</h3>
      ${post.image_url ? `<img src="${post.image_url}">` : ""}
      <p>${post.content || ""}</p>
      <p class="small">Likes: ${post.likes} | ${new Date(post.created_at).toLocaleString()}</p>
      <div class="btn-group">
        <button onclick="likePost('${post.id}', ${post.likes})">👍 Like</button>
        <button onclick="sharePost('${post.id}')">🔗 Share</button>
        ${currentUser && currentUser.id === post.user_id ? `
          <button onclick="editPost('${post.id}', '${post.title}', '${post.content || ""}')">✏️ Edit</button>
          <button onclick="deletePost('${post.id}')">❌ Delete</button>
        ` : ""}
      </div>
    `;
    postsDiv.appendChild(div);
  });
}

document.getElementById("myPostsToggle").onchange = loadPosts;


