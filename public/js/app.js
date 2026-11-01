(function () {
  const DATA = window.PORTFOLIO_DATA;

  // --- State ---
  const state = {
    path: window.location.pathname || "/",
    themeMode: localStorage.getItem("corner-theme") || "auto",
    qaOpen: false,
    soundEnabled: localStorage.getItem("corner-sound") !== "off",
    musicStatus: "idle", // idle | playing | off
    currentTrackIndex: 0,
    peekWord: null,
    peekProject: null,
    peekArticle: null,
    cvOpen: new URLSearchParams(window.location.search).get("cv") === "open",
    cvSelectedEntry: null,
    cvSearch: "",
    cvCategory: "all",
    cvSortCol: "impact_rating",
    cvSortDir: "desc",
    lightboxImages: null,
    lightboxIndex: null,
    workSearch: new URLSearchParams(window.location.search).get("q") || "",
    workFilter: new URLSearchParams(window.location.search).get("room") || "all",
    activeDoor: null,
    hlIndex: 0
  };

  let audioEl = null;
  let audioCtx = null;
  let cleanupFns = [];

  function registerCleanup(fn) {
    cleanupFns.push(fn);
  }
  function runCleanups() {
    while (cleanupFns.length) {
      try { cleanupFns.pop()(); } catch (e) {}
    }
  }

  // --- Room & Theme Resolution ---
  const roomDefaults = {
    developer: "dark",
    me: "light",
    creative: "light",
    letters: "dark"
  };

  function getRoom(p) {
    if (p.startsWith("/engineer") || p.startsWith("/developer")) return "developer";
    if (p.startsWith("/creative")) return "creative";
    if (p.startsWith("/writing")) return "letters";
    return "me";
  }

  function getEffectiveTheme(room) {
    if (room === "developer") return "dark";
    if (state.themeMode === "light" || state.themeMode === "dark") return state.themeMode;
    return roomDefaults[room] || "light";
  }

  function applyRoomAndTheme() {
    const corner = document.querySelector(".corner");
    if (!corner) return;
    const room = getRoom(state.path);
    const theme = getEffectiveTheme(room);
    corner.setAttribute("data-room", room);
    corner.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    requestAnimationFrame(() => {
      const bg = getComputedStyle(corner).getPropertyValue("--bg").trim();
      if (bg) {
        document.documentElement.style.background = bg;
        document.body.style.background = bg;
      }
      document.documentElement.style.colorScheme = theme;
    });
  }

  function toggleTheme() {
    const room = getRoom(state.path);
    const current = getEffectiveTheme(room);
    const next = current === "dark" ? "light" : "dark";
    state.themeMode = next;
    localStorage.setItem("corner-theme", next);
    render();
  }

  // --- Sound & Music ---
  function playUiTick(freq = 520, dur = 0.025) {
    if (!state.soundEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  function toggleMusic(trackIdx) {
    if (typeof trackIdx === "number") {
      state.currentTrackIndex = trackIdx;
    }
    const track = DATA.tracks[state.currentTrackIndex] || DATA.tracks[0];
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.preload = "auto";
      audioEl.onended = () => {
        state.musicStatus = "idle";
        updateMusicUI();
      };
    }
    if (state.musicStatus === "playing" && typeof trackIdx !== "number") {
      audioEl.pause();
      state.musicStatus = "idle";
      updateMusicUI();
      return;
    }
    if (audioEl.src !== track.preview) {
      audioEl.src = track.preview;
    }
    audioEl.volume = 0.25;
    audioEl.play().then(() => {
      state.soundEnabled = true;
      localStorage.setItem("corner-sound", "on");
      state.musicStatus = "playing";
      updateMusicUI();
    }).catch(() => {
      state.musicStatus = "idle";
      updateMusicUI();
    });
  }

  function updateMusicUI() {
    document.querySelectorAll(".c-music").forEach(btn => {
      btn.setAttribute("data-status", state.soundEnabled ? state.musicStatus : "off");
      const ic = btn.querySelector(".c-music-ic");
      if (ic) {
        ic.innerHTML = state.musicStatus === "playing"
          ? `<span class="c-music-bars" aria-hidden="true"><i></i><i></i><i></i></span>`
          : musicSvg();
      }
    });
    const sleeveWrap = document.querySelector(".m-sleeve-wrap");
    if (sleeveWrap) {
      sleeveWrap.setAttribute("data-playing", state.musicStatus === "playing" ? "true" : "false");
    }
    const spinEl = document.querySelector(".m-vinyl-spin");
    if (spinEl) {
      spinEl.style.animationPlayState = state.musicStatus === "playing" ? "running" : "paused";
    }
    const playBtnLabel = document.querySelector(".js-now-play-label");
    if (playBtnLabel) {
      playBtnLabel.textContent = state.musicStatus === "playing" ? "Pause preview" : "Play 30s preview";
    }
  }

  // --- Router ---
  function navigate(href, opts = {}) {
    if (!href) return;
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      window.open(href, "_blank", "noopener");
      return;
    }
    playUiTick(640, 0.03);
    const url = new URL(href, window.location.origin);
    state.path = url.pathname;
    state.qaOpen = false;
    if (url.searchParams.get("q")) state.workSearch = url.searchParams.get("q");
    if (url.searchParams.get("room")) state.workFilter = url.searchParams.get("room");
    if (url.searchParams.get("cv") === "open") state.cvOpen = true;
    if (!opts.replace) {
      window.history.pushState({}, "", href);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    render();
  }

  window.addEventListener("popstate", () => {
    state.path = window.location.pathname || "/";
    state.peekWord = null;
    state.peekProject = null;
    state.peekArticle = null;
    render();
  });

  // --- SVG Icons ---
  function sidebarSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M216,36H40A20,20,0,0,0,20,56V200a20,20,0,0,0,20,20H216a20,20,0,0,0,20-20V56A20,20,0,0,0,216,36ZM44,60H76V196H44ZM212,196H100V60H212Z"></path></svg>`;
  }
  function closeSvg(size = 17) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="currentColor" viewBox="0 0 256 256"><path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z"></path></svg>`;
  }
  function gridSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256"><path d="M112,56v48a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8h48A8,8,0,0,1,112,56Zm88-8H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V56A8,8,0,0,0,200,48Zm-96,96H56a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,104,144Zm96,0H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,200,144Z" opacity="0.2"></path><path d="M200,136H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48ZM104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Z"></path></svg>`;
  }
  function penSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256"><path d="M128,48,68.32,70.38a8,8,0,0,0-5.08,6.17L40,216l139.45-23.24a8,8,0,0,0,6.17-5.08L208,128Zm-4,104a20,20,0,1,1,20-20A20,20,0,0,1,124,152Z" opacity="0.2"></path><path d="M248,92.68a15.86,15.86,0,0,0-4.69-11.31L174.63,12.68a16,16,0,0,0-22.63,0L123.57,41.11l-58,21.77A16.06,16.06,0,0,0,55.35,75.23L32.11,214.68A8,8,0,0,0,40,224a8.4,8.4,0,0,0,1.32-.11l139.44-23.24a16,16,0,0,0,12.35-10.17l21.77-58L243.31,104A15.87,15.87,0,0,0,248,92.68Zm-69.87,92.19L63.32,204l47.37-47.37a28,28,0,1,0-11.32-11.32L52,192.7,71.13,77.86,126,57.29,198.7,130ZM112,132a12,12,0,1,1,12,12A12,12,0,0,1,112,132Zm96-15.32L139.31,48l24-24L232,92.68Z"></path></svg>`;
  }
  function handshakeSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256"><path d="M200,152l-40,40L96,176,40,136,72.68,70.63,128,56l55.32,14.63L183.6,72H144L98.34,116.29a8,8,0,0,0,1.38,12.42C117.23,139.9,141,139.13,160,120Z" opacity="0.2"></path><path d="M254.3,107.91,228.78,56.85a16,16,0,0,0-21.47-7.15L182.44,62.13,130.05,48.27a8.14,8.14,0,0,0-4.1,0L73.56,62.13,48.69,49.7a16,16,0,0,0-21.47,7.15L1.7,107.9a16,16,0,0,0,7.15,21.47l27,13.51,55.49,39.63a8.06,8.06,0,0,0,2.71,1.25l64,16a8,8,0,0,0,7.6-2.1l55.07-55.08,26.42-13.21a16,16,0,0,0,7.15-21.46Zm-54.89,33.37L165,113.72a8,8,0,0,0-10.68.61C136.51,132.27,116.66,130,104,122L147.24,80h31.81l27.21,54.41ZM41.53,64,62,74.22,36.43,125.27,16,115.06Zm116,119.13L99.42,168.61l-49.2-35.14,28-56L128,64.28l9.8,2.59-45,43.68-.08.09a16,16,0,0,0,2.72,24.81c20.56,13.13,45.37,11,64.91-5L188,152.66Zm62-57.87-25.52-51L214.47,64,240,115.06Zm-87.75,92.67a8,8,0,0,1-7.75,6.06,8.13,8.13,0,0,1-1.95-.24L80.41,213.33a7.89,7.89,0,0,1-2.71-1.25L51.35,193.26a8,8,0,0,1,9.3-13l25.11,17.94L126,208.24A8,8,0,0,1,131.82,217.94Z"></path></svg>`;
  }
  function moonSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256"><path d="M227.89,147.89A96,96,0,1,1,108.11,28.11,96.09,96.09,0,0,0,227.89,147.89Z" opacity="0.2"></path><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z"></path></svg>`;
  }
  function musicSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="currentColor" viewBox="0 0 256 256"><path d="M208,164a28,28,0,1,1-28-28A28,28,0,0,1,208,164ZM52,168a28,28,0,1,0,28,28A28,28,0,0,0,52,168Z" opacity="0.2"></path><path d="M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.08A36,36,0,1,0,88,196V62.25l112-28v99.83A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.69ZM52,216a20,20,0,1,1,20-20A20,20,0,0,1,52,216Zm128-32a20,20,0,1,1,20-20A20,20,0,0,1,180,184Z"></path></svg>`;
  }
  function downloadSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M228,144v64a12,12,0,0,1-12,12H40a12,12,0,0,1-12-12V144a12,12,0,0,1,24,0v52H204V144a12,12,0,0,1,24,0Zm-108.49,8.49a12,12,0,0,0,17,0l40-40a12,12,0,0,0-17-17L140,115V32a12,12,0,0,0-24,0v83L96.49,95.51a12,12,0,0,0-17,17Z"></path></svg>`;
  }
  function arrowRightSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z"></path></svg>`;
  }
  function expandSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M220,48V96a12,12,0,0,1-24,0V77l-35.51,35.52a12,12,0,0,1-17-17L179,60H160a12,12,0,0,1,0-24h48A12,12,0,0,1,220,48ZM95.51,143.51,60,179V160a12,12,0,0,0-24,0v48a12,12,0,0,0,12,12H96a12,12,0,0,0,0-24H77l35.52-35.51a12,12,0,0,0-17-17ZM208,148a12,12,0,0,0-12,12v19l-35.51-35.52a12,12,0,0,0-17,17L179,196H160a12,12,0,0,0,0,24h48a12,12,0,0,0,12-12V160A12,12,0,0,0,208,148ZM77,60H96a12,12,0,0,0,0-24H48A12,12,0,0,0,36,48V96a12,12,0,0,0,24,0V77l35.51,35.52a12,12,0,0,0,17-17Z"></path></svg>`;
  }

  // --- Shell Components (Quick Access + Floating Dock + Footer) ---
  function renderQuickAccess(room, theme) {
    const isDev = room === "developer";
    const nextThemeLabel = theme === "dark" ? "Light mode" : "Dark mode";
    return `
      <button class="c-qa-tab" id="qa-mobile-open" aria-label="Open quick access" aria-expanded="${state.qaOpen}">
        ${sidebarSvg()}
      </button>
      <aside class="c-qa" data-open="${state.qaOpen}" aria-label="Quick access">
        <button class="c-qa-toggle" id="qa-toggle-btn" aria-label="Toggle quick access" aria-expanded="${state.qaOpen}">
          ${state.qaOpen ? closeSvg(16) : sidebarSvg()}
          <span>Quick access</span>
        </button>
        <nav>
          <a class="c-qa-item" href="/work" data-nav="/work" ${state.path.startsWith("/work") ? 'aria-current="page"' : ""} data-tip="Everything I've led" aria-label="Everything I've led">
            ${gridSvg()}
            <span>Everything I've led</span>
          </a>
          <a class="c-qa-item" href="/writing" data-nav="/writing" ${state.path.startsWith("/writing") ? 'aria-current="page"' : ""} data-tip="Insights & reports" aria-label="Insights & reports">
            ${penSvg()}
            <span>Insights &amp; reports</span>
          </a>
          <a class="c-qa-item" href="/commission" data-nav="/commission" ${state.path.startsWith("/commission") ? 'aria-current="page"' : ""} data-tip="Work with me" aria-label="Work with me">
            ${handshakeSvg()}
            <span>Work with me</span>
          </a>
        </nav>
        <span class="c-qa-sep" aria-hidden="true"></span>
        ${!isDev ? `
          <button class="c-qa-item" id="qa-theme-btn" aria-label="Switch to ${nextThemeLabel.toLowerCase()}" data-tip="${nextThemeLabel}">
            ${moonSvg()}
            <span>${nextThemeLabel}</span>
          </button>
        ` : ""}
        <button class="c-qa-item c-music" id="qa-music-btn" data-status="${state.soundEnabled ? state.musicStatus : "off"}" aria-label="Play music" data-tip="Play music">
          <span class="c-music-ic">
            ${state.musicStatus === "playing" ? `<span class="c-music-bars" aria-hidden="true"><i></i><i></i><i></i></span>` : musicSvg()}
          </span>
          <span>${state.musicStatus === "playing" ? "Playing" : "Music"}</span>
        </button>
      </aside>
      ${state.qaOpen ? `<div class="c-qa-scrim" id="qa-scrim" aria-hidden="true"></div>` : ""}
    `;
  }

  function renderDock(room, theme) {
    const logoSrc = theme === "dark" ? "/logo/azeeza-logo-white.svg" : "/logo/azeeza-logo-black.svg";
    return `
      <div class="c-dock-explore" id="dock-explore" data-show="false" aria-hidden="true">Explore another side of me</div>
      <nav class="c-dock" id="main-dock" data-hidden="false" data-big="false" aria-label="Main">
        <a class="c-dock-name" href="/" data-nav="/" aria-label="Azeeza Lawal, home" ${state.path === "/" ? 'aria-current="page"' : ""}>
          <img src="${logoSrc}" alt="" width="24" height="24" />
          <span>Azeeza Lawal</span>
        </a>
        <span class="c-dock-sep" aria-hidden="true"></span>
        <a class="c-roomtab" data-room="developer" href="/engineer" data-nav="/engineer" ${state.path.startsWith("/engineer") ? 'aria-current="page"' : ""} title="Talent management, HRIS systems, analytics &amp; operations.">
          <span class="dot" aria-hidden="true"></span>People &amp; HR
        </a>
        <a class="c-roomtab" data-room="creative" href="/creative" data-nav="/creative" ${state.path.startsWith("/creative") ? 'aria-current="page"' : ""} title="Global donor SDG advocacy, communications &amp; award-winning journalism.">
          <span class="dot" aria-hidden="true"></span>Impact &amp; Media
        </a>
        <span class="c-dock-sep" aria-hidden="true"></span>
        <div class="c-hire-split" data-current="${state.path.startsWith("/hire")}">
          <a class="c-hire" href="/hire" data-nav="/hire" ${state.path.startsWith("/hire") ? 'aria-current="page"' : ""} title="HR Generalist, Talent Management, Employee Relations, MBA &amp; PMP.">
            <span class="pulse" aria-hidden="true"></span>Hire me
          </a>
          <a href="/cv" data-nav="/cv" class="c-hire-cv" aria-label="View / Print CV (PDF)" title="View / Print CV (PDF)">
            ${downloadSvg()}
            <span>CV</span>
          </a>
        </div>
      </nav>
    `;
  }

  function renderFooter() {
    return `
      <footer class="c-footer">
        <div class="c-wrap c-footer-grid">
          <div>
            <p class="c-eyebrow">${DATA.profile.title}</p>
            <p class="c-h3" style="margin-top:10px">${DATA.profile.motto}</p>
            <p class="c-muted" style="margin:18px 0 14px">Subscribe to get my monthly People Operations &amp; SDG impact notes: what I'm building, analyzing, and learning.</p>
            <form id="footer-sub-form" style="display:grid;gap:8px;max-width:420px">
              <div style="display:flex;gap:8px">
                <label for="sub-email" class="sr-only">Email</label>
                <input id="sub-email" class="c-input" type="email" required placeholder="you@company.com" />
                <button class="c-btn c-btn-primary" type="submit">Subscribe</button>
              </div>
              <p id="footer-sub-msg" class="c-muted" style="font-size:14px;display:none"></p>
            </form>
          </div>
          <div>
            <h4>Rooms</h4>
            <ul>
              <li><a href="/engineer" data-nav="/engineer">People &amp; HR</a></li>
              <li><a href="/creative" data-nav="/creative">Impact &amp; Media</a></li>
              <li><a href="/hire" data-nav="/hire">Hire me</a></li>
              <li><a href="/work" data-nav="/work">Everything</a></li>
            </ul>
          </div>
          <div>
            <h4>Read &amp; Connect</h4>
            <ul>
              <li><a href="/writing" data-nav="/writing">Insights &amp; reports</a></li>
              <li><a href="/commission" data-nav="/commission">Work with me</a></li>
              <li><a href="/cv" data-nav="/cv">Printable CV</a></li>
            </ul>
          </div>
          <div>
            <h4>Elsewhere</h4>
            <ul>
              <li><a href="${DATA.profile.linkedin}" target="_blank" rel="noreferrer">LinkedIn ↗</a></li>
              <li><a href="mailto:${DATA.profile.email}">Email (${DATA.profile.email})</a></li>
              <li><a href="tel:${DATA.profile.phone.replace(/[^+\d]/g, '')}">${DATA.profile.phone}</a></li>
            </ul>
          </div>
        </div>
        <div class="c-wrap" style="margin-top:48px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <span class="c-eyebrow">© ${new Date().getFullYear()} ${DATA.profile.fullName} · ${DATA.profile.location}</span>
          <a class="c-eyebrow" href="/hire?cv=open" data-open-cv="true">Open Interactive Master CV →</a>
        </div>
      </footer>
    `;
  }

  // --- PAGE 1: HOME ("/") ---
  function renderHomePage() {
    const marqueeRowsHtml = DATA.iamGroups.map((grp, idx) => {
      const doubled = [...grp.words, ...grp.words];
      return `
        <div class="c-marquee" aria-label="I am a ${grp.label}">
          <div class="c-marquee-row" data-reverse="${idx % 2 === 1}" style="--dur:${46 + idx * 9}s">
            ${doubled.map((item, wIdx) => `
              <button class="c-iam" tabindex="${wIdx >= grp.words.length ? -1 : 0}" ${wIdx >= grp.words.length ? 'aria-hidden="true"' : ""} data-word="${encodeURIComponent(item.w)}" data-q="${encodeURIComponent(item.q || item.w)}">
                ${item.w}
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    const currentlyHtml = DATA.currently.items.map(it => `
      <div>
        <span class="c-eyebrow">${it.label}</span>
        <a href="${it.href}" data-nav="${it.href}"><b>${it.value} →</b></a>
      </div>
    `).join("");

    const doorsHtml = DATA.profile.doors.map((d, i) => `
      <a class="c-door2" href="${d.href}" data-nav="${d.href}" data-door-idx="${i}" data-active="false" data-dim="false" style="--glow:${d.glow}">
        <img src="${d.img}" alt="" loading="lazy" style="object-position:${d.pos}" />
        <span class="c-door2-shade" aria-hidden="true"></span>
        <span class="c-door2-text">
          <span class="c-eyebrow">0${i + 1}</span>
          <span class="c-door2-title">${d.prompt}</span>
          <span class="c-door2-blurb">${d.blurb}</span>
          <span class="c-door2-cta">${d.cta} ${arrowRightSvg()}</span>
        </span>
      </a>
    `).join("");

    return `
      <section class="c-hero" id="word-hero-section" style="height:320vh" aria-label="Portrait made of words">
        <div class="c-hero-stage" id="word-hero-stage">
          <canvas id="word-hero-canvas" aria-hidden="true"></canvas>
          <div class="c-hero-shade" id="word-hero-shade" style="opacity:0" aria-hidden="true"></div>
          <div class="c-hero-copy" id="word-hero-copy" style="transform:scale(1)">
            <h1>
              <span style="display:block;white-space:nowrap">Azeeza</span>
              <span style="display:block;white-space:nowrap">Lawal</span>
            </h1>
            <p id="word-hero-sub" style="opacity:1">${DATA.profile.sentence}</p>
            <div class="c-scroll-cue" id="word-hero-cue" style="margin-top:28px;opacity:1">
              <i aria-hidden="true"></i> scroll to meet me
            </div>
          </div>
          <button class="c-btn c-btn-sm c-hero-skip" id="word-hero-skip">Skip intro ↓</button>
        </div>
        <ul class="sr-only">
          ${DATA.heroWords.map(w => `<li>${w}</li>`).join("")}
        </ul>
      </section>

      <section id="after-hero" class="c-section">
        <div class="c-iam-wrap">
          <div class="c-iam-lead" aria-hidden="true"><span>I&nbsp;am&nbsp;a</span></div>
          <div class="c-iam-rows">
            ${marqueeRowsHtml}
          </div>
        </div>
        <div class="c-wrap">
          <p class="c-eyebrow" style="margin-top:18px;text-align:right">Tap any role to see proof →</p>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-reveal" data-in="true">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;flex-wrap:wrap;gap:12px">
              <p class="c-eyebrow">Currently</p>
              <span style="display:flex;gap:18px;align-items:baseline">
                <span class="c-eyebrow" style="display:inline-flex;align-items:center;gap:8px">
                  <i style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block"></i>
                  Abuja, Nigeria · Available for HR &amp; People Ops leadership
                </span>
                <span class="c-eyebrow" style="color:var(--faint)">updated ${DATA.currently.updated}</span>
              </span>
            </div>
            <div class="c-currently">
              ${currentlyHtml}
            </div>
          </div>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-spotlight">
            <div class="c-reveal c-head" data-in="true">
              <div>
                <p class="c-eyebrow">${DATA.spotlight.eyebrow}</p>
                <h2 class="c-h2" style="margin-top:10px">${DATA.spotlight.title}</h2>
              </div>
              <button class="c-btn c-btn-primary" data-article-id="${DATA.spotlight.articleId}">Read case memo →</button>
            </div>
            <div class="c-update-teaser">
              <a class="c-video" style="border-radius:18px;cursor:pointer" data-article-id="${DATA.spotlight.articleId}">
                <img src="${DATA.spotlight.image}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />
              </a>
              <div>
                <p class="c-muted" style="font-size:18px">${DATA.spotlight.summary}</p>
                <a class="c-btn" style="margin-top:18px" href="/writing" data-nav="/writing">All insights &amp; reports →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <h2 class="c-h2">Explore another side of me.</h2>
            <p class="c-muted">Three rooms. Pick one.</p>
          </div>
          <div class="c-doors" id="home-doors">
            ${doorsHtml}
          </div>
        </div>
      </section>
    `;
  }

  // --- WORD PORTRAIT CANVAS ENGINE (Exact port of nanaamoako.com 59301) ---
  function initWordPortraitCanvas() {
    const section = document.getElementById("word-hero-section");
    const stage = document.getElementById("word-hero-stage");
    const canvas = document.getElementById("word-hero-canvas");
    const shade = document.getElementById("word-hero-shade");
    const copy = document.getElementById("word-hero-copy");
    const sub = document.getElementById("word-hero-sub");
    const cue = document.getElementById("word-hero-cue");
    const skipBtn = document.getElementById("word-hero-skip");
    if (!section || !canvas) return;

    const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeInOutCubic = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const fontStack = '"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif';

    let pointer = null;
    let progress = 0;
    let rafId = 0;
    let gridData = null;
    let imgEl = null;
    let fullImgEl = null;
    let featheredHeroCanvas = null;
    let studioColors = null;
    let backdropCacheCanvas = null;
    let backdropCacheKey = "";

    function smoothstep(edge0, edge1, x) {
      const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function buildFeatheredHeroAssets(image) {
      const W = image.naturalWidth || 825;
      const H = image.naturalHeight || 1024;
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const ctx = off.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;

      const avgRegion = (x0, x1, y0, y1) => {
        let r = 0, g = 0, b = 0, c = 0;
        const ix0 = clamp(Math.floor(x0), 0, W - 1);
        const ix1 = clamp(Math.floor(x1), 0, W - 1);
        const iy0 = clamp(Math.floor(y0), 0, H - 1);
        const iy1 = clamp(Math.floor(y1), 0, H - 1);
        for (let y = iy0; y <= iy1; y += 2) {
          for (let x = ix0; x <= ix1; x += 2) {
            const i = (y * W + x) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            c++;
          }
        }
        return c > 0 ? [Math.round(r / c), Math.round(g / c), Math.round(b / c)] : [174, 125, 86];
      };

      const tl = avgRegion(0, W * 0.08, 0, H * 0.08);
      const tc = avgRegion(W * 0.42, W * 0.58, 0, H * 0.03);
      const tr = avgRegion(W * 0.92, W - 1, 0, H * 0.08);
      const ml = avgRegion(0, W * 0.08, H * 0.22, H * 0.45);
      const mr = avgRegion(W * 0.92, W - 1, H * 0.22, H * 0.45);
      const bd = avgRegion(W * 0.25, W * 0.75, H * 0.92, H - 1);
      const bgBase = [
        Math.round((tl[0] + tr[0] + ml[0] + mr[0]) / 4),
        Math.round((tl[1] + tr[1] + ml[1] + mr[1]) / 4),
        Math.round((tl[2] + tr[2] + ml[2] + mr[2]) / 4)
      ];

      // Feather outer edges of the portrait so it melts seamlessly into the full-bleed studio backdrop
      for (let y = 0; y < H; y++) {
        const ny = y / (H - 1);
        const fadeT = smoothstep(0.0, 0.09, ny);
        const fadeTWide = smoothstep(0.0, 0.18, ny);
        for (let x = 0; x < W; x++) {
          const nx = x / (W - 1);
          const i = (y * W + x) * 4;
          const fadeL = smoothstep(0.0, 0.18, nx);
          const fadeR = smoothstep(0.0, 0.18, 1 - nx);
          let alpha = fadeL * fadeR * fadeT;

          // Extra-wide feather for exterior studio backdrop pixels so no rectangular box can ever appear
          if (ny < 0.72 && (nx < 0.32 || nx > 0.68 || ny < 0.18)) {
            const distBg = Math.hypot(data[i] - bgBase[0], data[i + 1] - bgBase[1], data[i + 2] - bgBase[2]);
            if (distBg < 42) {
              const bgWeight = clamp((42 - distBg) / 28, 0, 1);
              const wideAlpha = smoothstep(0.02, 0.32, nx) * smoothstep(0.02, 0.32, 1 - nx) * fadeTWide;
              alpha = lerp(alpha, Math.min(alpha, wideAlpha), bgWeight);
            }
          }

          data[i + 3] = Math.round(data[i + 3] * alpha);
        }
      }

      ctx.putImageData(imgData, 0, 0);
      featheredHeroCanvas = off;
      studioColors = { tl, tc, tr, ml, mr, bd, bgBase };
      backdropCacheKey = "";
    }

    function buildWordCells(image, words, brandWords, numRows) {
      const wSample = 220;
      const hSample = Math.round(wSample * (image.naturalHeight || 1000) / (image.naturalWidth || 800));
      const aspect = hSample / wSample;
      const off = document.createElement("canvas");
      off.width = wSample;
      off.height = hSample;
      const ctx = off.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, wSample, hSample);
      const data = ctx.getImageData(0, 0, wSample, hSample).data;

      const samplePx = (nx, ny) => {
        const px = clamp(Math.round((wSample - 1) * nx), 0, wSample - 1);
        const py = clamp(Math.round((hSample - 1) * ny), 0, hSample - 1);
        const idx = (py * wSample + px) * 4;
        return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
      };

      // Check if image has transparent background (cutout) or solid studio background
      let cornerAlphaSum = 0;
      let bgR = 0, bgG = 0, bgB = 0, count = 0;
      for (let y = 0; y < 10; y++) {
        for (const x of [0, 1, 2, 3, 4, wSample - 5, wSample - 4, wSample - 3, wSample - 2, wSample - 1]) {
          const idx = (y * wSample + x) * 4;
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
          cornerAlphaSum += data[idx + 3];
          count++;
        }
      }
      bgR /= count; bgG /= count; bgB /= count;
      const hasAlphaCutout = (cornerAlphaSum / count) < 50;

      // Border-connected flood fill to cleanly isolate exterior studio backdrop without creating holes in headscarf/skin
      const bgMask = new Uint8Array(wSample * hSample);
      if (!hasAlphaCutout) {
        const queue = [];
        const colorDistToBg = (i4) => Math.hypot(data[i4] - bgR, data[i4 + 1] - bgG, data[i4 + 2] - bgB);
        const stepDist = (i4, j4) => Math.hypot(data[i4] - data[j4], data[i4 + 1] - data[j4 + 1], data[i4 + 2] - data[j4 + 2]);

        for (let x = 0; x < wSample; x++) {
          const topIdx = x;
          if (colorDistToBg(topIdx * 4) < 42) { bgMask[topIdx] = 1; queue.push(topIdx); }
        }
        for (let y = 0; y < Math.floor(hSample * 0.78); y++) {
          const leftIdx = y * wSample;
          const rightIdx = y * wSample + (wSample - 1);
          if (!bgMask[leftIdx] && colorDistToBg(leftIdx * 4) < 45) { bgMask[leftIdx] = 1; queue.push(leftIdx); }
          if (!bgMask[rightIdx] && colorDistToBg(rightIdx * 4) < 45) { bgMask[rightIdx] = 1; queue.push(rightIdx); }
        }

        let head = 0;
        while (head < queue.length) {
          const curr = queue[head++];
          const cx = curr % wSample;
          const cy = (curr - cx) / wSample;
          const c4 = curr * 4;
          const neighbors = [];
          if (cx > 0) neighbors.push(curr - 1);
          if (cx < wSample - 1) neighbors.push(curr + 1);
          if (cy > 0) neighbors.push(curr - wSample);
          if (cy < hSample - 1) neighbors.push(curr + wSample);
          for (const nb of neighbors) {
            if (bgMask[nb]) continue;
            const n4 = nb * 4;
            if (colorDistToBg(n4) < 34 && stepDist(c4, n4) < 11) {
              bgMask[nb] = 1;
              queue.push(nb);
            }
          }
        }
      }

      const isForeground = (nx, ny) => {
        const px = clamp(Math.round((wSample - 1) * nx), 0, wSample - 1);
        const py = clamp(Math.round((hSample - 1) * ny), 0, hSample - 1);
        const [r, g, b, a] = samplePx(nx, ny);
        if (hasAlphaCutout) return a > 100;
        return a >= 40 && bgMask[py * wSample + px] === 0;
      };

      const mCtx = document.createElement("canvas").getContext("2d");
      mCtx.font = `600 12px ${fontStack}`;
      const widthCache = new Map();
      const measureWord = w => {
        if (!widthCache.has(w)) widthCache.set(w, mCtx.measureText(w).width / 12);
        return widthCache.get(w);
      };

      const em = 0.9 * aspect / numRows;
      const gap = 0.32 * em;
      const cells = [];
      let wordIdx = 0;
      let brandIdx = 0;

      for (let r = 0; r < numRows; r++) {
        const ny = (r + 0.5) / numRows;
        let nx = (r % 2) * em * 0.6;
        let colCount = 0;
        while (nx < 1) {
          if (!isForeground(nx + 0.2 * em, ny)) {
            nx += 0.45 * em;
            continue;
          }
          const fits = wNorm => {
            let hits = 0;
            for (let s = 0; s <= 5; s++) {
              if (nx + wNorm * s / 5 <= 1 && isForeground(nx + wNorm * s / 5, ny)) hits++;
            }
            return (hits / 6) >= 0.82;
          };

          let chosen = null;
          let wNorm = 0;
          const isBrand = ny < 0.34 && brandWords.length && (colCount % 6 === 2);
          if (isBrand) {
            const bw = brandWords[brandIdx % brandWords.length];
            const candW = measureWord(bw) * em;
            if (fits(candW)) {
              chosen = bw;
              wNorm = candW;
              brandIdx++;
            }
          }
          for (let tries = 0; !chosen && tries < 14; tries++) {
            const cand = words[(wordIdx + tries) % words.length];
            const candW = measureWord(cand) * em;
            if (fits(candW)) {
              chosen = cand;
              wNorm = candW;
              wordIdx += tries + 1;
            }
          }
          if (!chosen) {
            nx += 0.45 * em;
            continue;
          }
          let rSum = 0, gSum = 0, bSum = 0, samples = 0;
          for (let s = 0; s <= 4; s++) {
            const sx = nx + wNorm * s / 4;
            if (sx <= 1 && isForeground(sx, ny)) {
              const [pr, pg, pb] = samplePx(sx, ny);
              rSum += pr; gSum += pg; bSum += pb; samples++;
            }
          }
          if (samples > 0) { rSum /= samples; gSum /= samples; bSum /= samples; }
          cells.push({
            x: nx,
            y: ny,
            w: wNorm,
            word: chosen,
            lum: 0.299 * rSum + 0.587 * gSum + 0.114 * bSum
          });
          nx += wNorm + gap;
          colCount++;
        }
      }
      return { cells, aspect, rows: numRows };
    }

    let offMaskCanvas = null;

    function draw() {
      if (!gridData || !imgEl) return;
      const ctx = canvas.getContext("2d");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const isMobile = cw < 720;
      let boxH = ch * (isMobile ? 0.84 : 0.97);
      let boxW = boxH / gridData.aspect;
      const maxW = cw * (isMobile ? 0.98 : 0.68);
      if (boxW > maxW) {
        boxW = maxW;
        boxH = boxW * gridData.aspect;
      }
      const boxX = isMobile ? (cw - boxW) / 2 : 0.58 * cw - boxW / 2;
      const boxY = ch - boxH;

      const zoomT = easeInOutCubic(clamp(progress / 0.78));
      const scale = lerp(6.8, 1, zoomT);
      const focusX = boxX + 0.48 * boxW;
      const focusY = boxY + 0.24 * boxH;
      const originX = lerp(cw / 2, focusX, zoomT);
      const originY = lerp(0.42 * ch, focusY, zoomT);
      const fontPx = (boxH / gridData.rows) * 0.9 * scale;
      if (fontPx < 2.2) return;

      const isDark = document.querySelector(".corner")?.getAttribute("data-theme") === "dark";
      const colorT = clamp((progress - 0.06) / 0.74);
      const photoFade = clamp((progress - 0.72) / 0.22);
      const spotR = Math.max(110, 0.16 * Math.min(cw, ch));
      const fScale = fontPx / 12;

      // Subtle warm ambient studio glow behind the word portrait as it zooms out, reducing stark white space
      if (studioColors && progress > 0.12 && photoFade < 1) {
        const [br, bg, bb] = studioColors.bgBase;
        const glowAlpha = clamp((progress - 0.12) / 0.58) * (1 - easeInOutCubic(photoFade)) * (isDark ? 0.28 : 0.22);
        if (glowAlpha > 0.005) {
          const gx = originX + (boxX + 0.5 * boxW - focusX) * scale;
          const gy = originY + (boxY + 0.42 * boxH - focusY) * scale;
          const gr = Math.max(cw, ch) * 0.75;
          const ambGrad = ctx.createRadialGradient(gx, gy, gr * 0.05, gx, gy, gr);
          ambGrad.addColorStop(0, `rgba(${br},${bg},${bb},${glowAlpha})`);
          ambGrad.addColorStop(0.55, `rgba(${br},${bg},${bb},${glowAlpha * 0.45})`);
          ambGrad.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
          ctx.fillStyle = ambGrad;
          ctx.fillRect(0, 0, cw, ch);
        }
      }

      const visible = [];
      for (const c of gridData.cells) {
        const vx = originX + (boxX + c.x * boxW - focusX) * scale;
        const vy = originY + (boxY + c.y * boxH - focusY) * scale;
        const vw = c.w * boxW * scale;
        if (vy < -fontPx || vy > ch + fontPx || vx > cw || vx + vw < 0) continue;
        let reveal = clamp(1.6 * colorT - 0.6 * c.y);
        if (pointer) {
          const dist = Math.hypot(vx + vw / 2 - pointer.x, vy - pointer.y);
          reveal = Math.max(reveal, 0.95 * clamp(1 - dist / spotR));
        }
        visible.push([c, vx, vy, reveal]);
      }

      const renderWords = (targetCtx, colorFn) => {
        targetCtx.setTransform(dpr * fScale, 0, 0, dpr * fScale, 0, 0);
        targetCtx.font = `600 12px ${fontStack}`;
        targetCtx.textBaseline = "middle";
        for (const [cell, vx, vy, rev] of visible) {
          const fill = colorFn(cell, rev);
          if (fill) {
            targetCtx.fillStyle = fill;
            targetCtx.fillText(cell.word, vx / fScale, vy / fScale);
          }
        }
      };

      // Base monochrome words
      renderWords(ctx, (cell, rev) => {
        if (rev >= 1) return null;
        const shadeVal = Math.round(isDark ? 75 + 0.25 * cell.lum : 160 - (128 - cell.lum) * 0.2);
        return `rgba(${shadeVal},${shadeVal},${shadeVal},${1 - rev})`;
      });

      // Photo-tinted words via source-in composite
      if (visible.some(v => v[3] > 0)) {
        if (!offMaskCanvas) offMaskCanvas = document.createElement("canvas");
        if (offMaskCanvas.width !== canvas.width || offMaskCanvas.height !== canvas.height) {
          offMaskCanvas.width = canvas.width;
          offMaskCanvas.height = canvas.height;
        }
        const mCtx = offMaskCanvas.getContext("2d");
        mCtx.setTransform(1, 0, 0, 1, 0, 0);
        mCtx.globalCompositeOperation = "source-over";
        mCtx.clearRect(0, 0, offMaskCanvas.width, offMaskCanvas.height);
        renderWords(mCtx, (_, rev) => rev > 0 ? `rgba(0,0,0,${rev})` : null);
        mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        mCtx.globalCompositeOperation = "source-in";
        mCtx.filter = isDark ? "brightness(1.35) contrast(1.4)" : "brightness(0.95) contrast(1.35)";
        mCtx.drawImage(
          imgEl,
          originX + (boxX - focusX) * scale,
          originY + (boxY - focusY) * scale,
          boxW * scale,
          boxH * scale
        );
        mCtx.filter = "none";
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(offMaskCanvas, 0, 0);
      }

      // Full-bleed studio backdrop + feathered portrait fade-in (eliminates white space & rectangular photo borders)
      if (fullImgEl && photoFade > 0) {
        const drawX = originX + (boxX - focusX) * scale;
        const drawY = originY + (boxY - focusY) * scale;
        const drawW = boxW * scale;
        const drawH = boxH * scale;
        const fadeAlpha = easeInOutCubic(photoFade);

        const cacheKey = `${cw}x${ch}:${Math.round(boxX)}:${Math.round(boxY)}:${Math.round(boxW)}:${Math.round(boxH)}`;
        if (studioColors && (!backdropCacheCanvas || backdropCacheKey !== cacheKey)) {
          if (!backdropCacheCanvas) backdropCacheCanvas = document.createElement("canvas");
          backdropCacheCanvas.width = Math.max(1, Math.round(cw));
          backdropCacheCanvas.height = Math.max(1, Math.round(ch));
          const bCtx = backdropCacheCanvas.getContext("2d");
          const { tl, tc, tr, ml, mr, bd, bgBase } = studioColors;

          // 1. Base full-viewport studio wall gradient matching Azeeza's studio portrait backdrop
          const wallGrad = bCtx.createLinearGradient(0, 0, cw, ch * 0.85);
          wallGrad.addColorStop(0, `rgb(${Math.round(tl[0] * 0.88)},${Math.round(tl[1] * 0.86)},${Math.round(tl[2] * 0.84)})`);
          wallGrad.addColorStop(0.38, `rgb(${ml[0]},${ml[1]},${ml[2]})`);
          wallGrad.addColorStop(0.62, `rgb(${bgBase[0]},${bgBase[1]},${bgBase[2]})`);
          wallGrad.addColorStop(1, `rgb(${Math.round(mr[0] * 0.94)},${Math.round(mr[1] * 0.92)},${Math.round(mr[2] * 0.90)})`);
          bCtx.fillStyle = wallGrad;
          bCtx.fillRect(0, 0, cw, ch);

          // 2. Radial studio key-light centered behind Azeeza
          const keyX = boxX + 0.5 * boxW;
          const keyY = boxY + 0.34 * boxH;
          const keyR = Math.max(cw, ch) * 0.82;
          const keyGrad = bCtx.createRadialGradient(keyX, keyY, boxW * 0.08, keyX, keyY, keyR);
          keyGrad.addColorStop(0, `rgba(${tc[0]},${tc[1]},${tc[2]},1)`);
          keyGrad.addColorStop(0.42, `rgba(${bgBase[0]},${bgBase[1]},${bgBase[2]},0.92)`);
          keyGrad.addColorStop(1, `rgba(${Math.round(tl[0] * 0.72)},${Math.round(tl[1] * 0.68)},${Math.round(tl[2] * 0.64)},0.85)`);
          bCtx.fillStyle = keyGrad;
          bCtx.fillRect(0, 0, cw, ch);

          // 3. Wide blurred ambient projection of the portrait (matches nanaamoako.com W.ext full-bleed extension)
          bCtx.save();
          bCtx.filter = "blur(54px)";
          bCtx.globalAlpha = 0.58;
          bCtx.drawImage(fullImgEl, boxX - 1.35 * boxW, boxY - 0.12 * boxH, boxW * 3.7, boxH * 1.24);
          bCtx.restore();

          // 4. Bottom studio floor / attire vignette so her black shoulders blend seamlessly across the bottom edge
          const botGrad = bCtx.createLinearGradient(0, ch * 0.66, 0, ch);
          botGrad.addColorStop(0, `rgba(${bd[0]},${bd[1]},${bd[2]},0)`);
          botGrad.addColorStop(0.65, `rgba(${bd[0]},${bd[1]},${bd[2]},0.48)`);
          botGrad.addColorStop(1, `rgba(${bd[0]},${bd[1]},${bd[2]},0.88)`);
          bCtx.fillStyle = botGrad;
          bCtx.fillRect(0, ch * 0.66, cw, ch * 0.34);

          backdropCacheKey = cacheKey;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = fadeAlpha;
        if (backdropCacheCanvas) {
          ctx.drawImage(backdropCacheCanvas, 0, 0, cw, ch);
        }
        ctx.drawImage(
          featheredHeroCanvas || fullImgEl,
          drawX,
          drawY,
          drawW,
          drawH
        );
        ctx.globalAlpha = 1;
      }

      // Update copy overlay scale & opacity
      const copyScale = lerp(1, 0.45, easeInOutCubic(clamp(progress / 0.32)));
      const subOpacity = 1 - clamp(progress / 0.18);
      if (copy) {
        copy.style.transform = `scale(${copyScale})`;
        if (progress > 0.78) copy.setAttribute("data-on-photo", "");
        else copy.removeAttribute("data-on-photo");
      }
      if (sub) sub.style.opacity = String(subOpacity);
      if (cue) cue.style.opacity = String(subOpacity);
      if (shade) shade.style.opacity = String(easeInOutCubic(photoFade));
      if (skipBtn) skipBtn.style.display = progress < 0.95 ? "" : "none";
    }

    function scheduleDraw() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(draw);
    }

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      progress = scrollable > 0 ? clamp(-rect.top / scrollable) : 1;
      scheduleDraw();
    };

    const onResize = () => {
      if (!imgEl) return;
      const targetRows = window.innerWidth < 720 ? 64 : 110;
      if (!gridData || gridData.rows !== targetRows) {
        gridData = buildWordCells(imgEl, DATA.heroWords, DATA.brandWords, targetRows);
      }
      onScroll();
    };

    const onPointerMove = e => {
      const r = stage.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      scheduleDraw();
    };
    const onPointerLeave = () => {
      pointer = null;
      scheduleDraw();
    };

    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    if (skipBtn) {
      skipBtn.onclick = () => {
        document.getElementById("after-hero")?.scrollIntoView({ behavior: "smooth" });
      };
    }

    // Load cutout and full portrait
    const cutout = new Image();
    cutout.crossOrigin = "anonymous";
    cutout.onload = () => {
      imgEl = cutout;
      const targetRows = window.innerWidth < 720 ? 64 : 110;
      gridData = buildWordCells(imgEl, DATA.heroWords, DATA.brandWords, targetRows);
      onScroll();
    };
    cutout.src = DATA.profile.portraitCutout;

    const full = new Image();
    full.crossOrigin = "anonymous";
    full.onload = () => {
      fullImgEl = full;
      buildFeatheredHeroAssets(full);
      scheduleDraw();
    };
    full.src = DATA.profile.portraitFull;

    registerCleanup(() => {
      cancelAnimationFrame(rafId);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    });
  }

  // --- PAGE 2: ROOM 01 - PEOPLE & HR ("/engineer") ---
  function renderEngineerPage() {
    const devFlagships = DATA.flagships;
    const cardsHtml = devFlagships.map((f, i) => `
      <div class="c-hl-card" tabindex="0" data-project-id="${f.id}">
        <div class="c-hl-media">
          <img src="${f.image}" alt="${f.name}" loading="lazy" style="object-position:${f.pos || 'center'}" />
        </div>
        <div class="c-hl-body">
          <span class="c-eyebrow" style="color:hsla(0,0%,100%,.75)">${f.year} · ${f.role}</span>
          <h3 class="c-hl-name">${f.name}</h3>
          <p class="c-hl-line">${f.line}</p>
          <div class="c-hl-tags">
            ${f.tags.map(t => `<span>${t}</span>`).join("")}
          </div>
        </div>
        <div class="c-hl-hover">
          <span class="c-hl-hint">Click to open full case study</span>
          <div class="c-hl-pbr">
            <span class="c-eyebrow">Challenge</span>
            <p>${f.problem}</p>
          </div>
          <div class="c-hl-pbr">
            <span class="c-eyebrow">What I built &amp; led</span>
            <p>${f.built}</p>
          </div>
          <div class="c-hl-pbr">
            <span class="c-eyebrow">Result</span>
            <p>${f.result}</p>
          </div>
        </div>
        <span class="c-hl-plus" aria-hidden="true">+</span>
      </div>
    `).join("");

    // Generate 52-week HR Operations & Analytics contribution heatmap SVG
    const cols = 42;
    let rectsHtml = "";
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 7; r++) {
        const seed = (c * 7 + r * 13 + 5) % 11;
        const lvl = seed > 8 ? 4 : seed > 6 ? 3 : seed > 3 ? 2 : seed > 1 ? 1 : 0;
        rectsHtml += `<rect x="${22 + c * 14}" y="${16 + r * 14}" width="11" height="11" rx="2.5" class="c-gg-cell" data-level="${lvl}" title="Week ${c + 1}: HRIS & Lifecycle Operations"></rect>`;
      }
    }

    return `
      <div class="c-eng-rain" data-phase="done" aria-hidden="true">
        <canvas id="matrix-rain-canvas" class="c-eng-rain-canvas"></canvas>
      </div>
      <section class="c-eng-hero c-above">
        <div class="c-eng-copy">
          <p class="c-eyebrow c-eng-late" data-in="true">Room 01 · People Operations, HRIS &amp; Analytics</p>
          <h1 class="c-eng-title c-druk" aria-label="I build systems that put people first.">
            <span id="eng-type-1">I build systems</span>
            <span class="c-accent" id="eng-type-2">that put people first.</span>
          </h1>
          <div class="c-eng-late" data-in="true">
            <p class="c-lede" style="margin-top:22px">
              HR Generalist &amp; Talent Management Analyst. Full-lifecycle people operations, HRIS automation (Seamless HR, Bamboo HR, Zoho, Freshdesk), and workforce analytics across 500+ field staff in 19 states.
            </p>
            <div style="display:flex;gap:10px;margin-top:26px;flex-wrap:wrap">
              <button class="c-btn c-btn-accent" onclick="document.getElementById('flagships').scrollIntoView({behavior:'smooth'})">See flagship initiatives ↓</button>
              <a class="c-btn" href="/work" data-nav="/work">The full catalogue</a>
              <button class="c-btn" data-open-cv="true">Open Master CV ↗</button>
            </div>
          </div>
        </div>
      </section>

      <section id="flagships" class="c-section c-above">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">Flagships</p>
              <h2 class="c-h2" style="margin-top:8px">The best of the best.</h2>
            </div>
            <p class="c-muted">Hover for the short version. Click any card for the full breakdown.</p>
          </div>
        </div>
        <div class="c-hl-track" id="eng-hl-track">
          ${cardsHtml}
        </div>
      </section>

      <section class="c-section c-above">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">HRIS &amp; People Analytics</p>
              <h2 class="c-h2" style="margin-top:8px">Measured in impact.</h2>
            </div>
          </div>
          <div class="c-grid c-grid-2" style="align-items:start">
            <div class="c-terminal c-gg">
              <div class="c-terminal-bar">
                <i style="background:#ff5f57"></i>
                <i style="background:#febc2e"></i>
                <i style="background:#28c840"></i>
                <span class="c-muted" style="margin-left:10px;font-size:12px">hris-analytics --lifecycle --states=19</span>
              </div>
              <div style="padding:22px">
                <p style="font-size:15px">
                  <b class="c-accent" style="font-size:26px;letter-spacing:-0.02em">500+ Field Staff</b>
                  <span class="c-muted"> managed across 19 states in Nigeria</span>
                </p>
                <div class="c-gg-scroll">
                  <svg viewBox="0 0 612 114" style="width:100%;min-width:520px;height:auto">
                    <text x="0" y="39" class="c-gg-label">Mon</text>
                    <text x="0" y="67" class="c-gg-label">Wed</text>
                    <text x="0" y="95" class="c-gg-label">Fri</text>
                    ${rectsHtml}
                  </svg>
                </div>
                <div class="c-gg-foot">
                  <span class="c-muted c-mono" style="font-size:12px">Recruitment · Onboarding · Confirmation · TNA · Monthly HR Reports</span>
                  <span class="c-gg-legend" aria-hidden="true">
                    <span class="c-muted">less</span>
                    <i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i>
                    <span class="c-muted">more</span>
                  </span>
                </div>
                <div class="c-gg-stats">
                  <div><b>+20%</b><span class="c-eyebrow">satisfaction lift</span></div>
                  <div><b>-20%</b><span class="c-eyebrow">response time</span></div>
                  <div><b>96%</b><span class="c-eyebrow">QA rating</span></div>
                  <div><b>4.8/5</b><span class="c-eyebrow">CSAT score</span></div>
                </div>
              </div>
            </div>

            <div class="c-terminal c-gh">
              <div class="c-terminal-bar">
                <i style="background:#ff5f57"></i>
                <i style="background:#febc2e"></i>
                <i style="background:#28c840"></i>
                <span class="c-muted" style="margin-left:10px;font-size:12px">systems-stack · azeeza-lawal</span>
              </div>
              <div style="padding:22px">
                <div class="c-gh-head">
                  <span class="c-gh-avatar">
                    <img src="${DATA.profile.portraitFull}" alt="Azeeza Lawal" width="64" height="64" />
                  </span>
                  <span>
                    <b style="font-size:18px">${DATA.profile.fullName}</b>
                    <span class="c-muted" style="display:block;font-size:14px">HRIS · People Analytics · PMP</span>
                  </span>
                </div>
                <div class="c-gh-stats">
                  <div><span class="c-stat c-accent">19</span><span class="c-eyebrow">States</span></div>
                  <div><span class="c-stat c-accent">30+</span><span class="c-eyebrow">Agents Trained</span></div>
                  <div><span class="c-stat c-accent">6</span><span class="c-eyebrow">Certifications</span></div>
                </div>
                <p class="c-eyebrow" style="margin:20px 0 6px">$ active-systems-and-competencies</p>
                <div class="c-gh-row"><span>Seamless HR &amp; Bamboo HR</span><span class="c-muted">Lifecycle &amp; Payroll</span></div>
                <div class="c-gh-row"><span>Freshdesk, Zoho &amp; Hodu</span><span class="c-muted">Operations &amp; Ticketing</span></div>
                <div class="c-gh-row"><span>HR Analytics &amp; Survey Analysis</span><span class="c-muted">Headcount &amp; Attrition</span></div>
                <div class="c-gh-row"><span>Compliance &amp; Nigerian Labour Laws</span><span class="c-muted">Employee Relations</span></div>
                <div class="c-gh-row"><span>Project Management (PMP)</span><span class="c-muted">Process Optimization</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="c-section c-above">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">Education, Certifications &amp; Awards</p>
              <h2 class="c-h2" style="margin-top:8px">The record.</h2>
            </div>
          </div>
          <ul class="c-record">
            ${DATA.record.map(r => `
              <li class="c-reveal" data-in="true">
                <span class="c-mono c-muted">${r.year}</span>
                <span>
                  <b>${r.title}</b>
                  <span class="c-muted">${r.note}</span>
                </span>
                <span class="c-tag">${r.kind}</span>
              </li>
            `).join("")}
          </ul>
        </div>
      </section>
    `;
  }

  function initMatrixRain() {
    const canvas = document.getElementById("matrix-rain-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const glyphs = "AZEEZALAWALHRIS500+19STATESMPAPMP";
    const fontSize = 16;
    let cols = 0;
    let drops = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / fontSize);
      drops = Array.from({ length: cols }, () => -40 * Math.random());
    };
    resize();

    const step = ts => {
      raf = requestAnimationFrame(step);
      if (ts - last < 55) return;
      last = ts;
      ctx.fillStyle = "rgba(5, 10, 6, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `14px "JetBrains Mono", monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        ctx.fillStyle = Math.random() > 0.95 ? "#e9ffef" : "#00ff66";
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.65;
      }
    };
    raf = requestAnimationFrame(step);
    window.addEventListener("resize", resize);
    registerCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    });
  }

  // --- PAGE 3: ROOM 02 - HIRE ME ("/hire") ---
  function renderHirePage(theme) {
    const logoSrc = theme === "dark" ? "/logo/azeeza-logo-white.svg" : "/logo/azeeza-logo-black.svg";
    const track = DATA.tracks[state.currentTrackIndex] || DATA.tracks[0];

    const expHtml = DATA.experiences.map(e => `
      <div class="c-venture">
        <span class="c-mono c-muted">${e.year}</span>
        <div>
          <h3 class="c-h3">${e.name} <span class="c-muted" style="font-weight:400;font-size:16px">· ${e.role}</span></h3>
          <p style="margin-top:8px">${e.what}</p>
          <ul class="c-venture-points">
            ${e.points.map(pt => `<li>${pt}</li>`).join("")}
          </ul>
          <p class="c-muted" style="margin-top:8px"><b style="color:var(--fg)">Impact:</b> ${e.happened}</p>
          <p class="c-muted" style="margin-top:4px"><b style="color:var(--fg)">Takeaway:</b> ${e.lesson}</p>
        </div>
        <span class="c-status" data-r="${e.result}"><i aria-hidden="true"></i>${e.result}</span>
      </div>
    `).join("");

    const caseCardsHtml = DATA.flagships.slice(0, 4).map(f => `
      <a class="c-card c-case-card" href="#case" data-project-id="${f.id}">
        <span class="thumb"><img src="${f.image}" alt="${f.name}" loading="lazy" /></span>
        <div style="padding:22px">
          <span class="c-eyebrow">${f.year} · ${f.role}</span>
          <h3 class="c-h3" style="margin-top:8px">${f.name}</h3>
          <p class="c-muted" style="margin-top:6px">${f.line}</p>
          <div class="c-work-meta" style="margin-top:14px">
            ${f.tags.slice(0, 4).map(t => `<span class="c-chip" style="height:28px;font-size:12px">${t}</span>`).join("")}
          </div>
        </div>
      </a>
    `).join("");

    const skillsHtml = DATA.skills.map(g => `
      <div>
        <dt class="c-eyebrow">${g.group}</dt>
        <dd>
          ${g.items.map(s => `<span class="c-chip" style="cursor:default">${s}</span>`).join("")}
        </dd>
      </div>
    `).join("");

    const venturesHtml = DATA.ventures.map(v => `
      <div class="c-venture">
        <span class="c-mono c-muted">${v.year}</span>
        <div>
          <h3 class="c-h3">${v.name} <span class="c-muted" style="font-weight:400;font-size:16px">· ${v.role}</span></h3>
          <p style="margin-top:8px">${v.what}</p>
          <ul class="c-venture-points">
            ${v.points.map(pt => `<li>${pt}</li>`).join("")}
          </ul>
          <p class="c-muted" style="margin-top:8px"><b style="color:var(--fg)">What happened:</b> ${v.happened}</p>
          <p class="c-muted" style="margin-top:4px"><b style="color:var(--fg)">What I learned:</b> ${v.lesson}</p>
        </div>
        <span class="c-status" data-r="${v.result}"><i aria-hidden="true"></i>${v.result}</span>
      </div>
    `).join("");

    return `
      <section class="c-mehero">
        <img src="${logoSrc}" alt="" class="c-mehero-logo" />
        <h1 class="c-mehero-name">${DATA.profile.name}</h1>
        <p class="c-mehero-iam">I am a <span id="scramble-role" class="c-mehero-role" aria-live="polite">${DATA.hireRoles[0]}</span></p>
        <p class="c-mehero-headline">${DATA.profile.headline} · ${DATA.profile.location}</p>
        <dl class="c-mehero-stats">
          ${DATA.hireStats.map(s => `
            <div>
              <dt>${s.label}</dt>
              <dd>${s.value}</dd>
            </div>
          `).join("")}
        </dl>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:12px">
          <button class="c-btn c-btn-primary" data-open-cv="true">View Master CV ${arrowRightSvg()}</button>
          <a class="c-btn" href="/cv" data-nav="/cv">${downloadSvg()} Printable / Download CV</a>
          <a class="c-btn" href="/commission?service=CV%20request" data-nav="/commission?service=CV%20request">Request a tailored CV</a>
          <a class="c-btn" href="${DATA.profile.linkedin}" target="_blank" rel="noreferrer">LinkedIn ↗</a>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-intro-card">
            <p class="c-eyebrow">Professional Summary &amp; Philosophy</p>
            <p class="c-intro-card-text">${DATA.profile.bio}</p>
          </div>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">Experience</p>
              <h2 class="c-h2" style="margin-top:8px">Where I've worked.</h2>
            </div>
            <button class="c-btn c-btn-primary" data-open-cv="true">Explore in Master CV Drawer →</button>
          </div>
          <div>
            ${expHtml}
          </div>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">Case studies</p>
              <h2 class="c-h2" style="margin-top:8px">Start with these.</h2>
            </div>
            <a class="c-btn" href="/work" data-nav="/work">Everything I've led →</a>
          </div>
          <div class="c-grid c-grid-2">
            ${caseCardsHtml}
          </div>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">Core Competencies</p>
              <h2 class="c-h2" style="margin-top:8px">What I work with.</h2>
            </div>
          </div>
          <dl class="c-skills">
            ${skillsHtml}
          </dl>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">Flagship Programs &amp; Leadership</p>
              <h2 class="c-h2" style="margin-top:8px">Initiatives I've spearheaded.</h2>
            </div>
          </div>
          <div>
            ${venturesHtml}
          </div>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">What I'm listening to</p>
              <h2 class="c-h2" style="margin-top:8px">On rotation right now.</h2>
            </div>
          </div>
          <div class="m-now" style="--m-light:#3b2d14;--m-dark:#0d0b08;--m-base:#1f180d">
            <div class="m-now-top">
              <div class="m-stage">
                <div class="m-sleeve-wrap" data-playing="${state.musicStatus === "playing"}">
                  <div class="m-record">
                    <div class="m-vinyl">
                      <div class="m-vinyl-spin" style="background:repeating-radial-gradient(circle at 50% 50%, #111 0px, #111 4px, #222 5px, #111 6px);animation-play-state:${state.musicStatus === "playing" ? "running" : "paused"}">
                        <div class="m-label">
                          <img src="${track.art}" alt="${track.title}" />
                        </div>
                        <div class="m-spindle"></div>
                      </div>
                    </div>
                  </div>
                  <div class="m-sleeve">
                    <img src="${track.art}" alt="${track.album}" />
                  </div>
                </div>
              </div>
              <div class="m-now-info">
                <p class="c-eyebrow" style="color:hsla(0,0%,100%,.7)">On rotation · Abuja Desk</p>
                <h3>${track.title}</h3>
                <p class="m-artist">${track.artist}</p>
                <p class="m-album">${track.album}</p>
                <p class="m-note">${track.note}</p>
                <div class="m-actions">
                  <button class="m-play" id="now-play-btn">
                    <span class="js-now-play-label">${state.musicStatus === "playing" ? "Pause preview" : "Play 30s preview"}</span>
                  </button>
                  ${DATA.tracks.map((t, idx) => `
                    <button class="m-link js-switch-track" data-track-idx="${idx}" style="${idx === state.currentTrackIndex ? 'border-color:#fff;background:hsla(0,0%,100%,.16)' : ''}">
                      0${idx + 1} · ${t.title}
                    </button>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="c-section">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">People Operations &amp; SDG Writing</p>
              <h2 class="c-h2" style="margin-top:8px">Public thinking.</h2>
            </div>
            <a class="c-btn" href="/writing" data-nav="/writing">All essays &amp; memos →</a>
          </div>
          <div class="c-grid c-grid-3">
            ${DATA.writings.map(w => `
              <a class="c-card" style="padding:28px" href="#read" data-article-id="${w.id}">
                <p class="c-eyebrow">${w.kicker}</p>
                <h3 class="c-h3" style="margin-top:10px">${w.title}</h3>
                <p class="c-muted" style="margin-top:8px">${w.subtitle}</p>
              </a>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function initRoleScramble() {
    const el = document.getElementById("scramble-role");
    if (!el) return;
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/&·";
    let idx = 0;
    let timer = setInterval(() => {
      idx = (idx + 1) % DATA.hireRoles.length;
      const target = DATA.hireRoles[idx];
      let step = 0;
      const maxSteps = target.length + 6;
      const iv = setInterval(() => {
        step++;
        let out = "";
        for (let i = 0; i < target.length; i++) {
          if (i < step - 4) out += target[i];
          else if (target[i] === " ") out += " ";
          else out += glyphs[Math.floor(Math.random() * glyphs.length)];
        }
        el.textContent = out;
        if (step >= maxSteps) {
          el.textContent = target;
          clearInterval(iv);
        }
      }, 28);
    }, 3000);
    registerCleanup(() => clearInterval(timer));
  }

  // --- PAGE 4: ROOM 03 - IMPACT, SDG ADVOCACY & MEDIA ("/creative") ---
  function renderCreativePage() {
    const creativeItems = DATA.flagships.filter(f => f.room === "creative" || f.id === "field-equity-500" || f.id === "engagement-retention-20");
    return `
      <section class="c-cz" id="creative-hero" style="height:210vh" aria-label="Impact, Advocacy &amp; Multimedia">
        <div class="c-cz-stage">
          <!-- Sticker 1: Made in Abuja / Nigeria -->
          <div class="c-stk" style="left:4%;top:8%;width:230px;transform:rotate(-4deg)">
            <span class="c-stk-loud">
              <svg viewBox="0 0 300 150" style="width:100%;height:auto;display:block">
                <g transform="rotate(-4 150 75)">
                  <rect x="18" y="22" width="264" height="106" rx="20" fill="#111" stroke="#fff" stroke-width="10"/>
                  <rect x="28" y="32" width="32" height="86" rx="8" fill="#008751"/>
                  <rect x="60" y="32" width="32" height="86" fill="#fff"/>
                  <rect x="92" y="32" width="32" height="86" rx="4" fill="#008751"/>
                  <text x="202" y="68" text-anchor="middle" font-family="Druk Wide, Bricolage Grotesque, sans-serif" font-size="15" font-weight="800" fill="#fff">BASED IN</text>
                  <text x="202" y="102" text-anchor="middle" font-family="Druk Wide, Bricolage Grotesque, sans-serif" font-size="24" font-weight="800" fill="#facc15">ABUJA, NG</text>
                </g>
              </svg>
            </span>
          </div>
          <!-- Sticker 2: SDG Goals -->
          <div class="c-stk" style="left:70%;top:6%;width:240px;transform:rotate(3deg)">
            <span class="c-stk-loud">
              <svg viewBox="0 0 300 110" style="width:100%;height:auto;display:block">
                <g transform="rotate(3 150 55)">
                  <rect x="10" y="14" width="280" height="82" rx="16" fill="#0b1b33" stroke="#fff" stroke-width="8"/>
                  <text x="150" y="48" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="13" font-weight="700" fill="#93c5fd">GLOBAL DONOR ADVOCACY</text>
                  <text x="150" y="78" text-anchor="middle" font-family="Druk Wide, Bricolage Grotesque, sans-serif" font-size="19" font-weight="800" fill="#4ade80">SDGs 2·5·7·8·13·17</text>
                </g>
              </svg>
            </span>
          </div>
          <!-- Sticker 3: Best Reporter PTCIJ -->
          <div class="c-stk" style="left:72%;top:80%;width:230px;transform:rotate(5deg)">
            <span class="c-stk-loud">
              <svg viewBox="0 0 270 120" style="width:100%;height:auto;display:block">
                <g transform="rotate(5 135 60)">
                  <rect x="14" y="20" width="242" height="80" rx="40" fill="#f472b6" stroke="#fff" stroke-width="10"/>
                  <text x="135" y="55" text-anchor="middle" font-family="Playfair Display, serif" font-style="italic" font-size="20" fill="#2a0718">PTCIJ Industry Winner</text>
                  <text x="135" y="84" text-anchor="middle" font-family="Druk Wide, Bricolage Grotesque, sans-serif" font-size="18" font-weight="800" fill="#2a0718">BEST REPORTER</text>
                </g>
              </svg>
            </span>
          </div>

          <div class="c-cz-card" id="cz-zoom-card" style="transform:scale(0.84);border-radius:24px">
            <div style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px;opacity:0.42">
              ${DATA.flagships.slice(0, 6).map(f => `
                <div style="border-radius:14px;overflow:hidden;position:relative">
                  <img src="${f.image}" alt="" style="width:100%;height:100%;object-fit:cover" />
                </div>
              `).join("")}
            </div>
            <div class="c-cz-focus" aria-live="polite">
              <span class="c-eyebrow">Global Donor Relations · SDG Advocacy · Multimedia Journalism</span>
              <b>Helping Africa Feed Itself &amp; Investigative Storytelling</b>
            </div>
            <div class="c-cz-title">
              <p class="c-eyebrow">Room 03 · Advocacy, Communications &amp; Media</p>
              <h1>Stories, advocacy<br /><span class="c-serif">&amp; human impact.</span></h1>
              <p class="c-cz-hint">Scroll to explore global donor SDG partnerships, agronomy literacy &amp; award-winning journalism ↓</p>
            </div>
          </div>
          <button class="c-cz-scroll" onclick="document.getElementById('selected-work').scrollIntoView({behavior:'smooth'})">Scroll ↓</button>
        </div>
      </section>

      <section id="selected-work" class="c-section">
        <div class="c-wrap">
          <div class="c-reveal c-head" data-in="true">
            <div>
              <p class="c-eyebrow">Selected work</p>
              <h2 class="c-h2" style="margin-top:8px">The highlight reel.</h2>
            </div>
            <a class="c-btn c-btn-accent" href="/work" data-nav="/work">Browse everything →</a>
          </div>
        </div>
        <div class="c-hl-track">
          ${creativeItems.map(f => `
            <div class="c-hl-card" tabindex="0" data-project-id="${f.id}">
              <div class="c-hl-media"><img src="${f.image}" alt="${f.name}" loading="lazy" /></div>
              <div class="c-hl-body">
                <span class="c-eyebrow" style="color:hsla(0,0%,100%,.75)">${f.year} · ${f.role}</span>
                <h3 class="c-hl-name">${f.name}</h3>
                <p class="c-hl-line">${f.line}</p>
                <div class="c-hl-tags">${f.tags.map(t => `<span>${t}</span>`).join("")}</div>
              </div>
              <div class="c-hl-hover">
                <span class="c-hl-hint">Click to open case study</span>
                <div class="c-hl-pbr"><span class="c-eyebrow">The Mandate</span><p>${f.problem}</p></div>
                <div class="c-hl-pbr"><span class="c-eyebrow">My Role &amp; Execution</span><p>${f.built}</p></div>
                <div class="c-hl-pbr"><span class="c-eyebrow">Impact</span><p>${f.result}</p></div>
              </div>
              <span class="c-hl-plus" aria-hidden="true">+</span>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="c-section c-chapter">
        <div class="c-wrap">
          <div class="c-reveal c-chapter-head" data-in="true">
            <p class="c-eyebrow">Chapter 01 · Global Donor Collaboration &amp; SDG Advocacy</p>
            <h2 class="c-druk">Helping Africa feed itself</h2>
            <p class="c-muted">Strategic Sustainable Development Goal (SDG) partnerships with the Bill &amp; Melinda Gates Foundation and Bayer Foundations at AFEX Fair Trade Ltd.</p>
          </div>
          <div class="c-grid c-grid-3">
            <div class="c-card">
              <span class="c-tag">Gates &amp; Bayer Foundations</span>
              <h3 class="c-h3" style="margin-top:12px">Global Donor Collaboration</h3>
              <p class="c-muted" style="margin-top:8px">Managed strategic Sustainable Development Goal initiatives in direct partnership with major international donor agencies including the Bill &amp; Melinda Gates Foundation and Bayer Foundations.</p>
            </div>
            <div class="c-card">
              <span class="c-tag">SDGs 2, 5, 7, 8, 13 &amp; 17</span>
              <h3 class="c-h3" style="margin-top:12px">Multi-Goal Advocacy &amp; Rural Literacy</h3>
              <p class="c-muted" style="margin-top:8px">Led rural literacy and advocacy programs aligned with Zero Hunger (2), Gender Equality (5), Clean Energy (7), Decent Work (8), Climate Action (13), and Partnerships (17).</p>
            </div>
            <div class="c-card">
              <span class="c-tag">Smallholder Resilience</span>
              <h3 class="c-h3" style="margin-top:12px">Agronomy Literacy &amp; Coalitions</h3>
              <p class="c-muted" style="margin-top:8px">Designed training programs helping smallholder farmers adopt best-practice agronomy to improve yield and economic resilience across public, private, and non-profit sectors.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="c-section c-chapter">
        <div class="c-wrap">
          <div class="c-reveal c-chapter-head" data-in="true">
            <p class="c-eyebrow">Chapter 02 · Investigative Journalism &amp; Multimedia Growth</p>
            <h2 class="c-druk">Stories that move the needle</h2>
            <p class="c-muted">Three and a half years leading investigative documentaries and multimedia strategy at Search Media (2016–2019).</p>
          </div>
          <div class="c-grid c-grid-2">
            <div class="c-card" style="padding:32px">
              <p class="c-eyebrow">Premium Times Centre For Investigative Journalism</p>
              <h3 class="c-h2" style="margin-top:10px">+45% Viewership &amp; Best Reporter Award</h3>
              <p class="c-muted" style="margin-top:12px">Led an investigative documentary team whose reporting increased viewership by 45% and earned the prestigious industry award for Best Reporter by the Premium Times Centre For Investigative Journalism (PTCIJ).</p>
            </div>
            <div class="c-card" style="padding:32px">
              <p class="c-eyebrow">Multimedia Strategy &amp; Commercial Growth</p>
              <h3 class="c-h2" style="margin-top:10px">+50% Social Growth &amp; +20% Ad Revenue</h3>
              <p class="c-muted" style="margin-top:12px">Designed and executed multimedia audience development campaigns that achieved 50% social media growth and a 20% boost in advertising revenue.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="c-create">
        <div class="c-create-glow" aria-hidden="true"></div>
        <div class="c-create-inner">
          <p class="c-eyebrow">Let's build together</p>
          <h2 class="c-druk">Ready to elevate your people &amp; impact?</h2>
          <p>Whether you're scaling HR operations, designing employee engagement systems, or leading SDG &amp; stakeholder communications—let's talk.</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:10px">
            <a class="c-btn c-create-btn" href="/commission" data-nav="/commission">Work with me →</a>
            <a class="c-btn c-create-btn-ghost" href="/hire" data-nav="/hire">View Experience &amp; CV</a>
          </div>
        </div>
      </section>
    `;
  }

  // --- PAGE 5: CATALOGUE ("/work") ---
  function renderWorkPage() {
    const q = state.workSearch.trim().toLowerCase();
    const filter = state.workFilter;
    const allItems = DATA.flagships.filter(item => {
      if (filter !== "all" && item.room !== filter && item.category.toLowerCase() !== filter.toLowerCase()) return false;
      if (!q) return true;
      const hay = `${item.name} ${item.line} ${item.role} ${item.category} ${item.tags.join(" ")} ${item.problem} ${item.built} ${item.result}`.toLowerCase();
      return hay.includes(q);
    });

    const categories = ["all", "People Operations", "HR Analytics", "HRIS Systems", "SDG & Donor Strategy", "Process Optimization", "Journalism & Media", "Service Excellence", "Education & Leadership"];

    return `
      <section class="c-section c-page-top">
        <div class="c-wrap">
          <p class="c-eyebrow">The catalogue</p>
          <h1 class="c-display" style="margin-top:10px">Everything I've led.</h1>
          <p class="c-lede" style="margin-top:14px">Search and filter across HR operations, 19-state field equity initiatives, HRIS implementations, global donor SDG programs, and award-winning investigative journalism.</p>

          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:28px;align-items:center">
            <div class="c-search">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path></svg>
              <input id="work-search-input" type="search" placeholder="Search 500+ staff, HRIS, Seamless HR, SDG, Gates, PMP, Journalism…" value="${state.workSearch.replace(/"/g, '&quot;')}" />
            </div>
          </div>

          <div class="c-chips" style="margin-top:16px">
            ${categories.map(cat => `
              <button class="c-chip js-work-cat" data-cat="${cat}" aria-pressed="${state.workFilter === cat}">
                ${cat === "all" ? "All (" + DATA.flagships.length + ")" : cat}
              </button>
            `).join("")}
          </div>

          <div class="c-grid c-grid-3" style="margin-top:36px">
            ${allItems.map(item => `
              <button class="c-card c-work-card" data-project-id="${item.id}">
                <div class="thumb">
                  <img src="${item.image}" alt="${item.name}" loading="lazy" style="object-position:${item.pos || 'center'}" />
                </div>
                <div class="body">
                  <span class="c-eyebrow">${item.year} · ${item.category}</span>
                  <h3 style="margin-top:6px">${item.name}</h3>
                  <p>${item.line}</p>
                  <div class="c-work-meta">
                    ${item.tags.slice(0, 3).map(t => `<span class="c-tag">${t}</span>`).join("")}
                  </div>
                </div>
              </button>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  // --- PAGE 6: WRITING & REPORTS ("/writing") ---
  function renderWritingPage() {
    return `
      <section class="c-section c-page-top c-letters">
        <div class="c-wrap">
          <p class="c-eyebrow">Insights, Case Memos &amp; Reports</p>
          <h1 class="c-display" style="margin-top:10px;font-family:var(--font-serif);font-weight:500">Notes on People, Culture &amp; Impact.</h1>
          <p class="c-lede" style="margin-top:14px">Field notes from managing employee lifecycle across 19 Nigerian states, partnering with global SDG donors, and leading investigative journalism.</p>

          <div style="margin-top:44px;border-top:1px solid var(--border)">
            ${DATA.writings.map(w => `
              <a class="c-essay-row" href="#read-${w.id}" data-article-id="${w.id}">
                <span class="c-mono c-muted">${w.date}</span>
                <div>
                  <p class="c-eyebrow">${w.kicker}</p>
                  <h3 style="margin-top:6px">${w.title}</h3>
                  <p class="c-muted" style="margin-top:8px">${w.subtitle}</p>
                </div>
                <span class="c-btn c-btn-sm">Read memo →</span>
              </a>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  // --- PAGE 7: COMMISSION / WORK WITH ME ("/commission") ---
  function renderCommissionPage() {
    const urlService = new URLSearchParams(window.location.search).get("service") || "HR Advisory & Operations";
    const services = [
      "HR Advisory & Operations",
      "Talent & Onboarding Audit",
      "Employee Engagement Survey",
      "HRIS Implementation (Seamless/Bamboo/Zoho)",
      "SDG & Donor Communications",
      "Multimedia Strategy",
      "CV request",
      "Full-time / Leadership Role"
    ];

    return `
      <section class="c-section c-page-top">
        <div class="c-wrap c-commission">
          <div class="c-commission-main">
            <p class="c-eyebrow">Collaborate &amp; Connect</p>
            <h1 class="c-druk c-commission-title">Let's build a people-first workplace.</h1>
            <p class="c-lede" style="margin:18px 0 28px">Available for HR Generalist, Talent Management, People Operations, and SDG Communications roles or consulting engagements in Abuja and globally.</p>

            <form id="commission-form" class="c-commission-form">
              <div class="c-form-row">
                <div class="c-field">
                  <label for="f-name">Your name</label>
                  <input id="f-name" class="c-input" required placeholder="Adaeze Okafor" />
                </div>
                <div class="c-field">
                  <label for="f-email">Email</label>
                  <input id="f-email" type="email" class="c-input" required placeholder="you@organization.com" />
                </div>
              </div>
              <div class="c-field">
                <label>What would you like to discuss?</label>
                <div class="c-chips" style="flex-wrap:wrap">
                  ${services.map(s => `
                    <button type="button" class="c-chip js-comm-chip" aria-pressed="${s === urlService}">${s}</button>
                  `).join("")}
                </div>
              </div>
              <div class="c-form-row">
                <div class="c-field">
                  <label for="f-org">Organization / Company</label>
                  <input id="f-org" class="c-input" placeholder="Company or Foundation name" />
                </div>
                <div class="c-field">
                  <label for="f-timeline">Timeline</label>
                  <select id="f-timeline" class="c-input">
                    <option value="Immediate">Immediate / This month</option>
                    <option value="Q1/Q2">Next quarter</option>
                    <option value="Flexible">Flexible / Exploratory</option>
                  </select>
                </div>
              </div>
              <div class="c-field">
                <label for="f-msg">Tell me about the role or project</label>
                <textarea id="f-msg" class="c-textarea" required placeholder="Share details about the team, goals, or what you'd like us to achieve together…"></textarea>
              </div>
              <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
                <button type="submit" class="c-btn c-btn-accent">Send message →</button>
                <a class="c-btn" href="mailto:${DATA.profile.email}">Or email ${DATA.profile.email}</a>
              </div>
              <div id="comm-success" class="c-card" style="display:none;padding:24px;border-color:var(--accent)"></div>
            </form>
          </div>

          <aside class="c-insta">
            <div class="c-insta-head">
              <img src="${DATA.profile.portraitFull}" alt="${DATA.profile.fullName}" />
              <div>
                <b>${DATA.profile.fullName}</b>
                <span class="c-muted" style="font-size:13px">${DATA.profile.location} · ${DATA.profile.phone}</span>
                <span class="c-eyebrow" style="margin-top:4px;color:var(--accent)">International MBA · PMP · HR Generalist</span>
              </div>
            </div>
            <div class="c-gallery" style="--cols:3">
              ${DATA.flagships.slice(0, 6).map(f => `
                <button class="c-gallery-item" style="aspect-ratio:1" data-project-id="${f.id}">
                  <img src="${f.image}" alt="${f.name}" loading="lazy" />
                </button>
              `).join("")}
            </div>
            <div style="padding:18px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border)">
              <span class="c-eyebrow">Direct Contact</span>
              <a class="c-btn c-btn-sm" href="${DATA.profile.linkedin}" target="_blank" rel="noreferrer">LinkedIn Profile ↗</a>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  // --- PAGE 8: PRINTABLE / DOWNLOADABLE A4 CV ("/cv") ---
  function renderPrintableCVPage() {
    return `
      <section class="c-section c-page-top">
        <div class="c-wrap">
          <div class="c-studio-bar">
            <span class="c-eyebrow" style="padding-left:8px">Official Curriculum Vitae · ${DATA.profile.fullName}</span>
            <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
              <button class="c-btn c-btn-sm" data-open-cv="true">Open Interactive Master CV Drawer</button>
              <button class="c-btn c-btn-sm c-btn-primary" onclick="window.print()">${downloadSvg()} Print / Save as PDF</button>
            </div>
          </div>

          <article class="c-cvp" style="position:static;max-height:none;max-width:860px;margin:24px auto">
            <header>
              <h2>${DATA.profile.fullName}</h2>
              <p style="font-weight:600;color:#222;margin-top:4px">HR Generalist | Talent Management | Employee Relations</p>
              <p>${DATA.profile.location} | ${DATA.profile.phone} | <a href="mailto:${DATA.profile.email}">${DATA.profile.email}</a> | <a href="${DATA.profile.linkedin}" target="_blank" rel="noreferrer">linkedin.com/in/azeeza-muhammad-lawal/</a></p>
              <p style="margin-top:4px"><b>Languages:</b> ${DATA.profile.languages.join(", ")}</p>
            </header>

            <section class="c-cvp-sec">
              <h3>Professional Summary</h3>
              <p>${DATA.profile.summary}</p>
            </section>

            <section class="c-cvp-sec">
              <h3>Core Competencies</h3>
              <ul>
                <li><b>People Operations:</b> Recruitment &amp; Onboarding, Employee Relations &amp; Conflict Resolution, Performance Management, Compliance &amp; Labour Laws, Employee Engagement &amp; Retention, Payroll Support &amp; Leave Management</li>
                <li><b>Tools and Systems:</b> Microsoft Office Suite / Google Workspace, HRIS Platforms (Seamless HR, Bamboo HR), HR Analytics &amp; Reporting, Survey &amp; Data Analysis, Project Management (PMP), Freshdesk, Zoho, Hodu</li>
                <li><b>Strategic Growth:</b> Stakeholder Management, SDG Advocacy, Process Optimization, Multimedia Strategy.</li>
              </ul>
            </section>

            <section class="c-cvp-sec">
              <h3>Professional Experience</h3>
              ${DATA.experiences.map(e => `
                <div class="c-cvp-item">
                  <div class="c-cvp-row">
                    <b>${e.role} | ${e.name}</b>
                    <span>${e.year}</span>
                  </div>
                  <ul>
                    ${e.points.map(p => `<li>${p}</li>`).join("")}
                  </ul>
                </div>
              `).join("")}
            </section>

            <section class="c-cvp-sec">
              <h3>Education &amp; Certifications</h3>
              <ul>
                <li><b>International MBA</b> | Rome Business School, Rome <span style="float:right;color:#666">2024</span></li>
                <li><b>B. Tech, Transport Management Technology</b> | Federal University of Technology, Minna <span style="float:right;color:#666">2019</span></li>
                <li><b>Business Leadership Development Program</b> | Rome Business School <span style="float:right;color:#666">2023</span></li>
                <li><b>Human Resource Manager</b> | Dexter and Heros Consulting Ltd <span style="float:right;color:#666">2021</span></li>
                <li><b>Project Management Professional (PMP)</b> | Dexter and Heros Consulting Ltd <span style="float:right;color:#666">2021</span></li>
                <li><b>Customer Support Representative Certification</b> | Dexter and Heros Consulting Ltd <span style="float:right;color:#666">2021</span></li>
              </ul>
            </section>
          </article>
        </div>
      </section>
    `;
  }

  // --- MODALS: Word Peek, Project Case Study, Article Reader, and Master CV Drawer ---
  function renderModals(theme) {
    let html = "";

    // 1. Word Peek Modal ("I am a ...")
    if (state.peekWord) {
      const q = (state.peekWord.q || state.peekWord.w).toLowerCase();
      const matches = DATA.flagships.filter(f => {
        const hay = `${f.name} ${f.line} ${f.role} ${f.category} ${f.tags.join(" ")} ${f.problem} ${f.built}`.toLowerCase();
        return hay.includes(q) || q.split(/\s+/).some(tok => tok.length > 2 && hay.includes(tok));
      });
      const shown = matches.length ? matches : DATA.flagships.slice(0, 4);

      html += `
        <div class="c-peek-root" role="dialog" aria-modal="true" aria-label="I am a ${state.peekWord.w}">
          <div class="c-peek-bg" data-close-peek="true"></div>
          <div class="c-peek" tabindex="-1">
            <div class="c-peek-bar">
              <span class="c-eyebrow">I am a…</span>
              <div style="display:flex;gap:4px">
                <a href="/work?q=${encodeURIComponent(state.peekWord.q || state.peekWord.w)}" data-nav="/work?q=${encodeURIComponent(state.peekWord.q || state.peekWord.w)}" class="c-peek-btn">
                  ${expandSvg()} <span>Expand in Catalogue</span>
                </a>
                <button class="c-peek-btn" data-close-peek="true" aria-label="Close">${closeSvg()}</button>
              </div>
            </div>
            <div class="c-peek-body">
              <div class="c-wordpeek">
                <p class="c-eyebrow">I am a</p>
                <h2 class="c-wordpeek-title">${state.peekWord.w}</h2>
                <div class="c-wordpeek-grid">
                  ${shown.map(item => `
                    <a href="#project-${item.id}" class="c-wordpeek-card" data-project-id="${item.id}">
                      <span class="thumb"><img src="${item.image}" alt="${item.name}" loading="lazy" style="object-position:${item.pos || 'center'}" /></span>
                      <span class="meta">
                        <b>${item.name}</b>
                        <small>${item.year} · ${item.role}</small>
                      </span>
                    </a>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 2. Project Case Study Modal
    if (state.peekProject) {
      const p = state.peekProject;
      html += `
        <div class="c-peek-root" role="dialog" aria-modal="true" aria-label="${p.name}">
          <div class="c-peek-bg" data-close-peek="true"></div>
          <div class="c-peek" tabindex="-1">
            <div class="c-peek-bar">
              <span class="c-eyebrow">${p.category} · ${p.year}</span>
              <div style="display:flex;gap:4px">
                <button class="c-peek-btn" data-open-cv="true"><span>View in Master CV</span></button>
                <button class="c-peek-btn" data-close-peek="true" aria-label="Close">${closeSvg()}</button>
              </div>
            </div>
            <div class="c-peek-body">
              <div class="c-doc-banner" style="${p.fullDoc ? 'aspect-ratio:16/9;background:#0a1936;padding:12px 24px' : (p.bannerAspect ? `aspect-ratio:${p.bannerAspect}` : '')}">
                <img src="${p.image}" alt="${p.name}" style="${p.fullDoc ? 'object-fit:contain;border-radius:8px' : `object-position:${p.pos || 'center'}`}" />
              </div>
              <div class="c-doc-inner" style="padding-top:28px">
                <span class="c-tag">${p.role}</span>
                <h2 class="c-doc-title">${p.name}</h2>
                <p class="c-doc-sub">${p.line}</p>
                <div class="c-doc-pbr">
                  <div>
                    <span class="c-eyebrow">The Challenge</span>
                    <p>${p.problem}</p>
                  </div>
                  <div>
                    <span class="c-eyebrow">What I Built &amp; Led</span>
                    <p>${p.built}</p>
                  </div>
                  <div>
                    <span class="c-eyebrow">Measurable Result</span>
                    <p>${p.result}</p>
                  </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:18px">
                  ${p.tags.map(t => `<span class="c-doc-pill">${t}</span>`).join("")}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 3. Article / Memo Reader Modal
    if (state.peekArticle) {
      const a = state.peekArticle;
      html += `
        <div class="c-peek-root" role="dialog" aria-modal="true" aria-label="${a.title}">
          <div class="c-peek-bg" data-close-peek="true"></div>
          <div class="c-peek" tabindex="-1">
            <div class="c-peek-bar">
              <span class="c-eyebrow">${a.kicker}</span>
              <div style="display:flex;gap:4px">
                <button class="c-peek-btn" data-close-peek="true" aria-label="Close">${closeSvg()}</button>
              </div>
            </div>
            <div class="c-peek-body">
              <div class="c-doc-banner" style="${a.fullDoc ? 'aspect-ratio:16/9;background:#0a1936;padding:12px 24px' : ''}">
                <img src="${a.image}" alt="${a.title}" style="${a.fullDoc ? 'object-fit:contain;border-radius:8px' : ''}" />
              </div>
              <div class="c-doc-inner c-prose" style="padding-top:28px">
                <p class="c-eyebrow">${a.date} · By ${DATA.profile.fullName}</p>
                <h2 class="c-doc-title" style="margin-bottom:8px">${a.title}</h2>
                <p class="c-doc-sub" style="margin-bottom:24px">${a.subtitle}</p>
                ${a.sections.map(s => `
                  <h2>${s.h}</h2>
                  <p>${s.p}</p>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 4. Full-Screen Slide-Down Master CV Modal (`c-cvd`) + Right Slide-Out Entry Detail Drawer
    if (state.cvOpen) {
      const catMeta = {
        work_experience: { label: "Work Experience", color: "#16a34a", bg: "rgba(34,197,94,0.14)" },
        education: { label: "Education", color: "#2563eb", bg: "rgba(59,130,246,0.14)" },
        certification: { label: "Certification", color: "#d97706", bg: "rgba(245,158,11,0.15)" },
        award: { label: "Award & Honours", color: "#db2777", bg: "rgba(236,72,153,0.15)" }
      };

      const q = state.cvSearch.trim().toLowerCase();
      let rows = DATA.masterCV.filter(e => {
        if (state.cvCategory !== "all" && e.category !== state.cvCategory) return false;
        if (!q) return true;
        const hay = `${e.title} ${e.organization} ${e.role} ${e.description} ${e.skills_tools.join(" ")} ${e.achievements.join(" ")}`.toLowerCase();
        return hay.includes(q);
      });

      const logoSrc = theme === "dark" ? "/logo/azeeza-logo-white.svg" : "/logo/azeeza-logo-black.svg";
      const rowBg = theme === "dark" ? "#0c0a0a" : "#fafafa";
      const textMain = theme === "dark" ? "#f3f3f3" : "#111";
      const textSub = theme === "dark" ? "#9b9b9b" : "#555";
      const borderCol = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

      html += `
        <div data-cv-theme="${theme}">
          <div class="c-cvd-bg" id="cvd-backdrop"></div>
          <div class="c-cvd" role="dialog" aria-modal="true" aria-label="Master CV">
            <div class="c-cvd-bar">
              <div style="display:flex;align-items:center;gap:12px">
                <img src="${logoSrc}" alt="" width="26" height="26" />
                <div>
                  <b>Master CV · ${DATA.profile.fullName}</b>
                  <small>${DATA.masterCV.length} entries · every role, degree, certification &amp; award (click any row to inspect)</small>
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <a href="/cv" data-nav="/cv" class="c-cvd-btn"><span>Printable A4 CV</span></a>
                <button class="c-cvd-btn" id="cvd-close-btn" aria-label="Close (Esc)">${closeSvg(16)}</button>
              </div>
            </div>
            <div class="c-cvd-body" style="display:flex;flex-direction:column;background:${rowBg};color:${textMain}">
              <div style="padding:12px 20px;border-bottom:1px solid ${borderCol};display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                <input id="cvd-search-input" type="search" placeholder="Filter roles, skills, organizations (e.g. AFEX, MBA, PMP, Seamless HR)…" value="${state.cvSearch.replace(/"/g, '&quot;')}" style="flex:1;min-width:220px;height:36px;padding:0 12px;border-radius:8px;border:1px solid ${borderCol};background:transparent;color:inherit;font-size:13px" />
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${[["all", "All"], ["work_experience", "Experience"], ["education", "Education"], ["certification", "Certifications"], ["award", "Awards"]].map(([k, lbl]) => `
                    <button class="c-cvd-btn js-cv-cat" data-cv-cat="${k}" style="${state.cvCategory === k ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : ''}">${lbl}</button>
                  `).join("")}
                </div>
              </div>
              <div style="flex:1;overflow:auto">
                <table style="width:100%;border-collapse:collapse;min-width:820px;font-size:13.5px">
                  <thead>
                    <tr style="border-bottom:1px solid ${borderCol};text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${textSub}">
                      <th style="padding:12px 16px">Category</th>
                      <th style="padding:12px 16px">Title / Credential</th>
                      <th style="padding:12px 16px">Organization</th>
                      <th style="padding:12px 16px">Duration</th>
                      <th style="padding:12px 16px">Skills &amp; Tools</th>
                      <th style="padding:12px 16px">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map(r => {
                      const cm = catMeta[r.category] || { label: r.category, color: "#888", bg: "rgba(128,128,128,0.15)" };
                      return `
                        <tr class="js-cv-row" data-cv-id="${r.id}" style="border-bottom:1px solid ${borderCol};cursor:pointer;transition:background .15s">
                          <td style="padding:13px 16px">
                            <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;color:${cm.color};background:${cm.bg}">${cm.label}</span>
                          </td>
                          <td style="padding:13px 16px;font-weight:600">${r.title}</td>
                          <td style="padding:13px 16px;color:${textSub}">${r.organization}</td>
                          <td style="padding:13px 16px;color:${textSub};font-family:var(--font-mono);font-size:12px">${r.duration.label}</td>
                          <td style="padding:13px 16px">
                            <div style="display:flex;gap:4px;flex-wrap:wrap">
                              ${r.skills_tools.slice(0, 3).map(s => `<span style="padding:2px 7px;border-radius:4px;font-size:11px;border:1px solid ${borderCol};color:${textSub}">${s}</span>`).join("")}
                              ${r.skills_tools.length > 3 ? `<span style="font-size:11px;color:${textSub}">+${r.skills_tools.length - 3}</span>` : ""}
                            </div>
                          </td>
                          <td style="padding:13px 16px">
                            <div style="display:flex;align-items:center;gap:6px">
                              <div style="width:48px;height:6px;border-radius:4px;background:${borderCol};overflow:hidden">
                                <div style="width:${r.impact_rating * 10}%;height:100%;background:#22c55e"></div>
                              </div>
                              <span style="font-size:11px;color:${textSub}">${r.impact_rating}/10</span>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          ${state.cvSelectedEntry ? renderCVEntryDrawer(state.cvSelectedEntry, catMeta, theme) : ""}
        </div>
      `;
    }

    return html;
  }

  function renderCVEntryDrawer(entry, catMeta, theme) {
    const cm = catMeta[entry.category] || { label: entry.category, color: "#16a34a", bg: "rgba(34,197,94,0.14)" };
    const drawerBg = theme === "dark" ? "#141210" : "#ffffff";
    const textMain = theme === "dark" ? "#f5f5f5" : "#111111";
    const textSub = theme === "dark" ? "#a3a3a3" : "#555555";
    const borderCol = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

    return `
      <div class="c-drawer-bg" id="cv-entry-drawer-bg" style="z-index:110"></div>
      <aside class="c-drawer" style="z-index:111;background:${drawerBg};color:${textMain};padding:32px;border-left:1px solid ${borderCol}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;color:${cm.color};background:${cm.bg}">${cm.label}</span>
          <button class="c-cvd-btn" id="cv-entry-drawer-close">${closeSvg(16)}</button>
        </div>
        <h2 style="font-family:var(--font-serif);font-size:28px;margin-top:16px;line-height:1.2">${entry.title}</h2>
        <p style="color:${textSub};margin-top:8px;font-size:14px">${entry.organization} · ${entry.location} · <span class="c-mono">${entry.duration.label}</span></p>
        <hr style="border:0;border-top:1px solid ${borderCol};margin:20px 0" />
        <p style="line-height:1.65;font-size:15px">${entry.description}</p>
        <h3 class="c-eyebrow" style="margin:24px 0 10px">Key Achievements &amp; Highlights</h3>
        <ul style="padding-left:18px;display:grid;gap:8px;color:${textSub};font-size:14.5px">
          ${entry.achievements.map(a => `<li style="color:${textSub}">${a}</li>`).join("")}
        </ul>
        <h3 class="c-eyebrow" style="margin:24px 0 10px">Skills &amp; Tools Applied</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${entry.skills_tools.map(s => `<span style="padding:5px 11px;border-radius:8px;font-size:12px;border:1px solid ${borderCol}">${s}</span>`).join("")}
        </div>
      </aside>
    `;
  }

  // --- Dock Scroll Behavior ("Explore another side of me" expansion at bottom) ---
  function initDockScroll() {
    const dock = document.getElementById("main-dock");
    const explore = document.getElementById("dock-explore");
    const czCard = document.getElementById("cz-zoom-card");
    const czHero = document.getElementById("creative-hero");
    if (!dock) return;

    let scrollTimeout = 0;
    const onScroll = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 64 && window.scrollY > 200;
      const scrollingDown = window.scrollY > 140 && !atBottom;
      dock.setAttribute("data-big", atBottom ? "true" : "false");
      dock.setAttribute("data-hidden", scrollingDown ? "true" : "false");
      if (explore) {
        explore.setAttribute("data-show", atBottom ? "true" : "false");
        explore.setAttribute("aria-hidden", atBottom ? "false" : "true");
      }
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        dock.setAttribute("data-hidden", "false");
      }, 240);

      // Creative page scroll-zoom card
      if (czCard && czHero) {
        const rect = czHero.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
        const v = 1 - Math.pow(1 - Math.min(1, p / 0.85), 3);
        czCard.style.transform = `scale(${0.68 + 0.32 * v})`;
        czCard.style.borderRadius = `${32 * (1 - v)}px`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    registerCleanup(() => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimeout);
    });
  }

  // --- Main Render & Event Wiring ---
  function render() {
    runCleanups();
    const root = document.getElementById("app-root");
    if (!root) return;

    const room = getRoom(state.path);
    const theme = getEffectiveTheme(room);

    let pageHtml = "";
    if (state.path.startsWith("/engineer") || state.path.startsWith("/developer")) {
      pageHtml = renderEngineerPage();
    } else if (state.path.startsWith("/creative")) {
      pageHtml = renderCreativePage();
    } else if (state.path.startsWith("/hire")) {
      pageHtml = renderHirePage(theme);
    } else if (state.path.startsWith("/work")) {
      pageHtml = renderWorkPage();
    } else if (state.path.startsWith("/writing")) {
      pageHtml = renderWritingPage();
    } else if (state.path.startsWith("/commission")) {
      pageHtml = renderCommissionPage();
    } else if (state.path.startsWith("/cv")) {
      pageHtml = renderPrintableCVPage();
    } else {
      pageHtml = renderHomePage();
    }

    root.innerHTML = `
      <div class="corner" data-room="${room}" data-theme="${theme}">
        <a href="#main" class="sr-only">Skip to content</a>
        ${renderQuickAccess(room, theme)}
        ${renderDock(room, theme)}
        <main id="main">${pageHtml}</main>
        ${renderFooter()}
        <div id="modals-root">${renderModals(theme)}</div>
      </div>
    `;

    applyRoomAndTheme();
    initDockScroll();

    if (state.path === "/") {
      initWordPortraitCanvas();
    } else if (state.path.startsWith("/engineer") || state.path.startsWith("/developer")) {
      initMatrixRain();
    } else if (state.path.startsWith("/hire")) {
      initRoleScramble();
    }

    wireEvents();
  }

  function refreshModalsOnly() {
    const modalsRoot = document.getElementById("modals-root");
    if (!modalsRoot) return;
    const room = getRoom(state.path);
    const theme = getEffectiveTheme(room);
    modalsRoot.innerHTML = renderModals(theme);
    wireModalEvents();
  }

  function wireModalEvents() {
    document.querySelectorAll("[data-close-peek]").forEach(btn => {
      btn.onclick = () => {
        state.peekWord = null;
        state.peekProject = null;
        state.peekArticle = null;
        refreshModalsOnly();
      };
    });

    const cvdBackdrop = document.getElementById("cvd-backdrop");
    const cvdCloseBtn = document.getElementById("cvd-close-btn");
    if (cvdBackdrop) cvdBackdrop.onclick = () => { state.cvOpen = false; state.cvSelectedEntry = null; refreshModalsOnly(); };
    if (cvdCloseBtn) cvdCloseBtn.onclick = () => { state.cvOpen = false; state.cvSelectedEntry = null; refreshModalsOnly(); };

    const cvdSearch = document.getElementById("cvd-search-input");
    if (cvdSearch) {
      cvdSearch.oninput = e => {
        state.cvSearch = e.target.value;
        const pos = cvdSearch.selectionStart;
        refreshModalsOnly();
        const nextInput = document.getElementById("cvd-search-input");
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(pos, pos);
        }
      };
    }

    document.querySelectorAll(".js-cv-cat").forEach(btn => {
      btn.onclick = () => {
        state.cvCategory = btn.getAttribute("data-cv-cat");
        refreshModalsOnly();
      };
    });

    document.querySelectorAll(".js-cv-row").forEach(row => {
      row.onclick = () => {
        const id = row.getAttribute("data-cv-id");
        state.cvSelectedEntry = DATA.masterCV.find(x => x.id === id) || null;
        refreshModalsOnly();
      };
    });

    const entryBg = document.getElementById("cv-entry-drawer-bg");
    const entryClose = document.getElementById("cv-entry-drawer-close");
    if (entryBg) entryBg.onclick = () => { state.cvSelectedEntry = null; refreshModalsOnly(); };
    if (entryClose) entryClose.onclick = () => { state.cvSelectedEntry = null; refreshModalsOnly(); };

    document.querySelectorAll("#modals-root [data-project-id]").forEach(el => {
      el.onclick = e => {
        e.preventDefault();
        const pid = el.getAttribute("data-project-id");
        state.peekWord = null;
        state.peekProject = DATA.flagships.find(f => f.id === pid) || null;
        refreshModalsOnly();
      };
    });

    document.querySelectorAll("#modals-root [data-nav]").forEach(a => {
      a.onclick = e => {
        e.preventDefault();
        state.peekWord = null;
        state.peekProject = null;
        state.peekArticle = null;
        state.cvOpen = false;
        navigate(a.getAttribute("data-nav"));
      };
    });
  }

  function wireEvents() {
    // SPA Navigation links
    document.querySelectorAll("[data-nav]").forEach(a => {
      a.onclick = e => {
        e.preventDefault();
        navigate(a.getAttribute("data-nav"));
      };
    });

    // Quick access toggle
    const qaToggle = document.getElementById("qa-toggle-btn");
    const qaMobileOpen = document.getElementById("qa-mobile-open");
    const qaScrim = document.getElementById("qa-scrim");
    if (qaToggle) qaToggle.onclick = () => { state.qaOpen = !state.qaOpen; render(); };
    if (qaMobileOpen) qaMobileOpen.onclick = () => { state.qaOpen = true; render(); };
    if (qaScrim) qaScrim.onclick = () => { state.qaOpen = false; render(); };

    // Theme & Music buttons
    const themeBtn = document.getElementById("qa-theme-btn");
    if (themeBtn) themeBtn.onclick = toggleTheme;
    const musicBtn = document.getElementById("qa-music-btn");
    if (musicBtn) musicBtn.onclick = () => toggleMusic();

    const nowPlayBtn = document.getElementById("now-play-btn");
    if (nowPlayBtn) nowPlayBtn.onclick = () => toggleMusic();

    document.querySelectorAll(".js-switch-track").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-track-idx"));
        toggleMusic(idx);
        render();
      };
    });

    // "I am a" marquee word buttons
    document.querySelectorAll(".c-iam").forEach(btn => {
      btn.onclick = () => {
        playUiTick(580, 0.025);
        state.peekWord = {
          w: decodeURIComponent(btn.getAttribute("data-word") || ""),
          q: decodeURIComponent(btn.getAttribute("data-q") || "")
        };
        refreshModalsOnly();
      };
    });

    // Project cards
    document.querySelectorAll("[data-project-id]").forEach(el => {
      el.onclick = e => {
        e.preventDefault();
        playUiTick(600, 0.025);
        const pid = el.getAttribute("data-project-id");
        state.peekProject = DATA.flagships.find(f => f.id === pid) || null;
        refreshModalsOnly();
      };
    });

    // Article cards
    document.querySelectorAll("[data-article-id]").forEach(el => {
      el.onclick = e => {
        e.preventDefault();
        playUiTick(600, 0.025);
        const aid = el.getAttribute("data-article-id");
        state.peekArticle = DATA.writings.find(w => w.id === aid) || null;
        refreshModalsOnly();
      };
    });

    // Open Master CV buttons
    document.querySelectorAll("[data-open-cv]").forEach(el => {
      el.onclick = e => {
        e.preventDefault();
        playUiTick(660, 0.03);
        state.cvOpen = true;
        refreshModalsOnly();
      };
    });

    // Interactive Doors hover on Home page
    const doorsContainer = document.getElementById("home-doors");
    if (doorsContainer) {
      const doors = doorsContainer.querySelectorAll(".c-door2");
      doors.forEach((door, idx) => {
        door.addEventListener("mouseenter", () => {
          doors.forEach((d, i) => {
            d.setAttribute("data-active", i === idx ? "true" : "false");
            d.setAttribute("data-dim", i !== idx ? "true" : "false");
          });
        });
      });
      doorsContainer.addEventListener("mouseleave", () => {
        doors.forEach(d => {
          d.setAttribute("data-active", "false");
          d.setAttribute("data-dim", "false");
        });
      });
    }

    // Catalogue search & filter
    const workInput = document.getElementById("work-search-input");
    if (workInput) {
      workInput.oninput = e => {
        state.workSearch = e.target.value;
        const pos = workInput.selectionStart;
        render();
        const next = document.getElementById("work-search-input");
        if (next) {
          next.focus();
          next.setSelectionRange(pos, pos);
        }
      };
    }
    document.querySelectorAll(".js-work-cat").forEach(btn => {
      btn.onclick = () => {
        state.workFilter = btn.getAttribute("data-cat");
        render();
      };
    });

    // Commission form chips & submit -> sends all selected & filled info to zeeza.lawal@gmail.com
    document.querySelectorAll(".js-comm-chip").forEach(chip => {
      chip.onclick = () => {
        const isPressed = chip.getAttribute("aria-pressed") === "true";
        const pressedCount = document.querySelectorAll('.js-comm-chip[aria-pressed="true"]').length;
        if (isPressed && pressedCount > 1) {
          chip.setAttribute("aria-pressed", "false");
        } else if (!isPressed) {
          chip.setAttribute("aria-pressed", "true");
        }
      };
    });
    const commForm = document.getElementById("commission-form");
    if (commForm) {
      commForm.onsubmit = async e => {
        e.preventDefault();
        const targetEmail = "zeeza.lawal@gmail.com";
        const name = (document.getElementById("f-name")?.value || "").trim();
        const email = (document.getElementById("f-email")?.value || "").trim();
        const org = (document.getElementById("f-org")?.value || "").trim();
        const timelineEl = document.getElementById("f-timeline");
        const timeline = timelineEl
          ? (timelineEl.options[timelineEl.selectedIndex]?.text || timelineEl.value)
          : "Immediate / This month";
        const msg = (document.getElementById("f-msg")?.value || "").trim();
        const selectedTopics = Array.from(document.querySelectorAll('.js-comm-chip[aria-pressed="true"]'))
          .map(c => c.textContent.trim())
          .filter(Boolean);
        const topicsStr = selectedTopics.length ? selectedTopics.join(", ") : "General Inquiry";

        const subject = `[Portfolio Inquiry] ${topicsStr} — ${name}${org ? ` (${org})` : ""}`;
        const bodyLines = [
          "Hello Azeeza,",
          "",
          "New collaboration / role inquiry submitted via your portfolio:",
          "",
          `• Name: ${name}`,
          `• Email: ${email}`,
          `• Organization / Company: ${org || "Not specified"}`,
          `• What to discuss: ${topicsStr}`,
          `• Timeline: ${timeline}`,
          "",
          "Role or Project Details:",
          msg,
          "",
          "—",
          `Sent from Azeeza Muhammad Lawal's Portfolio`
        ];
        const bodyText = bodyLines.join("\r\n");
        const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

        const box = document.getElementById("comm-success");
        if (box) {
          box.style.display = "block";
          box.innerHTML = `
            <p class="c-eyebrow" style="color:var(--accent)">Sending to ${targetEmail}…</p>
            <h3 class="c-h3" style="margin-top:6px">Thank you, ${name.split(" ")[0] || "friend"}.</h3>
            <p class="c-muted" style="margin-top:6px">All your selected details (<b>${topicsStr}</b> · <b>${timeline}</b>${org ? ` · <b>${org}</b>` : ""}) have been formatted for <b>${targetEmail}</b>.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
              <a class="c-btn c-btn-sm c-btn-accent" href="${mailtoUrl}">Open in Email App →</a>
              <a class="c-btn c-btn-sm" href="${gmailUrl}" target="_blank" rel="noopener">Send via Gmail Web ↗</a>
            </div>
          `;
        }

        // Attempt direct AJAX delivery via FormSubmit to zeeza.lawal@gmail.com
        try {
          fetch(`https://formsubmit.co/ajax/${targetEmail}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              _subject: subject,
              Name: name,
              Email: email,
              Organization: org || "Not specified",
              Topics_Selected: topicsStr,
              Timeline: timeline,
              Message: msg
            })
          }).catch(() => {});
        } catch (_) {}

        // Trigger the pre-populated mailto link so all filled fields open directly addressed to zeeza.lawal@gmail.com
        window.location.href = mailtoUrl;
      };
    }

    // Footer subscribe form
    const subForm = document.getElementById("footer-sub-form");
    if (subForm) {
      subForm.onsubmit = e => {
        e.preventDefault();
        const subEmail = (document.getElementById("sub-email")?.value || "").trim();
        const targetEmail = "zeeza.lawal@gmail.com";
        const msg = document.getElementById("footer-sub-msg");
        if (msg) {
          msg.style.display = "block";
          msg.textContent = `You're on the list! Subscription for ${subEmail} sent to ${targetEmail}.`;
        }
        try {
          fetch(`https://formsubmit.co/ajax/${targetEmail}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              _subject: `[Portfolio Newsletter] New Subscriber: ${subEmail}`,
              Subscriber_Email: subEmail
            })
          }).catch(() => {});
        } catch (_) {}
      };
    }

    wireModalEvents();
  }

  // Global Escape / Cmd+K shortcuts
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (state.cvSelectedEntry) { state.cvSelectedEntry = null; refreshModalsOnly(); return; }
      if (state.cvOpen) { state.cvOpen = false; refreshModalsOnly(); return; }
      if (state.peekWord || state.peekProject || state.peekArticle) {
        state.peekWord = null; state.peekProject = null; state.peekArticle = null;
        refreshModalsOnly();
        return;
      }
      if (state.qaOpen) { state.qaOpen = false; render(); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      state.cvOpen = true;
      refreshModalsOnly();
      setTimeout(() => document.getElementById("cvd-search-input")?.focus(), 50);
    }
  });

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
