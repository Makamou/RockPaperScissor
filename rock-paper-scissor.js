/* =====================================================
   Rock · Paper · Scissors — STUNNING EDITION
   Features: difficulty, sounds, confetti, particles,
   streaks, round history, game-over overlay, theming,
   name / max-score / autoplay speed.
   ===================================================== */

const CHOICES = ["rock-emoji", "paper-emoji", "scissors-emoji"];

const WIN_MAP = {
  "rock-emoji":     "scissors-emoji",
  "paper-emoji":    "rock-emoji",
  "scissors-emoji": "paper-emoji",
};

const LABELS = {
  "rock-emoji":     "Rock",
  "paper-emoji":    "Paper",
  "scissors-emoji": "Scissors",
};

/* ---------- Default state ---------- */
const DEFAULT_SETTINGS = {
  name:       "You",
  difficulty: "normal",
  maxScore:   20,
  speed:      1,
  accent:     "#22d3ee",
  sound:      true,
  confetti:   true,
  particles:  true,
  theme:      "dark",
};

const DEFAULT_SCORE = { wins: 0, losses: 0, ties: 0 };

/* ---------- Storage helpers ---------- */
const loadJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch { return { ...fallback }; }
};
const saveJSON = (key, val) => localStorage.setItem(key, JSON.stringify(val));

let score      = loadJSON("rps-score",    DEFAULT_SCORE);
let settings   = loadJSON("rps-settings", DEFAULT_SETTINGS);
let history    = [];   // player move history (for hard AI)
let roundLog   = [];   // outcome log for history dots
let streak     = 0;    // +N = win streak, -N = lose streak
let intervalId = null;

/* ---------- DOM helper ---------- */
const $ = (id) => document.getElementById(id);

/* ---------- Theming ---------- */
const hexToRgba = (hex, alpha) => {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyTheme = () => {
  document.documentElement.setAttribute("data-theme", settings.theme);
  document.documentElement.style.setProperty("--accent", settings.accent);
  document.documentElement.style.setProperty("--accent-soft", hexToRgba(settings.accent, 0.15));
  const icon = $("theme-icon");
  if (icon) icon.innerHTML = settings.theme === "dark" ? "&#9789;" : "&#9728;";
};

const toggleTheme = () => {
  settings.theme = settings.theme === "dark" ? "light" : "dark";
  saveJSON("rps-settings", settings);
  applyTheme();
};

/* ---------- Settings panel ---------- */
const toggleSettings = () => {
  const panel = $("settings-panel");
  panel.classList.toggle("open");
  panel.setAttribute("aria-hidden", panel.classList.contains("open") ? "false" : "true");
};

const hydrateSettingsUI = () => {
  $("setting-name").value            = settings.name;
  $("setting-difficulty").value      = settings.difficulty;
  $("setting-maxscore").value        = settings.maxScore;
  $("max-score-value").innerText     = settings.maxScore;
  $("setting-speed").value           = settings.speed;
  $("speed-value").innerText         = Number(settings.speed).toFixed(1);
  $("setting-accent").value          = settings.accent;
  $("setting-sound").checked         = settings.sound;
  $("setting-confetti").checked      = settings.confetti;
  $("setting-particles").checked     = settings.particles !== false;

  $("setting-maxscore").oninput = (e) => ($("max-score-value").innerText = e.target.value);
  $("setting-speed").oninput    = (e) => ($("speed-value").innerText = Number(e.target.value).toFixed(1));
  $("setting-accent").oninput   = (e) => {
    document.documentElement.style.setProperty("--accent", e.target.value);
    document.documentElement.style.setProperty("--accent-soft", hexToRgba(e.target.value, 0.15));
  };
};

const saveSettings = () => {
  settings.name       = $("setting-name").value.trim() || "You";
  settings.difficulty = $("setting-difficulty").value;
  settings.maxScore   = Number($("setting-maxscore").value);
  settings.speed      = Number($("setting-speed").value);
  settings.accent     = $("setting-accent").value;
  settings.sound      = $("setting-sound").checked;
  settings.confetti   = $("setting-confetti").checked;
  settings.particles  = $("setting-particles").checked;
  saveJSON("rps-settings", settings);
  applyTheme();
  renderUI();
  toggleSettings();
};

/* ---------- UI rendering ---------- */
const renderUI = () => {
  const wEl = $("w"), lEl = $("l"), tEl = $("t");
  const prevW = parseInt(wEl.dataset.val || 0);
  const prevL = parseInt(lEl.dataset.val || 0);
  const prevT = parseInt(tEl.dataset.val || 0);

  const pulse = (el) => { el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); };
  if (score.wins    !== prevW) pulse(wEl);
  if (score.losses  !== prevL) pulse(lEl);
  if (score.ties    !== prevT) pulse(tEl);

  wEl.innerHTML = `W &nbsp;${score.wins}`;
  lEl.innerHTML = `L &nbsp;${score.losses}`;
  tEl.innerHTML = `T &nbsp;${score.ties}`;
  wEl.dataset.val = score.wins;
  lEl.dataset.val = score.losses;
  tEl.dataset.val = score.ties;

  $("player-name-display").innerText = settings.name;
  $("player-name-title").innerText   = settings.name;

  const pct = settings.maxScore
    ? Math.min(100, (Math.max(score.wins, score.losses, score.ties) / settings.maxScore) * 100)
    : 0;
  $("progress-fill").style.width = pct + "%";
};

/* ---------- Streak ---------- */
const updateStreak = (outcome) => {
  if      (outcome === "win")  streak = streak > 0  ? streak + 1 : 1;
  else if (outcome === "lose") streak = streak < 0  ? streak - 1 : -1;
  else                         streak = 0;

  const el = $("streak-display");
  if (!el) return;
  el.className = "streak-display";

  if (streak >= 3) {
    el.textContent = `🔥 ${streak} Win Streak!`;
    el.classList.add("hot");
  } else if (streak <= -3) {
    el.textContent = `💀 ${Math.abs(streak)} Loss Streak`;
    el.classList.add("cold");
  } else {
    el.innerHTML = "&nbsp;";
  }
};

/* ---------- Round history dots ---------- */
const OUTCOME_CHAR = { win: "W", lose: "L", tie: "T" };

const updateRoundHistory = (outcome) => {
  roundLog.push(outcome);
  if (roundLog.length > 8) roundLog.shift();

  const el = $("round-history");
  if (!el) return;
  el.innerHTML = roundLog.map((o) =>
    `<div class="history-dot ${o}">${OUTCOME_CHAR[o]}</div>`
  ).join("");
};

/* ---------- Difficulty: computer move ---------- */
const computerMove = (playerMove) => {
  if (settings.difficulty === "easy") {
    if (Math.random() < 0.62) return WIN_MAP[playerMove]; // play losing move
  } else if (settings.difficulty === "hard" && history.length >= 3) {
    const recent = history.slice(-10);
    const counts = {};
    recent.forEach((m) => (counts[m] = (counts[m] || 0) + 1));
    const predicted = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
    const counter = Object.keys(WIN_MAP).find((k) => WIN_MAP[k] === predicted);
    if (Math.random() < 0.72) return counter;
  }
  return CHOICES[Math.floor(Math.random() * 3)];
};

/* ---------- WebAudio sounds ---------- */
let audioCtx = null;
const beep = (freq, dur = 0.12, type = "sine", vol = 0.15) => {
  if (!settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.stop(audioCtx.currentTime + dur);
  } catch {}
};

const playClick = () => beep(700, 0.05, "sine", 0.07);

const playWin = () => {
  // Rising arpeggio: C5 → E5 → G5 → C6
  beep(523,  0.10, "triangle", 0.18);
  setTimeout(() => beep(659,  0.10, "triangle", 0.18), 100);
  setTimeout(() => beep(784,  0.12, "triangle", 0.18), 200);
  setTimeout(() => beep(1047, 0.28, "triangle", 0.16), 310);
};

const playLose = () => {
  // Falling tone with sawtooth grit
  beep(320, 0.12, "sawtooth", 0.13);
  setTimeout(() => beep(220, 0.30, "sawtooth", 0.11), 130);
};

const playTie = () => {
  // Double ping
  beep(440, 0.10, "square", 0.09);
  setTimeout(() => beep(440, 0.12, "square", 0.07), 200);
};

const playGameOver = (won) => {
  if (!settings.sound) return;
  if (won) {
    // Fanfare
    [523, 659, 784, 1047, 1318].forEach((f, i) =>
      setTimeout(() => beep(f, 0.18, "triangle", 0.2), i * 120)
    );
  } else {
    // Sad trombone-ish
    [440, 370, 311, 261].forEach((f, i) =>
      setTimeout(() => beep(f, 0.22, "sawtooth", 0.14), i * 130)
    );
  }
};

/* ---------- Confetti ---------- */
let confettiPieces = [];
const launchConfetti = () => {
  if (!settings.confetti) return;
  const c = $("confetti-canvas");
  c.width  = window.innerWidth;
  c.height = window.innerHeight;
  const ctx    = c.getContext("2d");
  const colors = [settings.accent, "#f87171", "#facc15", "#4ade80", "#a78bfa", "#fb923c"];

  confettiPieces = Array.from({ length: 150 }, () => ({
    x:     Math.random() * c.width,
    y:     -20 - Math.random() * c.height * 0.35,
    r:     4 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx:    -2.5 + Math.random() * 5,
    vy:    2.5 + Math.random() * 5,
    rot:   Math.random() * 360,
    vr:    -8 + Math.random() * 16,
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));

  let frame = 0;
  const draw = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    confettiPieces.forEach((p) => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.07;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / 140);
      if (p.shape === "rect") {
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r * 0.5);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    frame++;
    if (frame < 160) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, c.width, c.height);
  };
  draw();
};

/* ---------- Particle background ---------- */
let particleAnimId = null;
let particles      = [];
let pCtx           = null;

const initParticles = () => {
  const c = $("particle-canvas");
  if (!c) return;
  c.width  = window.innerWidth;
  c.height = window.innerHeight;
  pCtx = c.getContext("2d");

  particles = Array.from({ length: 55 }, () => ({
    x:     Math.random() * c.width,
    y:     Math.random() * c.height,
    r:     0.8 + Math.random() * 2.2,
    vx:    -0.25 + Math.random() * 0.5,
    vy:    -0.25 + Math.random() * 0.5,
    alpha: 0.15 + Math.random() * 0.5,
  }));

  if (particleAnimId) cancelAnimationFrame(particleAnimId);
  animateParticles();
};

const animateParticles = () => {
  const c = pCtx.canvas;
  pCtx.clearRect(0, 0, c.width, c.height);

  if (settings.particles !== false) {
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = c.width;
      if (p.x > c.width)  p.x = 0;
      if (p.y < 0) p.y = c.height;
      if (p.y > c.height) p.y = 0;

      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      pCtx.fillStyle = hexToRgba(settings.accent, p.alpha);
      pCtx.fill();
    });
  }

  particleAnimId = requestAnimationFrame(animateParticles);
};

window.addEventListener("resize", () => {
  const c = $("particle-canvas");
  if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
  const cf = $("confetti-canvas");
  if (cf) { cf.width = window.innerWidth; cf.height = window.innerHeight; }
});

/* ---------- Game Over overlay ---------- */
const showGameOver = () => {
  const overlay = $("game-over");
  if (!overlay) return;

  const playerWon = score.wins >= settings.maxScore;
  const tied      = score.ties >= settings.maxScore;

  $("go-icon").textContent  = playerWon ? "🏆" : tied ? "🤝" : "😅";
  $("go-title").textContent = playerWon ? "Victory!" : tied ? "Stalemate!" : "Defeated!";
  $("go-msg").textContent   = playerWon
    ? `${settings.name} reached ${settings.maxScore} wins — unstoppable!`
    : tied
    ? `Both stuck at ${settings.maxScore} ties. A true standoff.`
    : `Computer reached ${settings.maxScore} wins. Revenge incoming?`;

  $("go-stats").innerHTML = `
    <div class="go-stat gw"><span class="val">${score.wins}</span><span class="lbl">Wins</span></div>
    <div class="go-stat gl"><span class="val">${score.losses}</span><span class="lbl">Losses</span></div>
    <div class="go-stat gt"><span class="val">${score.ties}</span><span class="lbl">Ties</span></div>
  `;

  overlay.style.display = "flex";
  playGameOver(playerWon || tied);
  if (playerWon) launchConfetti();
};

/* ---------- Reset ---------- */
const resetBtn = () => {
  score    = { ...DEFAULT_SCORE };
  history  = [];
  roundLog = [];
  streak   = 0;
  saveJSON("rps-score", score);

  $("computer-img").src = "./aesthetic-moving.gif";
  $("player-img").src   = "./aesthetic-moving.gif";
  $("round-message").innerText   = "Make your move!";
  $("round-message").className   = "round-message";
  $("round-history").innerHTML   = "";
  $("streak-display").innerHTML  = "&nbsp;";
  $("streak-display").className  = "streak-display";

  document.querySelectorAll(".result-card").forEach((c) => c.classList.remove("win", "lose"));
  document.querySelectorAll(".choice").forEach((b) => (b.disabled = false));

  const overlay = $("game-over");
  if (overlay) overlay.style.display = "none";

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    $("auto-btn").classList.remove("active");
    $("auto-btn").innerText = "Auto Play";
  }

  renderUI();
};

/* ---------- Auto-play ---------- */
const autoPlay = () => {
  const btn = $("auto-btn");
  if (!intervalId) {
    btn.classList.add("active");
    btn.innerText = "Stop";
    intervalId = setInterval(() => {
      const player = CHOICES[Math.floor(Math.random() * 3)];
      handleClick({ value: player });
    }, settings.speed * 1000);
  } else {
    clearInterval(intervalId);
    intervalId = null;
    btn.classList.remove("active");
    btn.innerText = "Auto Play";
  }
};

/* ---------- Core game logic ---------- */
const handleClick = (btn) => {
  const playerMove = btn.value;
  history.push(playerMove);

  playClick();

  const compMove = computerMove(playerMove);

  // Image swap with pop animation
  const playerImg   = $("player-img");
  const computerImg = $("computer-img");
  playerImg.src   = "./" + playerMove + ".png";
  computerImg.src = "./" + compMove  + ".png";
  playerImg.classList.remove("pop");
  computerImg.classList.remove("pop");
  void playerImg.offsetWidth;
  void computerImg.offsetWidth;
  playerImg.classList.add("pop");
  computerImg.classList.add("pop");

  // Card states
  const playerCard   = playerImg.closest(".result-card");
  const computerCard = computerImg.closest(".result-card");
  playerCard.classList.remove("win", "lose");
  computerCard.classList.remove("win", "lose");

  const msg = $("round-message");
  msg.classList.remove("win", "lose", "tie");

  let outcome;
  if (playerMove === compMove) {
    score.ties++;
    outcome = "tie";
    msg.innerText = `Tie — both chose ${LABELS[playerMove]}`;
    msg.classList.add("tie");
    playTie();
  } else if (WIN_MAP[playerMove] === compMove) {
    score.wins++;
    outcome = "win";
    msg.innerText = `${settings.name} wins! ${LABELS[playerMove]} beats ${LABELS[compMove]}`;
    msg.classList.add("win");
    playerCard.classList.add("win");
    computerCard.classList.add("lose");
    playWin();
    launchConfetti();
  } else {
    score.losses++;
    outcome = "lose";
    msg.innerText = `Computer wins. ${LABELS[compMove]} beats ${LABELS[playerMove]}`;
    msg.classList.add("lose");
    computerCard.classList.add("win");
    playerCard.classList.add("lose");
    document.querySelector(".game").classList.add("shake");
    setTimeout(() => document.querySelector(".game").classList.remove("shake"), 500);
    playLose();
  }

  updateStreak(outcome);
  updateRoundHistory(outcome);
  saveJSON("rps-score", score);

  // End-of-game check
  if (
    score.wins   >= settings.maxScore ||
    score.losses >= settings.maxScore ||
    score.ties   >= settings.maxScore
  ) {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      $("auto-btn").classList.remove("active");
      $("auto-btn").innerText = "Auto Play";
    }
    document.querySelectorAll(".choice").forEach((b) => (b.disabled = true));
    setTimeout(showGameOver, 700);
  }

  renderUI();
};

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const key = e.key.toLowerCase();
  if      (key === "r")      handleClick({ value: "rock-emoji" });
  else if (key === "p")      handleClick({ value: "paper-emoji" });
  else if (key === "s")      handleClick({ value: "scissors-emoji" });
  else if (key === "a")      autoPlay();
  else if (key === "escape") {
    const panel = $("settings-panel");
    if (panel.classList.contains("open")) toggleSettings();
  }
});

/* ---------- Init ---------- */
window.addEventListener("load", () => {
  applyTheme();
  hydrateSettingsUI();
  renderUI();
  initParticles();
});
