const WELCOME_VIDEO_ID = "ts4zUgwUxjg";
let welcomeVideoDragging = null;

function ensureWelcomeVideoPanel() {
  let panel = document.getElementById("welcome-video-pip");
  if (panel) return panel;
  panel = document.createElement("aside");
  panel.id = "welcome-video-pip";
  panel.className = "welcome-video-pip no-print";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Portal welcome video");
  panel.innerHTML = `
    <div class="welcome-video-head" id="welcome-video-drag-handle">
      <div><i class="bi bi-play-btn-fill"></i><span><strong>Welcome to your portal</strong><small>Quick first-time tour</small></span></div>
      <div class="welcome-video-actions">
        <button class="secondary icon-btn" onclick="minimizeWelcomeVideo()" aria-label="Minimize welcome video"><i class="bi bi-dash-lg"></i></button>
        <button class="secondary icon-btn" onclick="closeWelcomeVideo(true)" aria-label="Close welcome video"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="welcome-video-body">
      <div class="welcome-video-frame"><iframe title="Welcome to your client portal" src="https://www.youtube-nocookie.com/embed/${WELCOME_VIDEO_ID}?rel=0&modestbranding=1&playsinline=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
      <div class="welcome-video-copy"><span>Move or resize this guide while you explore.</span><button onclick="closeWelcomeVideo(true)"><i class="bi bi-check2-circle"></i> Got it</button></div>
    </div>`;
  document.body.appendChild(panel);
  initWelcomeVideoDrag(panel);
  return panel;
}

function openWelcomeVideo(autoOpen) {
  const panel = ensureWelcomeVideoPanel();
  if (panel.parentElement?.id === "minimized-panel-dock" && typeof undockMinimizedPanel === "function") undockMinimizedPanel(panel);
  panel.classList.remove("minimized");
  panel.classList.add("open");
  if (autoOpen) panel.classList.add("welcome-arrive");
  panel.setAttribute("aria-hidden", "false");
  setTimeout(() => panel.classList.remove("welcome-arrive"), 600);
}

function minimizeWelcomeVideo() {
  const panel = ensureWelcomeVideoPanel();
  const minimizing = !panel.classList.contains("minimized");
  panel.classList.toggle("minimized", minimizing);
  if (minimizing && typeof dockMinimizedPanel === "function") dockMinimizedPanel(panel);
  else if (!minimizing && typeof undockMinimizedPanel === "function") undockMinimizedPanel(panel);
}

async function closeWelcomeVideo(markSeen) {
  const panel = document.getElementById("welcome-video-pip");
  if (panel) {
    if (typeof undockMinimizedPanel === "function") undockMinimizedPanel(panel);
    panel.classList.remove("open", "minimized");
    panel.setAttribute("aria-hidden", "true");
    const frame = panel.querySelector("iframe");
    if (frame) frame.src = frame.src;
  }
  sessionStorage.removeItem("showWelcomeVideo");
  if (markSeen && typeof apiCall === "function") {
    try { await apiCall("markWelcomeVideoSeen", {}); } catch (_) {}
  }
}

function initWelcomeVideoDrag(panel) {
  const handle = panel.querySelector("#welcome-video-drag-handle");
  handle.addEventListener("pointerdown", event => {
    if (event.target.closest("button") || panel.classList.contains("minimized")) return;
    const rect = panel.getBoundingClientRect();
    welcomeVideoDragging = { dx:event.clientX-rect.left, dy:event.clientY-rect.top };
    panel.style.right = "auto"; panel.style.bottom = "auto";
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", event => {
    if (!welcomeVideoDragging) return;
    const left = Math.max(8, Math.min(window.innerWidth-panel.offsetWidth-8, event.clientX-welcomeVideoDragging.dx));
    const top = Math.max(68, Math.min(window.innerHeight-panel.offsetHeight-8, event.clientY-welcomeVideoDragging.dy));
    panel.style.left = left+"px"; panel.style.top = top+"px";
  });
  const stop = () => { welcomeVideoDragging = null; };
  handle.addEventListener("pointerup", stop); handle.addEventListener("pointercancel", stop);
}

function initWelcomeVideo() {
  if (typeof getRole === "function" && getRole() === "provider") return;
  if (sessionStorage.getItem("showWelcomeVideo") === "1") setTimeout(() => openWelcomeVideo(true), 650);
}
