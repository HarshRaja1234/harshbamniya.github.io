// =====================================================
//  TIKKU RUN  -  ek original 2D platformer
//  Hero: Tikku, ek chhota orange fox (green scarf wala)
//  Naam badalna ho to neeche GAME_TITLE / HERO_NAME badlo
// =====================================================
const GAME_TITLE = 'TIKKU RUN';
const HERO_NAME = 'Tikku';

const W = 960, H = 544, TILE = 32, ROWS = 17;
const GRAV = 0.55, MAX_FALL = 13;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------- Screen scaling (PC, mobile, tablet sab pe fit) ----------
function resize() {
  const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const s = Math.min(vw / W, vh / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// ---------- Input: keyboard ----------
const keys = {};
const pressed = new Set();
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
let touchMode = false;
function setTouchMode(on) { touchMode = on; document.body.classList.toggle('touch', on); }
window.addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  keys[e.code] = true;
  if (touchMode) setTouchMode(false); // keyboard aaya to touch buttons chhupa do
  initAudio();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
const down = (...c) => c.some(k => keys[k]);
const hit = (...c) => c.some(k => pressed.has(k));
const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW', 'KeyZ'];

// ---------- Input: touch (mobile / tablet) ----------
// Har ungli ko alag track karte hain, taaki chalte-chalte jump bhi ho sake
// aur ungli ek button se doosre pe slide kare to bhi kaam kare.
if (matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0)) setTouchMode(true);
let touchHeld = new Set();
function syncTouches(e) {
  e.preventDefault();
  initAudio();
  if (!touchMode) setTouchMode(true);
  const now = new Set();
  for (const tch of e.touches) {
    const el = document.elementFromPoint(tch.clientX, tch.clientY);
    const b = el && el.closest ? el.closest('[data-key]') : null;
    if (b) now.add(b.dataset.key);
  }
  for (const k of now) if (!touchHeld.has(k)) { keys[k] = true; pressed.add(k); }
  for (const k of touchHeld) if (!now.has(k)) keys[k] = false;
  touchHeld = now;
  document.querySelectorAll('#touch [data-key]').forEach(b => b.classList.toggle('on', now.has(b.dataset.key)));
}
const touchLayer = document.getElementById('touch');
['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(ev => touchLayer.addEventListener(ev, syncTouches, { passive: false }));
// mouse se bhi buttons chal jaayein (testing ke liye)
document.querySelectorAll('#touch [data-key]').forEach(b => {
  const k = b.dataset.key;
  b.addEventListener('mousedown', () => { keys[k] = true; pressed.add(k); b.classList.add('on'); initAudio(); });
  const up = () => { keys[k] = false; b.classList.remove('on'); };
  b.addEventListener('mouseup', up); b.addEventListener('mouseleave', up);
});
// upar wale chhote buttons: pause, sound, fullscreen
document.querySelectorAll('#topbtns [data-act]').forEach(b => {
  const act = e => {
    e.preventDefault(); e.stopPropagation(); initAudio();
    const a = b.dataset.act;
    if (a === 'pause') pressed.add('KeyP');
    else if (a === 'sound') pressed.add('KeyM');
    else if (a === 'full') toggleFullscreen();
  };
  b.addEventListener('touchend', act, { passive: false });
  b.addEventListener('click', act);
});
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (!(d.fullscreenElement || d.webkitFullscreenElement)) {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      Promise.resolve(req.call(el)).then(() => {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
    }
  } else {
    const ex = d.exitFullscreen || d.webkitExitFullscreen;
    if (ex) ex.call(d);
  }
}
// long-press menu aur double-tap zoom band
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
// app/tab background mein gaya to game pause
document.addEventListener('visibilitychange', () => {
  if (document.hidden && typeof state !== 'undefined' && state === 'playing') paused = true;
});
canvas.addEventListener('pointerdown', e => {
  initAudio();
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  if (state === 'title' && x < 340 && y < 52) { pressed.add('KeyL'); return; } // language button
  pressed.add('Enter');
});

// ---------- Sound (tiny WebAudio beeps) ----------
let actx = null, muted = false;
function initAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
}
function beep(f1, f2, dur, type = 'square', vol = 0.07, delay = 0) {
  if (!actx || muted) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  jump: () => beep(320, 620, 0.15, 'square', 0.05),
  djump: () => beep(500, 900, 0.15, 'triangle', 0.08),
  gem: () => { beep(988, 988, 0.06, 'square', 0.05); beep(1319, 1319, 0.12, 'square', 0.05, 0.06); },
  stomp: () => beep(400, 90, 0.15, 'square', 0.07),
  bump: () => beep(140, 80, 0.08, 'triangle', 0.1),
  power: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, f, 0.1, 'triangle', 0.08, i * 0.07)),
  appear: () => beep(300, 800, 0.3, 'sine', 0.08),
  hurt: () => beep(600, 120, 0.35, 'sawtooth', 0.06),
  die: () => [494, 440, 392, 330, 262].forEach((f, i) => beep(f, f * 0.95, 0.16, 'square', 0.06, i * 0.14)),
  clear: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => beep(f, f, 0.14, 'square', 0.06, i * 0.11)),
  life: () => [660, 880, 1100, 1320].forEach((f, i) => beep(f, f, 0.1, 'triangle', 0.08, i * 0.08)),
};

// ---------- Background music (original chiptune, WebAudio se bajta hai) ----------
// Har track: bpm, lead (8th notes), bass (8th notes). '-' = rest. N key = music on/off
const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function noteFreq(n) {
  const m = /^([A-G][#b]?)(\d)$/.exec(n);
  if (!m) return 0;
  const midi = NOTE_IDX[m[1]] + (parseInt(m[2]) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const seq = s => s.trim().split(/\s+/).map(noteFreq);
const TRACKS = {
  day: { bpm: 150, leadType: 'square', leadVol: 0.035, bassVol: 0.06,
    lead: seq(`E5 G5 A5 G5 E5 D5 C5 D5  E5 E5 G5 E5 D5 C5 A4 C5  F5 A5 C6 A5 G5 F5 E5 F5  G5 E5 D5 C5 D5 E5 C5 -
               C5 E5 G5 E5 F5 A5 G5 F5  E5 G5 C6 G5 A5 G5 E5 -   D5 F5 A5 F5 E5 G5 B5 G5  C6 B5 G5 E5 D5 B4 C5 -`),
    bass: seq(`C3 - C3 - G2 - G2 -  A2 - A2 - E2 - E2 -  F2 - F2 - C3 - C3 -  G2 - G2 - C3 - G2 -
               C3 - C3 - F2 - F2 -  C3 - C3 - A2 - A2 -  D3 - D3 - G2 - G2 -  C3 - G2 - C3 - C3 -`) },
  sunset: { bpm: 126, leadType: 'square', leadVol: 0.032, bassVol: 0.065,
    lead: seq(`A4 C5 E5 C5 D5 E5 G5 E5  F5 E5 D5 C5 B4 C5 D5 -  A4 C5 E5 A5 G5 E5 D5 C5  B4 G4 B4 D5 C5 B4 A4 -
               F5 - E5 D5 C5 - D5 E5  G5 - F5 E5 D5 - C5 D5  E5 - A5 G5 F5 E5 D5 C5  B4 C5 D5 B4 A4 - - -`),
    bass: seq(`A2 - A2 E3 F2 - F2 C3  G2 - G2 D3 E2 - E2 B2  A2 - A2 E3 F2 - F2 C3  G2 - G2 D3 A2 - A2 -
               D2 - D2 A2 C3 - C3 G2  Bb2 - Bb2 F2 A2 - A2 E2  F2 - F2 C3 G2 - G2 D3  E2 - E2 B2 A2 - A2 -`) },
  night: { bpm: 104, leadType: 'triangle', leadVol: 0.09, bassVol: 0.07,
    lead: seq(`D5 - F5 A5 G5 F5 E5 -  C5 - E5 G5 F5 E5 D5 -  Bb4 D5 F5 D5 A4 C5 E5 C5  D5 F5 A5 F5 D5 - - -
               A5 - G5 F5 E5 - F5 G5  F5 - E5 D5 C5 - D5 E5  F5 E5 D5 C5 Bb4 C5 D5 E5  D5 - A4 - D5 - - -`),
    bass: seq(`D2 - A2 - D2 - A2 -  C2 - G2 - C2 - G2 -  Bb1 - F2 - A1 - E2 -  D2 - A2 - D2 - A2 -
               F2 - C3 - F2 - C3 -  C2 - G2 - C2 - G2 -  Bb1 - F2 - C2 - G2 -  D2 - A2 - D2 - - -`) },
};
TRACKS.lava = { bpm: 96, leadType: 'square', leadVol: 0.03, bassVol: 0.075,
  lead: seq(`D4 - - F4 E4 - D4 -  A3 - - C4 D4 - - -  D4 - - F4 G4 - A4 -  Bb4 - A4 - G4 - E4 -
             F4 - - A4 G4 - F4 -  E4 - - G4 A4 - - -  D5 - C5 - Bb4 - A4 -  G4 - E4 - D4 - - -`),
  bass: seq(`D2 - D2 - D2 - D2 -  C2 - C2 - C2 - C2 -  Bb1 - Bb1 - Bb1 - Bb1 -  A1 - A1 - A1 - A1 -
             D2 - D2 - D2 - D2 -  C2 - C2 - C2 - C2 -  Bb1 - Bb1 - Bb1 - Bb1 -  A1 - A1 - A1 - A1 -`) };
TRACKS.boss = { bpm: 168, leadType: 'square', leadVol: 0.035, bassVol: 0.07,
  lead: seq(`E5 E5 G5 E5 F#5 E5 D5 B4  E5 E5 G5 A5 B5 A5 G5 F#5  C6 B5 A5 G5 A5 G5 F#5 D5  E5 - B4 - E5 - - -
             G5 G5 B5 G5 A5 G5 F#5 D5  E5 G5 B5 E6 D6 B5 A5 G5  F#5 A5 C6 A5 G5 F#5 E5 D#5  E5 - B4 - E5 - - -`),
  bass: seq(`E2 E3 E2 E3 E2 E3 E2 E3  E2 E3 E2 E3 D2 D3 D2 D3  C2 C3 C2 C3 D2 D3 D2 D3  E2 E3 E2 E3 B1 B2 B1 B2
             E2 E3 E2 E3 E2 E3 E2 E3  E2 E3 E2 E3 D2 D3 D2 D3  C2 C3 C2 C3 D2 D3 D2 D3  E2 E3 E2 E3 B1 B2 B1 B2`) };
TRACKS.snow = { bpm: 132, leadType: 'triangle', leadVol: 0.09, bassVol: 0.06,
  lead: seq(`G5 - B5 D6 B5 - G5 -  A5 - C6 E6 D6 - B5 -  G5 B5 D6 G6 F#6 D6 B5 A5  G5 - D5 - G5 - - -
             E5 - G5 B5 A5 - G5 -  F#5 - A5 C6 B5 - A5 -  G5 A5 B5 D6 C6 B5 A5 F#5  G5 - - - G4 - - -`),
  bass: seq(`G2 - D3 - G2 - D3 -  A2 - E3 - D2 - A2 -  G2 - D3 - B2 - D3 -  G2 - D3 - G2 - - -
             C3 - G2 - C3 - G2 -  D3 - A2 - D3 - A2 -  E2 - B2 - C3 - D3 -  G2 - D3 - G2 - - -`) };
TRACKS.cave = { bpm: 112, leadType: 'square', leadVol: 0.03, bassVol: 0.075,
  lead: seq(`E4 - G4 - B4 - E5 -  D5 - B4 - G4 - A4 -  C5 - B4 - A4 - G4 -  F#4 - G4 - A4 - B4 -
             E5 - D5 - B4 - G4 -  A4 - B4 - C5 - D5 -  E5 - G5 - F#5 - D5 -  E5 - - - B4 - - -`),
  bass: seq(`E2 - - - E2 - B1 -  G2 - - - D2 - - -  C2 - - - C2 - G1 -  D2 - - - B1 - - -
             E2 - - - E2 - B1 -  G2 - - - D2 - - -  C2 - - - C2 - G1 -  D2 - - - B1 - - -`) };
TRACKS.sky = { bpm: 144, leadType: 'square', leadVol: 0.033, bassVol: 0.06,
  lead: seq(`C5 F5 A5 C6 A5 F5 G5 A5  Bb5 A5 G5 F5 G5 - C5 -  D5 G5 Bb5 D6 C6 Bb5 A5 G5  A5 F5 C5 F5 A5 - - -
             F5 A5 C6 F6 E6 C6 A5 G5  F5 G5 A5 Bb5 C6 - A5 -  Bb5 A5 G5 F5 E5 F5 G5 E5  F5 - C5 - F5 - - -`),
  bass: seq(`F2 - C3 - F2 - C3 -  Bb2 - F2 - C3 - G2 -  G2 - D3 - C3 - G2 -  F2 - C3 - F2 - C3 -
             F2 - A2 - C3 - A2 -  Bb2 - D3 - C3 - E3 -  Bb2 - C3 - C3 - C2 -  F2 - C3 - F2 - - -`) };
TRACKS.title = TRACKS.day;
let musicOn = true, musicGain = null;
const music = { track: null, step: 0, next: 0 };
function setMusic(name) {
  if (music.track === name) return;
  music.track = name; music.step = 0;
  if (actx) music.next = actx.currentTime + 0.08;
}
function playNote(freq, t, dur, type, vol) {
  if (!freq) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function musicTick() {
  if (!actx) return;
  if (!musicGain) { musicGain = actx.createGain(); musicGain.gain.value = 1; musicGain.connect(actx.destination); }
  const silent = !music.track || muted || !musicOn || paused;
  musicGain.gain.setTargetAtTime(silent ? 0 : 1, actx.currentTime, 0.05);
  if (silent) { music.next = actx.currentTime + 0.08; return; }
  const tr = TRACKS[music.track], dt = 60 / tr.bpm / 2;
  if (music.next < actx.currentTime) music.next = actx.currentTime + 0.03;
  while (music.next < actx.currentTime + 0.2) {
    const i = music.step % tr.lead.length, t = music.next;
    playNote(tr.lead[i], t, dt * 0.9, tr.leadType, tr.leadVol);
    playNote(tr.bass[i % tr.bass.length], t, dt * 1.6, 'triangle', tr.bassVol);
    if (i % 2 === 0) playNote(i % 8 === 0 ? 110 : 70, t, 0.06, 'sine', 0.05); // halka beat
    music.step++; music.next += dt;
  }
}
setInterval(musicTick, 30);

// ---------- Themes ----------
const THEMES = {
  day: { top: '#6ec6ff', bot: '#d4f1ff', far: '#9ad89a', near: '#5fb36a', grass: '#4caf50', grassHi: '#7ddc6f',
         dirt: '#a0643a', dirtDark: '#7a4a2a', sun: '#fff3a0', stars: false },
  sunset: { top: '#ff7e5f', bot: '#feb47b', far: '#c0707a', near: '#8e4f6b', grass: '#e0a03a', grassHi: '#f7c95a',
            dirt: '#8a4b3a', dirtDark: '#633428', sun: '#ffe8a0', stars: false },
  night: { top: '#0b1030', bot: '#2b2f6b', far: '#272c5c', near: '#1b1f45', grass: '#3aa6a0', grassHi: '#6fe0d4',
           dirt: '#4a3f6b', dirtDark: '#332a4f', sun: '#f4f1d0', stars: true },
  snow: { top: '#8ec9f5', bot: '#eef7ff', far: '#c9dff0', near: '#a3c4dc', grass: '#f4fbff', grassHi: '#ffffff',
          dirt: '#7f8fa6', dirtDark: '#5f6f86', sun: '#fffde7', stars: false, snow: true },
  cave: { top: '#120f1d', bot: '#2a2442', far: '#2a2540', near: '#1d192f', grass: '#7c6cf0', grassHi: '#b5a8ff',
          dirt: '#3b3552', dirtDark: '#2a2540', sun: null, stars: false, cave: true },
  sky: { top: '#3f97f5', bot: '#c6ebff', far: '#e3f4ff', near: '#cbe8fb', grass: '#43c463', grassHi: '#8ff09c',
         dirt: '#b07a48', dirtDark: '#8a5a33', sun: '#fff6b0', stars: false, sky: true },
  lava: { top: '#1a0b16', bot: '#6b1f1a', far: '#3a1526', near: '#26101c', grass: '#b4553a', grassHi: '#ff8a50',
          dirt: '#4a2a2a', dirtDark: '#341c1c', sun: '#ff7043', stars: false, embers: true },
};

// ---------- Levels (builder se banaye gaye) ----------
// Tiles: # ground, B stone, C crate(gem), P leaf-crate, X empty crate, = wood platform, K checkpoint,
//        ^ spikes, G gem, S slime, H hedgehog, F portal, @ start
const LEVELS = [
  {
    name: 'Meadow Hills', theme: 'day', w: 160,
    build(L) {
      L.ground(0, 28); L.ground(32, 68); L.ground(73, 104); L.ground(108, 159);
      L.set(3, 14, '@');
      L.row(9, 11, 'CBPBC'); L.row(9, 8, 'G G G');
      L.set(16, 14, 'S');
      L.fill(20, 14, 20, 14, 'B'); L.fill(21, 13, 21, 14, 'B'); L.fill(22, 12, 22, 14, 'B');
      L.row(29, 11, 'GGG');
      L.row(36, 11, '====='); L.row(42, 8, '====='); L.row(43, 7, 'GGG');
      L.set(38, 14, 'S'); L.set(50, 14, 'S'); L.set(56, 14, 'S'); L.set(62, 14, 'H');
      L.row(52, 11, 'BCB'); L.set(53, 7, 'P');
      L.fill(66, 12, 67, 14, 'B');
      L.row(69, 10, 'GGGG');
      L.row(78, 11, '===='); L.row(79, 10, 'GG');
      L.row(81, 14, '^^');
      L.set(86, 14, 'S'); L.set(92, 14, 'S'); L.set(99, 14, 'H');
      L.row(86, 8, 'G G G');
      L.row(88, 11, 'CRPC');
      L.row(105, 11, 'GGG');
      L.set(115, 14, 'S'); L.set(120, 14, 'S');
      L.row(112, 12, 'GGGG');
      L.fill(125, 14, 125, 14, 'B'); L.fill(126, 13, 126, 14, 'B'); L.fill(127, 12, 127, 14, 'B');
      L.fill(128, 11, 130, 14, 'B'); L.row(128, 9, 'GGG');
      L.set(136, 14, 'S');
      L.set(75, 14, 'K'); // checkpoint
      L.set(145, 13, 'F');
    },
  },
  {
    name: 'Sunset Cliffs', theme: 'sunset', w: 180,
    build(L) {
      L.ground(0, 20); L.set(3, 14, '@');
      L.row(8, 11, 'BCBCB'); L.row(9, 8, 'G G');
      L.row(22, 12, '===='); L.row(23, 11, 'GG');
      L.row(28, 10, '===='); L.row(29, 9, 'GG');
      L.row(34, 12, '===='); L.row(35, 11, 'GG');
      L.ground(38, 62);
      L.set(42, 14, 'S'); L.set(48, 14, 'S'); L.set(55, 14, 'H');
      L.row(44, 11, 'BPB');
      L.fill(60, 12, 62, 14, 'B'); L.row(60, 10, 'GGG');
      L.ground(66, 80);
      L.row(70, 14, '^^^^'); L.row(69, 11, '======'); L.row(70, 10, 'GGGG');
      L.set(76, 14, 'S');
      L.row(83, 12, 'BB'); L.row(83, 10, 'GG');
      L.ground(86, 120);
      L.set(87, 14, 'K'); L.set(92, 14, 'S'); L.set(97, 14, 'S'); L.set(103, 14, 'S'); L.set(109, 14, 'S'); L.set(114, 14, 'H');
      L.fill(95, 11, 105, 11, 'B'); L.row(96, 14, 'GGGGGGGG');
      L.row(98, 7, 'CPC');
      L.row(121, 12, '===');
      L.ground(125, 140);
      L.set(130, 14, 'H'); L.row(132, 11, 'CRC'); L.row(132, 8, 'G G');
      L.row(141, 11, '===='); L.row(141, 10, 'GGGG');
      L.ground(145, 179);
      L.set(150, 14, 'S'); L.set(156, 14, 'S'); L.set(162, 14, 'H');
      L.fill(164, 13, 164, 14, 'B'); L.fill(165, 12, 165, 14, 'B'); L.fill(166, 11, 167, 14, 'B');
      L.row(165, 9, 'GGG');
      L.set(173, 13, 'F');
    },
  },
  {
    name: 'Starry Night', theme: 'night', w: 190,
    build(L) {
      L.ground(0, 15); L.set(3, 14, '@');
      L.row(7, 11, 'CPC');
      L.row(17, 12, 'BB'); L.row(17, 11, 'GG');
      L.row(21, 10, 'BB'); L.row(21, 9, 'GG');
      L.row(25, 12, 'BB'); L.row(25, 11, 'GG');
      L.ground(29, 50);
      L.set(35, 14, 'H'); L.set(40, 14, 'S'); L.set(45, 14, 'H');
      L.row(38, 11, 'CPC');
      L.row(47, 14, '^^^');
      L.row(52, 11, '===='); L.row(58, 8, '===='); L.row(59, 7, 'GG'); L.row(64, 11, '====');
      L.ground(69, 95);
      L.set(72, 14, 'S'); L.set(78, 14, 'S'); L.set(84, 14, 'S'); L.set(91, 14, 'H');
      L.fill(80, 12, 80, 14, 'B'); L.fill(88, 11, 88, 14, 'B'); L.row(87, 9, 'GGG');
      L.row(97, 11, '==='); L.row(97, 10, 'GGG');
      L.ground(101, 130);
      L.row(110, 14, '^^^^'); L.row(109, 11, '======'); L.row(110, 10, 'GGGG');
      L.set(102, 14, 'K'); L.set(107, 14, 'S'); L.set(117, 14, 'S'); L.set(120, 14, 'H'); L.set(126, 14, 'H');
      L.row(121, 10, 'BRB');
      L.set(132, 12, 'B'); L.set(132, 11, 'G'); L.set(135, 10, 'B'); L.set(135, 9, 'G');
      L.ground(138, 189);
      L.set(145, 14, 'S'); L.set(150, 14, 'S'); L.set(155, 14, 'S'); L.set(160, 14, 'H');
      L.row(147, 11, 'GGGGGGGG');
      L.fill(170, 14, 170, 14, 'B'); L.fill(171, 13, 171, 14, 'B'); L.fill(172, 12, 172, 14, 'B');
      L.fill(173, 11, 173, 14, 'B'); L.fill(174, 10, 175, 14, 'B'); L.row(174, 8, 'GG');
      L.set(183, 13, 'F');
    },
  },
  {
    // World 4: barf. 'I' = fisalne wali barf, 'J' = spring (uchhaal deta hai)
    name: 'Frosty Peaks', theme: 'snow', w: 180,
    build(L) {
      L.ground(0, 25); L.set(3, 14, '@');
      L.row(8, 11, 'CBPBC'); L.row(9, 8, 'G G G');
      L.fill(14, 15, 25, 15, 'I'); L.set(18, 14, 'S'); L.row(16, 12, 'GGG');
      L.ground(30, 55);
      L.fill(34, 15, 44, 15, 'I'); L.set(40, 14, 'H'); L.set(48, 14, 'S');
      L.row(36, 11, '====='); L.row(37, 10, 'GGG');
      L.set(52, 15, 'J'); L.row(51, 7, 'GGG');
      L.row(56, 7, '====='); L.row(57, 6, 'GGG');
      L.ground(61, 90);
      L.fill(66, 13, 67, 14, 'I'); L.set(71, 14, 'S'); L.set(84, 14, 'H');
      L.row(72, 11, 'BRB'); L.set(79, 14, 'K');
      L.fill(86, 14, 86, 14, 'I'); L.fill(87, 13, 87, 14, 'I'); L.fill(88, 12, 90, 14, 'I');
      L.row(92, 11, '==='); L.row(92, 10, 'GGG');
      L.ground(96, 130);
      L.fill(100, 15, 115, 15, 'I'); L.row(106, 14, '^^');
      L.set(102, 14, 'S'); L.set(118, 14, 'S'); L.set(125, 14, 'H');
      L.row(104, 10, 'GGGG'); L.row(110, 11, 'CPC');
      L.ground(135, 179);
      L.set(140, 15, 'J'); L.fill(143, 8, 144, 14, 'B'); L.row(143, 7, 'GG'); L.row(139, 6, 'GGG');
      L.set(150, 14, 'S'); L.set(156, 14, 'S'); L.set(162, 14, 'H');
      L.fill(166, 14, 166, 14, 'I'); L.fill(167, 13, 167, 14, 'I'); L.fill(168, 12, 169, 14, 'I'); L.row(167, 10, 'GGG');
      L.set(175, 13, 'F');
    },
  },
  {
    // World 5: andheri gufa, neechi chhat aur tunnel
    name: 'Crystal Caves', theme: 'cave', w: 190,
    build(L) {
      L.fill(0, 0, 189, 1, 'B');
      L.ground(0, 30); L.set(3, 14, '@');
      L.row(7, 11, 'CPC'); L.set(14, 14, 'S'); L.set(20, 14, 'S');
      L.fill(24, 2, 25, 9, 'B'); L.row(23, 12, 'GGGG');
      L.ground(34, 70);
      L.fill(40, 2, 60, 11, 'B'); L.set(44, 11, 'C'); L.set(52, 11, 'C');
      L.row(41, 14, 'GGGGGGGGGGGGGGGGGGG'); L.set(48, 14, 'S'); L.set(56, 14, 'S');
      L.set(66, 14, 'K');
      L.ground(75, 110);
      L.row(80, 14, '^^^^'); L.row(79, 11, '======'); L.row(80, 10, 'GGGG');
      L.set(88, 14, 'H'); L.set(94, 14, 'S'); L.set(100, 14, 'H');
      L.row(85, 11, 'GGG');
      L.fill(104, 2, 106, 10, 'B');
      L.set(113, 12, 'B'); L.set(113, 11, 'G');
      L.ground(116, 150);
      L.set(120, 15, 'J'); L.row(119, 4, 'GGG');
      L.set(125, 14, 'S'); L.set(132, 14, 'S'); L.set(140, 14, 'S'); L.set(146, 14, 'H');
      L.row(128, 11, 'CRPCC');
      L.ground(155, 189);
      L.set(160, 14, 'S'); L.set(166, 14, 'S'); L.set(171, 14, 'H');
      L.fill(175, 14, 175, 14, 'B'); L.fill(176, 13, 176, 14, 'B'); L.fill(177, 12, 178, 14, 'B'); L.row(176, 10, 'GGG');
      L.set(183, 13, 'F');
    },
  },
  {
    // World 6: hawa mein tairte tapu. Neeche gire to gaye!
    name: 'Sky Islands', theme: 'sky', w: 200,
    build(L) {
      const island = (x1, x2, y) => L.fill(x1, y, x2, y + 1, '#');
      island(0, 14, 15); L.set(3, 14, '@');
      L.row(6, 11, 'CPC');
      island(18, 24, 13); L.row(19, 11, 'GGG');
      island(28, 33, 11); L.set(31, 10, 'S');
      island(37, 45, 13); L.set(44, 13, 'J'); L.row(40, 11, 'GG');
      island(48, 55, 7); L.row(49, 5, 'GGGGG'); L.set(53, 6, 'S');
      island(59, 66, 12); L.set(61, 11, 'K'); L.set(65, 11, 'S');
      L.row(70, 11, '===='); L.row(76, 9, '===='); L.row(77, 8, 'GG'); L.row(82, 11, '====');
      island(88, 100, 13); L.set(91, 12, 'S'); L.set(96, 12, 'S'); L.row(93, 9, 'BRB');
      L.set(100, 13, 'J');
      island(106, 114, 9); L.row(107, 7, 'GGGGG'); L.set(112, 8, 'S');
      island(118, 124, 12); L.row(119, 10, 'GGG');
      island(128, 140, 14); L.set(131, 13, 'S'); L.set(138, 13, 'H'); L.row(133, 10, 'CPC');
      L.row(143, 12, '===='); L.row(149, 10, '===='); L.row(150, 9, 'GG');
      island(155, 199, 13);
      L.set(165, 12, 'H'); L.set(170, 12, 'S'); L.set(176, 12, 'S');
      L.set(184, 12, 'B'); L.fill(185, 11, 185, 12, 'B'); L.fill(186, 10, 187, 12, 'B'); L.row(185, 8, 'GGG');
      L.set(193, 11, 'F');
    },
  },
  {
    // BOSS LEVEL: tile 20 ke baad arena hai, wahan Magmo intezaar kar raha hai
    name: 'Magma Den', theme: 'lava', w: 50, boss: true,
    build(L) {
      L.ground(0, 49); L.set(3, 14, '@');
      L.row(6, 10, 'GGGG'); L.row(8, 11, 'RBP'); L.set(13, 14, 'K');
      L.row(25, 11, '===='); L.row(41, 11, '===='); L.row(32, 8, '===='); L.row(33, 7, 'GG');
    },
  },
];

function buildGrid(def) {
  const g = [];
  for (let r = 0; r < ROWS; r++) g.push(new Array(def.w).fill('.'));
  const L = {
    set(x, y, c) { if (x >= 0 && x < def.w && y >= 0 && y < ROWS) g[y][x] = c; },
    fill(x1, y1, x2, y2, c) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, c); },
    ground(x1, x2, top = 15) { this.fill(x1, top, x2, ROWS - 1, '#'); },
    row(x, y, s) { for (let i = 0; i < s.length; i++) if (s[i] !== ' ') this.set(x + i, y, s[i]); },
  };
  def.build(L);
  return g;
}

// ---------- Game state ----------
let state = 'title';
let levelIndex = 0, level, player, enemies, gems, items, particles, popups, bumps, portal, flags = [];
let checkpoint = null; // { level, tx }
let score = 0, gemCount = 0, lives = 3, timeLeft = 0, stateTimer = 0, frame = 0, paused = false;
const cam = { x: 0 };

const SOLID = new Set(['#', 'B', 'C', 'P', 'R', 'X', 'I', 'J']);
let fireballs = [];
function tileAt(tx, ty) {
  if (ty < 0 || ty >= ROWS) return '.';
  if (tx < 0 || tx >= level.w) return '#';
  return level.grid[ty][tx];
}
const isSolid = (tx, ty) => SOLID.has(tileAt(tx, ty));
const isOneWay = (tx, ty) => tileAt(tx, ty) === '=';
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function footTiles(e) {
  const ty = Math.floor((e.y + e.h + 1) / TILE), out = [];
  for (let tx = Math.floor(e.x / TILE); tx <= Math.floor((e.x + e.w - 0.01) / TILE); tx++) out.push(tileAt(tx, ty));
  return out;
}

function newPlayer(x, y, leaf, fire = false) {
  return { x, y, w: 22, h: 28, vx: 0, vy: 0, facing: 1, onGround: false, coyote: 0, buffer: 0,
           jumping: false, leaf, fire, fireCd: 0, sx: 1, sy: 1, wasGround: true, shootT: 0, canDouble: false, invuln: 0, anim: 0, dying: false, prevBottom: 0 };
}

function loadLevel(i, keepLeaf = false, keepFire = false) {
  const def = LEVELS[i];
  level = { w: def.w, grid: buildGrid(def), theme: THEMES[def.theme], name: def.name };
  enemies = []; gems = []; items = []; particles = []; popups = []; bumps = []; portal = null; flags = []; fireballs = [];
  let start = { x: 64, y: 400 };
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < level.w; tx++) {
    const c = level.grid[ty][tx];
    const px = tx * TILE, py = ty * TILE;
    if (c === '@') start = { x: px + 5, y: py + TILE - 28 };
    else if (c === 'S') enemies.push({ type: 'slime', x: px + 2, y: py + 10, w: 28, h: 22, vx: -0.8, speed: 0.8, vy: 0 });
    else if (c === 'H') enemies.push({ type: 'hedge', x: px + 2, y: py + 10, w: 28, h: 22, vx: -1.1, speed: 1.1, vy: 0 });
    else if (c === 'G') gems.push({ x: px + 8, y: py + 6, w: 16, h: 20, phase: tx * 0.7 });
    else if (c === 'F') portal = { x: px, y: py, w: 32, h: 64 };
    else if (c === 'K') flags.push({ x: px + 4, y: py - 52, w: 24, h: 84, tx, active: false, wave: 0 });
    else continue;
    level.grid[ty][tx] = '.';
  }
  enemies.forEach(e => { e.active = false; e.dead = 0; e.anim = Math.random() * 6; });
  // checkpoint mila hua hai to wahin se shuru karo
  if (checkpoint && checkpoint.level === i) {
    const f = flags.find(f => f.tx === checkpoint.tx);
    if (f) {
      f.active = true; f.wave = 1;
      start = { x: f.x + 30, y: 14 * TILE + TILE - 28 };
      // flag ke aas-paas ke dushman hata do, taaki respawn hote hi maar na khao
      enemies = enemies.filter(e => Math.abs(e.x - start.x) > TILE * 5);
    }
  }
  player = newPlayer(start.x, start.y, keepLeaf, keepFire);
  boss = def.boss ? makeBoss() : null;
  bossStarted = false; bossIntro = 0; waves = [];
  timeLeft = 300 * 60;
  cam.x = Math.max(0, Math.min(player.x + player.w / 2 - W * 0.42, level.w * TILE - W));
}

function startGame() {
  score = 0; gemCount = 0; lives = 3; levelIndex = 0; checkpoint = null; newHigh = false;
  loadLevel(0);
  state = 'ready'; stateTimer = 0;
}

// ---------- High score (browser mein save hota hai) ----------
const HS_KEY = 'tikkuRunHighScore';
let highScore = 0, newHigh = false;
try { highScore = parseInt(localStorage.getItem(HS_KEY)) || 0; } catch (e) {}
function saveHighScore() {
  if (score > highScore) {
    highScore = score; newHigh = true;
    try { localStorage.setItem(HS_KEY, String(highScore)); } catch (e) {}
  }
}

// ---------- Physics helpers ----------
function collideX(e) {
  e.hitWall = false;
  const top = Math.floor(e.y / TILE), bot = Math.floor((e.y + e.h - 1) / TILE);
  if (e.vx > 0) {
    const tx = Math.floor((e.x + e.w) / TILE);
    for (let ty = top; ty <= bot; ty++) if (isSolid(tx, ty)) { e.x = tx * TILE - e.w - 0.01; e.vx = 0; e.hitWall = true; break; }
  } else if (e.vx < 0) {
    const tx = Math.floor(e.x / TILE);
    for (let ty = top; ty <= bot; ty++) if (isSolid(tx, ty)) { e.x = (tx + 1) * TILE; e.vx = 0; e.hitWall = true; break; }
  }
}
function collideY(e, isPlayer) {
  e.onGround = false;
  const left = Math.floor(e.x / TILE), right = Math.floor((e.x + e.w - 0.01) / TILE);
  if (e.vy > 0) {
    const ty = Math.floor((e.y + e.h) / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, ty) || (!e.noPlat && isOneWay(tx, ty) && e.prevBottom <= ty * TILE + 0.5)) {
        e.y = ty * TILE - e.h; e.vy = 0; e.onGround = true; break;
      }
    }
  } else if (e.vy < 0) {
    const ty = Math.floor(e.y / TILE);
    const hits = [];
    for (let tx = left; tx <= right; tx++) if (isSolid(tx, ty)) hits.push(tx);
    if (hits.length) {
      e.y = (ty + 1) * TILE; e.vy = 0;
      if (isPlayer) {
        const cx = Math.floor((e.x + e.w / 2) / TILE);
        bumpTile(hits.includes(cx) ? cx : hits[0], ty);
      }
    }
  }
}

function bumpTile(tx, ty) {
  const t = tileAt(tx, ty);
  if (t === 'C') {
    level.grid[ty][tx] = 'X';
    addGem(); score += 50; floatText(tx * TILE + 16, ty * TILE - 24, '+50', '#b3e5fc');
    popups.push({ x: tx * TILE + 16, y: ty * TILE - 8, vy: -7, life: 28 });
  } else if (t === 'R') {
    level.grid[ty][tx] = 'X';
    items.push({ x: tx * TILE + 4, y: ty * TILE, w: 24, h: 24, targetY: ty * TILE - 28, phase: 0, kind: 'fire' });
    SFX.appear();
  } else if (t === 'P') {
    level.grid[ty][tx] = 'X';
    items.push({ x: tx * TILE + 4, y: ty * TILE, w: 24, h: 24, targetY: ty * TILE - 28, phase: 0 });
    SFX.appear();
  } else SFX.bump();
  bumps.push({ tx, ty, t: 10 });
  // jo dushman us block ke upar khade hain, wo uchhal ke gir jaate hain
  enemies.forEach(e => {
    if (!e.dead && Math.abs(e.y + e.h - ty * TILE) < 4 && e.x + e.w > tx * TILE && e.x < (tx + 1) * TILE) {
      killEnemy(e, true);
    }
  });
}

function addGem() {
  gemCount++; SFX.gem();
  if (gemCount >= 100) { gemCount -= 100; lives++; SFX.life(); }
}

function killEnemy(e, flip) {
  e.dead = 1; e.flip = !!flip;
  if (flip) { e.vy = -7; }
  score += 200;
  SFX.stomp();
  floatText(e.x + e.w / 2, e.y - 6, '+200', '#fff59d');
  puff(e.x + e.w / 2, e.y + e.h, 5, e.type === 'slime' ? 'rgba(186,140,255,0.85)' : 'rgba(200,180,160,0.85)');
  for (let i = 0; i < 8; i++) particles.push({
    x: e.x + e.w / 2, y: e.y + e.h / 2, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4,
    life: 30, color: e.type === 'slime' ? '#b06cff' : '#8d6e63' });
}

function hurtPlayer() {
  if (player.invuln > 0 || player.dying) return;
  if (player.fire) {
    player.fire = false; player.invuln = 110; SFX.hurt();
    for (let i = 0; i < 10; i++) particles.push({ x: player.x + 11, y: player.y, vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 5, life: 40, color: '#ff7043' });
  } else if (player.leaf) {
    player.leaf = false; player.invuln = 110; SFX.hurt();
    for (let i = 0; i < 10; i++) particles.push({ x: player.x + 11, y: player.y, vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 5, life: 40, color: '#66bb6a' });
  } else killPlayer(false);
}

function killPlayer(fell) {
  if (player.dying) return;
  player.dying = true; player.vx = 0; player.vy = fell ? 0 : -10;
  state = 'dying'; stateTimer = 0; SFX.die();
}

// ---------- Update ----------
function update() {
  frame++;
  if (hit('KeyM')) muted = !muted;
  if (hit('KeyN')) musicOn = !musicOn;
  if (hit('KeyL')) setLang(lang === 'hi' ? 'en' : 'hi');
  if (shake > 0) shake *= 0.85;
  if (shake < 0.5) shake = 0;
  // kis screen pe kaunsa gaana
  if (state === 'title' || state === 'win') setMusic('title');
  else if (state === 'ready' || state === 'playing') setMusic(boss && bossStarted && !boss.dead ? 'boss' : LEVELS[levelIndex].theme);
  else setMusic(null);

  // title par background dheere-dheere sarakta hai
  if (state === 'title' && level) cam.x = (0.5 - 0.5 * Math.cos(frame * 0.0015)) * (level.w * TILE - W);
  if (state === 'title' || state === 'gameover' || state === 'win') {
    if (hit('Enter', ...JUMP_KEYS)) startGame();
  } else if (state === 'ready') {
    stateTimer++;
    if (stateTimer > 90 || (stateTimer > 20 && hit('Enter', ...JUMP_KEYS))) state = 'playing';
  } else if (state === 'playing') {
    if (hit('KeyP', 'Escape')) paused = !paused;
    if (!paused) updatePlaying();
  } else if (state === 'dying') {
    stateTimer++;
    if (stateTimer > 25) { player.vy = Math.min(player.vy + GRAV, MAX_FALL); player.y += player.vy; }
    updateParticles();
    if (stateTimer > 150) {
      lives--;
      if (lives <= 0) { state = 'gameover'; stateTimer = 0; saveHighScore(); }
      else { loadLevel(levelIndex); state = 'ready'; stateTimer = 0; }
    }
  } else if (state === 'clear') {
    stateTimer++;
    // bacha hua time score mein convert hota hai
    if (timeLeft > 0) { const d = Math.min(timeLeft, 60 * 3); timeLeft -= d; score += Math.floor(d / 60) * 10; }
    updateParticles();
    if (stateTimer > 180) {
      levelIndex++; checkpoint = null; saveHighScore();
      if (levelIndex >= LEVELS.length) { state = 'win'; stateTimer = 0; }
      else { loadLevel(levelIndex, player.leaf, player.fire); state = 'ready'; stateTimer = 0; }
    }
  }
  pressed.clear();
}

const fireBtn = document.getElementById('firebtn');
function updatePlaying() {
  if (fireBtn) fireBtn.classList.toggle('off', !player.fire);
  const p = player;
  const left = down('ArrowLeft', 'KeyA'), right = down('ArrowRight', 'KeyD');
  const run = down('ShiftLeft', 'ShiftRight', 'KeyX');
  const jumpHeld = down(...JUMP_KEYS);
  const max = run ? 5.2 : 3.2;
  const onIce = p.onGround && footTiles(p).includes('I');
  const acc = onIce ? 0.13 : p.onGround ? 0.45 : 0.32;

  if (left && !right) { p.vx -= acc; p.facing = -1; }
  else if (right && !left) { p.vx += acc; p.facing = 1; }
  else { p.vx *= onIce ? 0.985 : p.onGround ? 0.78 : 0.96; if (Math.abs(p.vx) < 0.05) p.vx = 0; }
  if (Math.abs(p.vx) > max) p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) * 0.92);

  p.coyote = p.onGround ? 7 : p.coyote - 1;
  p.buffer = hit(...JUMP_KEYS) ? 7 : p.buffer - 1;
  if (p.buffer > 0) {
    if (p.coyote > 0) {
      p.vy = -13; p.coyote = 0; p.buffer = 0; p.jumping = true; SFX.jump();
      p.sx = 0.72; p.sy = 1.3; puff(p.x + p.w / 2, p.y + p.h, 5);
    } else if (p.leaf && p.canDouble) {
      p.vy = -11; p.canDouble = false; p.buffer = 0; p.jumping = true; SFX.djump();
      p.sx = 0.8; p.sy = 1.25;
      for (let i = 0; i < 8; i++) particles.push({ x: p.x + 11, y: p.y + p.h, vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 2, life: 20, color: '#a5d6a7' });
    }
  }
  if (p.jumping && !jumpHeld && p.vy < -3) { p.vy *= 0.45; p.jumping = false; }
  if (p.vy >= 0) p.jumping = false;

  p.vy = Math.min(p.vy + GRAV, MAX_FALL);
  p.x += p.vx; collideX(p);
  if (p.x < 0) { p.x = 0; p.vx = 0; }
  p.prevBottom = p.y + p.h;
  const vyBefore = p.vy;
  p.y += p.vy; collideY(p, true);
  if (p.onGround && !p.wasGround && vyBefore > 3) { // zameen pe girne par dabna + dhool
    p.sx = 1.3; p.sy = 0.72; puff(p.x + p.w / 2, p.y + p.h, vyBefore > 9 ? 8 : 4);
  }
  p.wasGround = p.onGround;
  // FIRE: F (ya C) dabao, ek baar mein max 2 gole
  if (p.fireCd > 0) p.fireCd--;
  if (p.fire && hit('KeyF', 'KeyC') && p.fireCd === 0 && fireballs.length < 2) {
    fireballs.push({ x: p.facing > 0 ? p.x + p.w : p.x - 12, y: p.y + 8, w: 12, h: 12,
                     vx: 7.5 * p.facing, vy: 2, life: 150, spin: 0 });
    p.fireCd = 16; p.shootT = 10;
    beep(760, 260, 0.14, 'square', 0.05);
  }
  // spring pe gire to upar uchhal jaao
  if (p.onGround && footTiles(p).includes('J')) {
    p.vy = jumpHeld ? -18.5 : -16; p.onGround = false; p.jumping = false; p.coyote = 0;
    p.sx = 0.7; p.sy = 1.38; p.wasGround = false;
    const ty = Math.floor((p.y + p.h + 1) / TILE);
    for (let tx = Math.floor(p.x / TILE); tx <= Math.floor((p.x + p.w - 0.01) / TILE); tx++)
      if (tileAt(tx, ty) === 'J') bumps.push({ tx, ty, t: 10, spring: true });
    beep(200, 900, 0.25, 'triangle', 0.09);
  }
  if (p.onGround) p.canDouble = p.leaf;
  p.anim += Math.abs(p.vx) * 0.12;
  p.sx += (1 - p.sx) * 0.2; p.sy += (1 - p.sy) * 0.2;
  if (p.shootT > 0) p.shootT--;
  if (p.onGround && Math.abs(p.vx) > 4.5 && frame % 7 === 0) puff(p.x + p.w / 2 - p.facing * 8, p.y + p.h, 1);
  if (p.invuln > 0) p.invuln--;

  // spikes
  {
    const l = Math.floor(p.x / TILE), r = Math.floor((p.x + p.w) / TILE);
    const t = Math.floor(p.y / TILE), b = Math.floor((p.y + p.h) / TILE);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++)
      if (tileAt(tx, ty) === '^' && overlap(p, { x: tx * TILE + 4, y: ty * TILE + 16, w: 24, h: 16 })) hurtPlayer();
  }
  if (p.y > ROWS * TILE + 20) { killPlayer(true); return; }

  // timer
  timeLeft--;
  if (timeLeft <= 0) { timeLeft = 0; killPlayer(false); return; }

  // camera
  const target = p.x + p.w / 2 - W * 0.42;
  cam.x += (target - cam.x) * 0.15;
  cam.x = Math.max(0, Math.min(cam.x, level.w * TILE - W));

  if (bossStarted) cam.x += (level.w * TILE - W - cam.x) * 0.12; // arena mein camera ruk jaata hai
  updateEnemies();
  updateBoss();
  updateFireballs();

  // gems
  for (const g of gems) if (!g.got && overlap(p, g)) {
    g.got = true; addGem(); score += 50; floatText(g.x + 8, g.y - 4, '+50', '#b3e5fc');
    for (let i = 0; i < 6; i++) particles.push({ x: g.x + 8, y: g.y + 10, vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3, life: 20, color: '#80deea' });
  }
  gems = gems.filter(g => !g.got);

  // leaf power-up
  for (const it of items) {
    if (it.y > it.targetY) it.y = Math.max(it.targetY, it.y - 1.2);
    it.phase += 0.08;
    if (!it.got && it.y <= it.targetY + 10 && overlap(p, it)) {
      it.got = true; SFX.power();
      floatText(it.x + 12, it.y - 6, it.kind === 'fire' ? 'FIRE!' : 'LEAF!', it.kind === 'fire' ? '#ffab40' : '#c5e1a5', 18);
      if (it.kind === 'fire') { score += p.fire ? 1000 : 500; p.fire = true; }
      else { score += p.leaf ? 1000 : 500; p.leaf = true; p.canDouble = !p.onGround; }
    }
  }
  items = items.filter(i => !i.got);

  // popups & bumps
  for (const pu of popups) { pu.y += pu.vy; pu.vy += 0.5; pu.life--; }
  popups = popups.filter(pu => pu.life > 0);
  for (const b of bumps) b.t--;
  bumps = bumps.filter(b => b.t > 0);
  updateParticles();

  // checkpoint flags
  for (const f of flags) {
    if (f.wave) f.wave++;
    if (!f.active && overlap(p, f)) {
      flags.forEach(o => { o.active = false; });
      f.active = true; f.wave = 1;
      checkpoint = { level: levelIndex, tx: f.tx };
      score += 100; SFX.life(); floatText(f.x + 12, f.y - 8, 'CHECKPOINT', '#a5d6a7');
      for (let i = 0; i < 16; i++) particles.push({ x: f.x + 12, y: f.y + 10, vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5, life: 40, color: ['#ffca28', '#66bb6a', '#ffffff'][i % 3] });
    }
  }

  // portal
  if (portal && overlap(p, { x: portal.x + 6, y: portal.y, w: 20, h: 64 })) {
    state = 'clear'; stateTimer = 0; SFX.clear();
    for (let i = 0; i < 30; i++) particles.push({ x: portal.x + 16, y: portal.y + 32, vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8, life: 50, color: ['#ffeb3b', '#e040fb', '#40c4ff'][i % 3] });
  }
}

function updateEnemies() {
  const p = player;
  for (const e of enemies) {
    if (!e.active) { if (e.x < cam.x + W + 64) e.active = true; else continue; }
    e.anim += 0.15;
    if (e.dead) {
      e.dead++;
      if (e.flip) { e.vy += GRAV; e.y += e.vy; }
      continue;
    }
    e.vy = Math.min(e.vy + GRAV, MAX_FALL);
    const dir = Math.sign(e.vx) || -1;
    e.x += e.vx; collideX(e);
    if (e.hitWall) e.vx = -dir * e.speed;
    e.prevBottom = e.y + e.h;
    e.y += e.vy; collideY(e, false);
    if (e.onGround) {
      const d = Math.sign(e.vx);
      const ax = d > 0 ? Math.floor((e.x + e.w + 1) / TILE) : Math.floor((e.x - 1) / TILE);
      const ay = Math.floor((e.y + e.h + 2) / TILE);
      if (!isSolid(ax, ay) && !isOneWay(ax, ay)) e.vx = -e.vx;
    }
    if (e.y > ROWS * TILE + 64) e.dead = 999;

    if (!p.dying && overlap(p, e)) {
      const stompable = e.type === 'slime';
      if (stompable && p.vy > 0 && p.prevBottom <= e.y + 10) {
        killEnemy(e, false);
        p.vy = down(...JUMP_KEYS) ? -12 : -8; p.jumping = true; p.sx = 0.8; p.sy = 1.25;
        p.canDouble = p.leaf;
      } else hurtPlayer();
    }
  }
  // dushman ek doosre se takra ke mudte hain
  const live = enemies.filter(e => e.active && !e.dead);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    if (overlap(a, b)) {
      if (a.x < b.x) { a.vx = -a.speed; b.vx = b.speed; } else { a.vx = a.speed; b.vx = -b.speed; }
    }
  }
  enemies = enemies.filter(e => !(e.dead > 40 && !e.flip) && !(e.dead && e.y > ROWS * TILE + 64));
}

function updateParticles() {
  for (const pt of particles) { pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.g !== undefined ? pt.g : 0.2; if (pt.grow) pt.r += pt.grow; pt.life--; }
  particles = particles.filter(pt => pt.life > 0);
}

// ---------- Drawing ----------
function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: (i * 197.3) % 1400, y: (i * 73.7) % 300, s: (i % 3) + 1, tw: i * 0.37 }));

function drawBackground(th, cx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.top); g.addColorStop(1, th.bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (th.stars) {
    for (const s of STARS) {
      const x = ((s.x - cx * 0.05) % 1400 + 1400) % 1400 - 200;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frame * 0.05 + s.tw);
      ctx.fillStyle = '#fff'; ctx.fillRect(x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }
  // sun / moon
  if (th.sun) {
  ctx.fillStyle = th.sun;
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(W - 160 - cx * 0.02, 100, th.stars ? 36 : 50, 0, Math.PI * 2); ctx.fill();
  if (th.stars) { ctx.fillStyle = th.top; ctx.beginPath(); ctx.arc(W - 146 - cx * 0.02, 90, 32, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  }

  // clouds
  ctx.fillStyle = th.stars ? 'rgba(255,255,255,0.08)' : th.embers ? 'rgba(70,35,40,0.55)' : 'rgba(255,255,255,0.85)';
  for (let i = 0; i < (th.cave ? 0 : th.sky ? 12 : 7); i++) {
    const x = ((i * 310 - cx * 0.2 + frame * 0.15) % 1500 + 1500) % 1500 - 200;
    const y = 50 + (i * 53) % 140;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.arc(x + 25, y - 10, 28, 0, Math.PI * 2);
    ctx.arc(x + 55, y, 22, 0, Math.PI * 2); ctx.fillRect(x, y, 55, 22);
    ctx.fill();
  }
  if (th.cave) { // chamakte crystals
    for (let i = 0; i < 14; i++) {
      const x = ((i * 173 - cx * 0.15) % 1300 + 1300) % 1300 - 150, y = 90 + (i * 61) % 220, hgt = 18 + (i % 4) * 8;
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(frame * 0.04 + i);
      ctx.fillStyle = ['#7c4dff', '#40c4ff', '#e040fb'][i % 3];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y - hgt); ctx.lineTo(x + 14, y); ctx.lineTo(x + 7, y + 8); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (th.snow) { // barf girti hai
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 70; i++) {
      const x = ((i * 137 - cx * 0.4 + Math.sin(frame * 0.02 + i) * 20) % 1100 + 1100) % 1100 - 70;
      const y = ((frame * (0.8 + (i % 4) * 0.3) + i * 47) % (H + 20)) - 10;
      ctx.fillRect(x, y, 2 + (i % 2), 2 + (i % 2));
    }
  }
  if (th.embers) {
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97 - cx * 0.3) % 1100 + 1100) % 1100 - 70;
      const y = H - ((frame * (0.6 + (i % 5) * 0.2) + i * 53) % (H + 40));
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(frame * 0.1 + i);
      ctx.fillStyle = i % 3 ? '#ff8a50' : '#ffd54f';
      ctx.fillRect(x + Math.sin(frame * 0.03 + i) * 10, y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
  // hills
  hills(th.far, 0.25, 330, 60, 0.006, 0.013);
  hills(th.near, 0.5, 400, 45, 0.009, 0.004);
  drawScenery(th, cx);
}
function hills(color, par, base, amp, f1, f2) {
  const off = cam.x * par;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const wx = x + off;
    ctx.lineTo(x, base - Math.sin(wx * f1) * amp - Math.sin(wx * f2 + 1.3) * amp * 0.5);
  }
  ctx.lineTo(W, H); ctx.fill();
}

function bumpOffset(tx, ty) {
  for (const b of bumps) if (b.tx === tx && b.ty === ty) return -Math.sin((b.t / 10) * Math.PI) * 8;
  return 0;
}

// har tile ke liye ek fixed "random" number, taaki detail har frame same rahe
function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const GROUNDISH = new Set(['#', 'I', 'J']);

// zameen ke upar chhoti cheezein: ghaas, phool, patthar, barf, crystal
function drawGroundDecor(th, x, y, tx, hsh) {
  const kind = hsh % 7;
  const sway = Math.sin(frame * 0.05 + tx * 1.7) * 1.2;
  const ox = x + 6 + ((hsh >> 3) % 20);
  if (th.snow) {
    if (kind < 2) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ox, y + 1, 7, 4, 0, Math.PI, 0); ctx.fill(); }
    else if (kind === 2) { ctx.fillStyle = '#cfefff'; ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + 3, y - 9); ctx.lineTo(ox + 6, y); ctx.fill(); }
    return;
  }
  if (th.cave) {
    if (kind < 2) {
      ctx.save(); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(frame * 0.06 + tx);
      ctx.fillStyle = kind ? '#40c4ff' : '#b388ff';
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + 3, y - 10 - kind * 3); ctx.lineTo(ox + 6, y); ctx.fill();
      ctx.restore();
    }
    return;
  }
  if (th.embers) {
    if (kind < 2) { ctx.fillStyle = `rgba(255,${120 + ((frame * 3 + tx * 40) % 80)},60,0.85)`; ctx.fillRect(ox, y - 2, 3, 2); }
    return;
  }
  if (kind <= 2) { // ghaas ki pattiyan
    ctx.fillStyle = th.grass;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(ox + i * 3, y + 1); ctx.lineTo(ox + i * 3 + 1 + sway, y - 6 - (i % 2) * 3); ctx.lineTo(ox + i * 3 + 3, y + 1); ctx.fill();
    }
  } else if (kind <= 4) { // phool
    const cols = th.stars ? ['#80d8ff', '#b388ff'] : ['#ff6f91', '#ffd54f', '#ffffff', '#ce93d8'];
    const c = cols[(hsh >> 5) % cols.length];
    const fx = ox + sway, fy = y - 8;
    ctx.strokeStyle = '#3f8f3f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox, y + 1); ctx.lineTo(fx, fy); ctx.stroke();
    if (th.stars) { ctx.fillStyle = 'rgba(128,216,255,0.25)'; ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = c;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 2.4, fy + Math.sin(a) * 2.4, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(fx, fy, 1.4, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 5) { // chhota patthar
    ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.ellipse(ox, y, 4, 3, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#bdbdbd'; ctx.fillRect(ox - 2, y - 2, 2, 1);
  }
}

function drawTiles(th) {
  const x0 = Math.floor(cam.x / TILE), x1 = x0 + Math.ceil(W / TILE) + 1;
  for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx < 0 || tx >= level.w) continue;
    const t = level.grid[ty][tx];
    if (t === '.') continue;
    const x = tx * TILE, y = ty * TILE + bumpOffset(tx, ty);
    const hsh = hash2(tx, ty);
    if (t === '#') {
      ctx.fillStyle = th.dirt; ctx.fillRect(x, y, TILE, TILE);
      if (tileAt(tx, ty - 1) === '#' && tileAt(tx, ty - 2) === '#') { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, y, TILE, TILE); }
      ctx.fillStyle = th.dirtDark;
      ctx.beginPath(); ctx.ellipse(x + 6 + hsh % 18, y + 12 + (hsh >> 4) % 12, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 4 + (hsh >> 8) % 22, y + 20 + (hsh >> 12) % 8, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + (hsh >> 6) % 26, y + 6 + (hsh >> 10) % 18, 3, 2);
      const openL = !GROUNDISH.has(tileAt(tx - 1, ty)), openR = !GROUNDISH.has(tileAt(tx + 1, ty));
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      if (openL) ctx.fillRect(x, y, 3, TILE);
      if (openR) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      if (!GROUNDISH.has(tileAt(tx, ty - 1))) {
        ctx.fillStyle = th.grass; ctx.fillRect(x, y, TILE, 10);
        ctx.fillStyle = th.grassHi; ctx.fillRect(x, y, TILE, 3);
        ctx.fillStyle = th.grass; // neeche latakti ghaas
        for (let i = 0; i < 5; i++) {
          const gx = x + i * 6 + ((hsh >> i) % 3), gh = 3 + ((hsh >> (i * 2)) % 5);
          ctx.beginPath(); ctx.moveTo(gx, y + 9); ctx.lineTo(gx + 3, y + 9 + gh); ctx.lineTo(gx + 6, y + 9); ctx.fill();
        }
        if (openL) { ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x - 4, y + 3); ctx.lineTo(x - 2, y + 14); ctx.lineTo(x + 2, y + 10); ctx.fill(); }
        if (openR) { ctx.beginPath(); ctx.moveTo(x + TILE - 2, y); ctx.lineTo(x + TILE + 4, y + 3); ctx.lineTo(x + TILE + 2, y + 14); ctx.lineTo(x + TILE - 2, y + 10); ctx.fill(); }
        if (tileAt(tx, ty - 1) === '.') drawGroundDecor(th, x, y, tx, hsh);
      }
    } else if (t === 'B') {
      ctx.fillStyle = '#8f96a3'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#a9b0bd'; ctx.fillRect(x, y, TILE, 3); ctx.fillRect(x, y, 3, TILE);
      ctx.fillStyle = '#6b7280'; ctx.fillRect(x, y + TILE - 3, TILE, 3); ctx.fillRect(x + TILE - 3, y, 3, TILE);
      ctx.fillStyle = '#767e8c';
      ctx.fillRect(x + 3, y + 15, TILE - 6, 2); ctx.fillRect(x + 15, y + 3, 2, 12); ctx.fillRect(x + 8, y + 17, 2, 12); ctx.fillRect(x + 23, y + 17, 2, 12);
      if (hsh % 3 === 0) { // darar
        const cx0 = x + 5 + (hsh % 10);
        ctx.strokeStyle = '#5b6270'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx0, y + 4); ctx.lineTo(cx0 + 3, y + 9); ctx.lineTo(cx0 + 1, y + 13); ctx.stroke();
      }
      const openTop = tileAt(tx, ty - 1) === '.';
      if (openTop && th.snow) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 2, TILE, 5);
        ctx.beginPath(); ctx.ellipse(x + 8 + (hsh % 14), y + 3, 5, 3, 0, 0, Math.PI); ctx.fill();
      } else if (openTop && !th.cave && !th.embers) { // kaai (moss)
        ctx.fillStyle = '#6aa84f'; ctx.fillRect(x, y, TILE, 3);
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + ((hsh >> (i * 3)) % 24), y + 3, 3, 2 + ((hsh >> i) % 5));
      }
    } else if (t === 'C' || t === 'P' || t === 'R' || t === 'X') {
      const used = t === 'X';
      const dark = used ? '#54443a' : '#8d5a2b', light = used ? '#7d6a58' : '#dea468';
      ctx.fillStyle = used ? '#6d5a48' : '#c98b4a'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = dark; ctx.fillRect(x + 4, y + 11, TILE - 8, 1); ctx.fillRect(x + 4, y + 20, TILE - 8, 1);
      ctx.fillStyle = light; ctx.fillRect(x + 4, y + 4, TILE - 8, 1); ctx.fillRect(x + 4, y + 12, TILE - 8, 1); ctx.fillRect(x + 4, y + 21, TILE - 8, 1);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y, TILE, 4); ctx.fillRect(x, y + TILE - 4, TILE, 4);
      ctx.fillRect(x, y, 4, TILE); ctx.fillRect(x + TILE - 4, y, 4, TILE);
      ctx.fillStyle = used ? '#3e322a' : '#5d3a1a';
      ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x + TILE - 3, y + 1, 2, 2); ctx.fillRect(x + 1, y + TILE - 3, 2, 2); ctx.fillRect(x + TILE - 3, y + TILE - 3, 2, 2);
      if (!used) {
        ctx.fillStyle = dark;
        ctx.save(); ctx.translate(x + 16, y + 16); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-2, -18, 4, 36); ctx.restore();
        const pulse = 0.6 + 0.4 * Math.sin(frame * 0.1);
        ctx.fillStyle = `rgba(255,255,255,${0.1 * pulse})`; ctx.beginPath(); ctx.arc(x + 16, y + 16, 10, 0, Math.PI * 2); ctx.fill();
        if (t === 'C') drawGemShape(x + 16, y + 16, 7, pulse);
        else if (t === 'R') drawFlame(x + 16, y + 18, 7);
        else drawLeafShape(x + 16, y + 17, 9, 0);
      }
    } else if (t === '=') {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, y + 12, TILE, 3);
      ctx.fillStyle = '#a0703c'; ctx.fillRect(x, y, TILE, 12);
      ctx.fillStyle = '#d9a35e'; ctx.fillRect(x, y, TILE, 3);
      ctx.fillStyle = '#8a5d30'; ctx.fillRect(x, y + 7, TILE, 1);
      ctx.fillStyle = '#6e4a24'; ctx.fillRect(x + 30, y, 2, 12);
      ctx.fillRect(x + 4, y + 12, 3, 4); ctx.fillRect(x + 25, y + 12, 3, 4);
      ctx.fillStyle = '#4e342e'; ctx.fillRect(x + 4, y + 4, 2, 2); ctx.fillRect(x + 25, y + 4, 2, 2);
    } else if (t === 'I') {
      ctx.fillStyle = '#b9e6ff'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#e8f7ff'; ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x + 6, y + 10, 10, 2); ctx.fillRect(x + 18, y + 20, 8, 2);
      ctx.strokeStyle = '#7cc4ea'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if ((frame + hsh) % 140 < 12) { // chamak
        const sx = x + 6 + (hsh % 20), sy = y + 6 + ((hsh >> 4) % 16);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 3, sy, 7, 1); ctx.fillRect(sx, sy - 3, 1, 7);
      }
    } else if (t === 'J') {
      const b = bumps.find(b => b.tx === tx && b.ty === ty);
      const sq = b ? Math.sin((b.t / 10) * Math.PI) * 8 : 0;
      const yy = ty * TILE; // zameen mein laga spring: upar se chalo to uchhal jaao
      ctx.fillStyle = th.dirt; ctx.fillRect(x, yy, TILE, TILE);
      ctx.fillStyle = '#263238'; ctx.fillRect(x + 3, yy, 26, 30);
      ctx.fillStyle = '#546e7a'; ctx.fillRect(x + 2, yy + 26, 28, 6);
      ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 3; ctx.beginPath();
      const top = yy + sq;
      for (let i = 0; i <= 4; i++) ctx.lineTo(x + (i % 2 ? 24 : 8), top + 4 + ((yy + 26 - top - 4) * i) / 4);
      ctx.stroke();
      ctx.fillStyle = '#e53935'; ctx.fillRect(x + 1, top, 30, 6);
      ctx.fillStyle = '#ff8a80'; ctx.fillRect(x + 1, top, 30, 2);
    } else if (t === '^') {
      ctx.fillStyle = '#cfd8dc';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * 8, y + 32); ctx.lineTo(x + i * 8 + 4, y + 14); ctx.lineTo(x + i * 8 + 8, y + 32); ctx.fill();
      }
      ctx.fillStyle = '#90a4ae';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8 + 4, y + 14); ctx.lineTo(x + i * 8 + 8, y + 32); ctx.lineTo(x + i * 8 + 5, y + 32); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 8 + 3, y + 16, 1, 3);
    }
  }
}

// ---------- Background ki teesri layer: ped, chattanein, stalactites ----------
function roundTree(x, base, hgt, trunk, leaf) {
  ctx.fillStyle = trunk; ctx.fillRect(x - 4, base - hgt * 0.45, 8, hgt * 0.45);
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.arc(x, base - hgt * 0.62, hgt * 0.3, 0, Math.PI * 2);
  ctx.arc(x - hgt * 0.2, base - hgt * 0.45, hgt * 0.22, 0, Math.PI * 2);
  ctx.arc(x + hgt * 0.2, base - hgt * 0.47, hgt * 0.22, 0, Math.PI * 2);
  ctx.fill();
}
function pine(x, base, hgt, col, snowy) {
  ctx.fillStyle = '#4e3b31'; ctx.fillRect(x - 3, base - 10, 6, 10);
  for (let i = 0; i < 3; i++) {
    const w = hgt * (0.45 - i * 0.1), yb = base - 8 - i * hgt * 0.25;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w, yb); ctx.lineTo(x, yb - hgt * 0.4); ctx.lineTo(x + w, yb); ctx.fill();
    if (snowy) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(x - w * 0.35, yb - hgt * 0.26); ctx.lineTo(x, yb - hgt * 0.4); ctx.lineTo(x + w * 0.35, yb - hgt * 0.26); ctx.fill();
    }
  }
}
function spire(x, base, hgt, col, tip) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x - 16, base); ctx.lineTo(x - 5, base - hgt); ctx.lineTo(x + 4, base - hgt * 0.85); ctx.lineTo(x + 16, base); ctx.fill();
  if (tip) {
    ctx.fillStyle = tip; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(frame * 0.08 + x * 0.01);
    ctx.beginPath(); ctx.arc(x - 3, base - hgt + 5, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
}
function bush(x, base, s, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.arc(x, base - s * 0.2, s * 0.6, Math.PI, 0);
  ctx.arc(x + s * 0.7, base - s * 0.1, s * 0.5, Math.PI, 0);
  ctx.arc(x - s * 0.7, base - s * 0.05, s * 0.45, Math.PI, 0);
  ctx.fill();
}

function drawScenery(th, cx) {
  const par = 0.6, sp = 150, off = cx * par;
  const k0 = Math.floor((off - 200) / sp), k1 = Math.floor((off + W + 200) / sp);
  ctx.globalAlpha = 0.85;
  for (let k = k0; k <= k1; k++) {
    const h = hash2(k, 99), x = k * sp + (h % 70) - off, base = 470 + ((h >> 7) % 14), kind = (h >> 3) % 4;
    const size = 60 + ((h >> 9) % 50);
    if (th.cave) { // chhat se latakte stalactites
      const len = 40 + ((h >> 5) % 90);
      ctx.fillStyle = '#231e36';
      ctx.beginPath(); ctx.moveTo(x - 14, 40); ctx.lineTo(x, 40 + len); ctx.lineTo(x + 14, 40); ctx.fill();
      if (kind === 0) {
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(frame * 0.05 + k);
        ctx.fillStyle = '#7c4dff';
        ctx.beginPath(); ctx.moveTo(x - 4, 40 + len * 0.5); ctx.lineTo(x, 40 + len * 0.5 + 16); ctx.lineTo(x + 4, 40 + len * 0.5); ctx.fill();
        ctx.globalAlpha = 0.85;
      }
      continue;
    }
    if (kind === 3) continue;
    if (th === THEMES.day) { if (kind === 2) bush(x, base, 22, '#4f9d55'); else roundTree(x, base, size + 30, '#6d4c41', '#4e9a52'); }
    else if (th === THEMES.sunset) { if (kind === 2) bush(x, base, 18, '#a0525e'); else spire(x, base, size + 20, '#7a3f55'); }
    else if (th === THEMES.night) { if (kind === 2) bush(x, base, 20, '#1a2046'); else roundTree(x, base, size + 30, '#141936', '#1c2347'); }
    else if (th.snow) pine(x, base, size + 20, '#5f86a3', true);
    else if (th.embers) spire(x, base, size + 30, '#2b1420', kind === 0 ? '#ff7043' : null);
    else if (th.sky && kind === 0) { // door tairte chhote tapu
      const iy = 200 + ((h >> 11) % 120), w = 30 + ((h >> 13) % 30);
      ctx.fillStyle = '#9ccf9f'; ctx.beginPath(); ctx.ellipse(x, iy, w, 7, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#b7a58f'; ctx.beginPath(); ctx.moveTo(x - w, iy); ctx.lineTo(x, iy + w * 0.7); ctx.lineTo(x + w, iy); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  if (th.stars) { // jugnu
    for (let i = 0; i < 18; i++) {
      const fx = ((i * 211 + frame * 0.3 * ((i % 3) + 1) - cx * 0.7) % (W + 100) + W + 100) % (W + 100) - 50;
      const fy = 260 + Math.sin(frame * 0.02 + i) * 50 + ((i * 37) % 120);
      const a = 0.5 + 0.5 * Math.sin(frame * 0.09 + i * 2);
      ctx.fillStyle = `rgba(200,255,120,${0.25 * a})`; ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(230,255,160,${a})`; ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (th.sky || th === THEMES.day) { // panchhi
    ctx.strokeStyle = 'rgba(40,50,70,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < (th.sky ? 5 : 3); i++) {
      const bx = ((i * 400 + frame * 0.8 - cx * 0.3) % 1300 + 1300) % 1300 - 150;
      const by = 110 + i * 35 + Math.sin(frame * 0.05 + i) * 8;
      const flap = Math.sin(frame * 0.25 + i) * 4;
      ctx.beginPath(); ctx.moveTo(bx - 8, by - flap); ctx.lineTo(bx, by); ctx.lineTo(bx + 8, by - flap); ctx.stroke();
    }
  }
  // neeche halki dhundh
  const fog = ctx.createLinearGradient(0, 360, 0, 490);
  fog.addColorStop(0, 'rgba(255,255,255,0)');
  fog.addColorStop(1, th.cave || th.embers || th.stars ? 'rgba(20,10,30,0.35)' : 'rgba(255,255,255,0.28)');
  ctx.fillStyle = fog; ctx.fillRect(0, 360, W, 184);
}

function drawGemShape(cx, cy, r, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#29b6f6';
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.8, cy - r * 0.2); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.8, cy - r * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b3e5fc';
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.3, cy - r * 0.2); ctx.lineTo(cx - r * 0.3, cy - r * 0.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawLeafShape(cx, cy, r, rot) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot - 0.6);
  ctx.fillStyle = '#43a047';
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r, 0, 0, r); ctx.quadraticCurveTo(-r, 0, 0, -r); ctx.fill();
  ctx.strokeStyle = '#a5d6a7'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 1.2); ctx.stroke();
  ctx.restore();
}

function drawGems() {
  for (const g of gems) {
    const bob = Math.sin(frame * 0.08 + g.phase) * 2;
    const sx = Math.abs(Math.cos(frame * 0.05 + g.phase));
    ctx.fillStyle = 'rgba(128,222,234,0.22)';
    ctx.beginPath(); ctx.arc(g.x + 8, g.y + 10 + bob, 12 + Math.sin(frame * 0.1 + g.phase) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(g.x + 8, g.y + 10 + bob); ctx.scale(0.4 + sx * 0.6, 1);
    drawGemShape(0, 0, 10); ctx.restore();
    if ((frame + Math.floor(g.phase * 10)) % 90 < 8) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(g.x + 9, g.y + 2 + bob, 5, 1); ctx.fillRect(g.x + 11, g.y + bob, 1, 5);
    }
  }
  for (const pu of popups) drawGemShape(pu.x, pu.y, 9);
}

function drawItems() {
  for (const it of items) {
    const bob = it.y <= it.targetY ? Math.sin(it.phase) * 3 : 0;
    const fire = it.kind === 'fire';
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = fire ? '#ffab40' : '#c8e6c9';
    ctx.beginPath(); ctx.arc(it.x + 12, it.y + 12 + bob, 15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (fire) drawFlame(it.x + 12, it.y + 14 + bob, 9);
    else drawLeafShape(it.x + 12, it.y + 12 + bob, 12, Math.sin(it.phase) * 0.3);
  }
}

function drawPortal() {
  if (!portal) return;
  const cx = portal.x + 16, cy = portal.y + 34;
  const gl = ctx.createRadialGradient(cx, cy, 5, cx, cy, 75);
  gl.addColorStop(0, `rgba(224,64,251,${0.4 + 0.1 * Math.sin(frame * 0.08)})`); gl.addColorStop(1, 'rgba(224,64,251,0)');
  ctx.fillStyle = gl; ctx.fillRect(cx - 75, cy - 75, 150, 150);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(portal.x - 6, portal.y + 60, 44, 4);
  for (let i = 4; i > 0; i--) {
    ctx.strokeStyle = ['#ffeb3b', '#e040fb', '#40c4ff', '#ffffff'][i - 1];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 6 + i * 4 + Math.sin(frame * 0.1 + i) * 1.5, 12 + i * 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 5; i++) {
    const a = frame * 0.05 + i * 1.256;
    ctx.fillRect(cx + Math.cos(a) * 18 - 1, cy + Math.sin(a) * 30 - 1, 3, 3);
  }
}

function drawFlags() {
  for (const f of flags) {
    const px = f.x + 4, top = f.y, bot = f.y + f.h;
    ctx.fillStyle = '#5d4037'; ctx.fillRect(px - 5, bot - 5, 14, 5);       // base
    ctx.fillStyle = '#d7ccc8'; ctx.fillRect(px, top, 4, f.h);              // pole
    ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(px + 2, top, 4, 0, Math.PI * 2); ctx.fill();
    // flag cloth: band mein grey aur latka hua, active hone par chamakta hua lehraata hai
    const raise = f.active ? Math.min(1, f.wave / 30) : 0;
    const fy = top + 4 + (1 - raise) * 46;
    ctx.fillStyle = f.active ? '#2e9d5b' : '#9e9e9e';
    ctx.beginPath(); ctx.moveTo(px + 4, fy);
    for (let i = 0; i <= 6; i++) {
      const w = f.active ? Math.sin(frame * 0.2 + i * 0.8) * 3 : i * 1.2;
      ctx.lineTo(px + 4 + i * 4, fy + w);
    }
    for (let i = 6; i >= 0; i--) {
      const w = f.active ? Math.sin(frame * 0.2 + i * 0.8) * 3 : i * 1.2;
      ctx.lineTo(px + 4 + i * 4, fy + 18 + w * (f.active ? 1 : 0.3));
    }
    ctx.fill();
    if (f.active) { // fox paw ka nishaan
      ctx.fillStyle = '#ffca28';
      ctx.beginPath(); ctx.arc(px + 16, fy + 11, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 12, fy + 6, 1.6, 0, Math.PI * 2); ctx.arc(px + 16, fy + 4.5, 1.6, 0, Math.PI * 2);
      ctx.arc(px + 20, fy + 6, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawShadow(cx, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx, y, w, w * 0.25, 0, 0, Math.PI * 2); ctx.fill();
}
// neeche sabse paas wali zameen kahan hai (parchhai ke liye)
function groundBelow(e, maxTiles = 6) {
  const tx = Math.floor((e.x + e.w / 2) / TILE), ty0 = Math.floor((e.y + e.h) / TILE);
  for (let ty = Math.max(0, ty0); ty < ty0 + maxTiles && ty < ROWS; ty++) {
    const t = tileAt(tx, ty);
    if (SOLID.has(t) || t === '=') return ty * TILE;
  }
  return null;
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.active) continue;
    const cx = e.x + e.w / 2, by = e.y + e.h;
    if (!e.dead) drawShadow(cx, by, 13);
    ctx.save(); ctx.translate(cx, by);
    if (e.flip) ctx.scale(1, -1), ctx.translate(0, e.h);
    const face = e.vx > 0 ? 1 : -1;
    if (e.type === 'slime') {
      let sx = 1 + Math.sin(e.anim) * 0.1, sy = 1 - Math.sin(e.anim) * 0.1;
      if (e.dead && !e.flip) { sx = 1.4; sy = 0.3; }
      ctx.scale(sx, sy);
      ctx.fillStyle = '#9c5cf0';
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-15, -22, 0, -22); ctx.quadraticCurveTo(15, -22, 14, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7d43d6'; ctx.beginPath(); ctx.ellipse(0, -2, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-6, -16, 3, 4.5, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(-2, -19, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-4 + face * 3, -11, 4, 0, Math.PI * 2); ctx.arc(5 + face * 3, -11, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-4 + face * 4.5, -11, 2, 0, Math.PI * 2); ctx.arc(5 + face * 4.5, -11, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a1f8c'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(face * 3 + 0.5, -6.5, 2.6, 0.3, Math.PI - 0.3); ctx.stroke();
    } else {
      ctx.scale(face, 1);
      // kaante (thode hilte hain)
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer ? '#6d4c41' : '#3e2723';
        for (let i = 0; i < 6; i++) {
          const a = Math.PI + 0.3 + i * 0.45 + Math.sin(e.anim * 2 + i) * 0.06 + layer * 0.2;
          const len = layer ? 16 : 19;
          ctx.beginPath();
          ctx.moveTo(-2 + Math.cos(a - 0.2) * 11, -10 + Math.sin(a - 0.2) * 11);
          ctx.lineTo(-2 + Math.cos(a) * len, -10 + Math.sin(a) * len);
          ctx.lineTo(-2 + Math.cos(a + 0.2) * 11, -10 + Math.sin(a + 0.2) * 11);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.ellipse(-1, -10, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a1887f'; ctx.beginPath(); ctx.arc(4, -17, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe0b2'; ctx.beginPath(); ctx.ellipse(9, -8, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,120,0.45)'; ctx.beginPath(); ctx.arc(8, -5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(14.5, -8, 2, 0, Math.PI * 2); ctx.arc(9, -11, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(9.2, -12, 0.8, 0.8);
      const leg = Math.sin(e.anim * 2) * 3;
      ctx.fillStyle = '#3e2723'; ctx.fillRect(-8 + leg, -3, 5, 3); ctx.fillRect(4 - leg, -3, 5, 3);
    }
    ctx.restore();
  }
}

// Tikku - chhota orange fox, green scarf ke saath
function drawHero(cx, by, facing, anim, opts = {}) {
  const t = frame;
  const running = opts.running, air = opts.air;
  ctx.save(); ctx.translate(cx, by); ctx.scale(facing * (opts.sx || 1), opts.sy || 1);
  if (opts.rot) ctx.rotate(opts.rot);
  // legs
  const s = running ? Math.sin(anim) * 4 : 0;
  ctx.fillStyle = '#7b3f12';
  if (air) { ctx.fillRect(-7, -6, 5, 5); ctx.fillRect(3, -7, 5, 5); }
  else { ctx.fillRect(-7 + s, -5, 5, 5); ctx.fillRect(3 - s, -5, 5, 5); }
  // daudte waqt shareer upar-neeche, khade ho to halki saans
  ctx.translate(0, running ? -Math.abs(Math.sin(anim)) * 2 : Math.sin(t * 0.06) * 0.6);
  // tail
  const wag = running ? Math.sin(t * 0.4) * 0.35 : Math.sin(t * 0.15) * 0.25;
  ctx.save(); ctx.translate(-9, -11); ctx.rotate(-0.6 + wag + (air ? -0.4 : 0) + (opts.vy || 0) * 0.02);
  ctx.fillStyle = '#ef7d1a'; ctx.beginPath(); ctx.ellipse(-8, 0, 10, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff8ee'; ctx.beginPath(); ctx.ellipse(-15, 0, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // body
  ctx.fillStyle = '#f28c28'; ctx.beginPath(); ctx.ellipse(0, -12, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff3e0'; ctx.beginPath(); ctx.ellipse(3, -10, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  // fire karte waqt aage badha hua paw
  if (opts.shoot) {
    ctx.fillStyle = '#f28c28'; ctx.beginPath(); ctx.ellipse(11, -12, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7b3f12'; ctx.beginPath(); ctx.arc(15, -12, 2, 0, Math.PI * 2); ctx.fill();
  }
  // scarf
  const fl = running || air ? 4 : 2.5, fs = running ? 0.45 : 0.3;
  ctx.fillStyle = opts.fire ? '#ff5722' : '#2e9d5b';
  ctx.fillRect(-6, -19, 15, 4);
  ctx.beginPath(); ctx.moveTo(-5, -18);
  ctx.lineTo(-15, -20 + Math.sin(t * fs) * fl); ctx.lineTo(-14, -15 + Math.sin(t * fs + 1) * fl); ctx.lineTo(-4, -15); ctx.fill();
  // head
  ctx.fillStyle = '#f28c28'; ctx.beginPath(); ctx.arc(4, -25, 8, 0, Math.PI * 2); ctx.fill();
  // ears (halke hilte hain)
  const ew = Math.sin(t * 0.25) * (running || air ? 1.5 : 0.5);
  ctx.beginPath(); ctx.moveTo(-2, -29); ctx.lineTo(0 + ew, -38); ctx.lineTo(4, -31); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -31); ctx.lineTo(9 + ew, -38); ctx.lineTo(11, -28); ctx.fill();
  ctx.fillStyle = '#5a2a0a';
  ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0.6 + ew * 0.6, -35); ctx.lineTo(3, -31); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6.5, -31); ctx.lineTo(8.6 + ew * 0.6, -35); ctx.lineTo(9.6, -29.5); ctx.fill();
  // snout + cheek
  ctx.fillStyle = '#fff8ee'; ctx.beginPath(); ctx.ellipse(9.5, -22.5, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,110,110,0.35)'; ctx.beginPath(); ctx.arc(5, -21.5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(14, -23.5, 1.8, 0, Math.PI * 2); ctx.fill();
  // eye
  const blink = (t % 200) < 6;
  ctx.fillStyle = '#222';
  if (opts.dead) { ctx.fillRect(4, -28, 4, 1.5); }
  else if (blink) ctx.fillRect(4.5, -27, 3.5, 1.4);
  else { ctx.beginPath(); ctx.arc(6.5, -27, 1.9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(6.6, -28.2, 1, 1); }
  // leaf power on head
  if (opts.leaf) drawLeafShape(1, -37, 6, -0.3 + Math.sin(t * 0.1) * 0.2);
  ctx.restore();
}

function drawPlayer() {
  const p = player;
  if (!p.dying) {
    const gy = groundBelow(p, 8);
    if (gy !== null) drawShadow(p.x + p.w / 2, gy, Math.max(4, 11 - (gy - p.y - p.h) * 0.04));
  }
  if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;
  drawHero(p.x + p.w / 2, p.y + p.h, p.facing, p.anim, {
    running: Math.abs(p.vx) > 0.3 && p.onGround, air: !p.onGround, leaf: p.leaf, fire: p.fire,
    sx: p.sx, sy: p.sy, shoot: p.shootT > 0, vy: p.vy,
    dead: p.dying, rot: p.dying ? Math.PI * Math.min(1, stateTimer / 25) : 0 });
}

function drawParticles() {
  for (const pt of particles) {
    const a = Math.min(1, pt.life / 20);
    if (pt.text) { ctx.globalAlpha = Math.min(1, pt.life / 15); text(pt.text, pt.x, pt.y, pt.size || 16, pt.color); }
    else if (pt.r) { ctx.globalAlpha = a * 0.8; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.globalAlpha = a; ctx.fillStyle = pt.color; ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4); }
  }
  ctx.globalAlpha = 1;
}

function text(str, x, y, size, color = '#fff', align = 'center') {
  ctx.font = `bold ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(str, x + 2, y + 3);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

function drawHUD() {
  ctx.fillStyle = 'rgba(10,14,30,0.5)'; rr(8, 5, W - 16, 38, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; rr(8.5, 5.5, W - 17, 37, 12); ctx.stroke();
  drawHero(30, 38, 1, 0, {});
  text('x ' + lives, 50, 24, 20, '#fff', 'left');
  drawGemShape(140, 24, 10);
  text('x ' + String(gemCount).padStart(2, '0'), 156, 24, 20, '#fff', 'left');
  if (player && player.fire) drawFlame(208, 26, 9);
  if (player && player.leaf) drawLeafShape(230, 24, 8, 0.3);
  text('SCORE ' + String(score).padStart(6, '0'), 330, 24, 20);
  text('HI ' + String(Math.max(highScore, score)).padStart(6, '0'), 470, 24, 16, '#ffe082');
  text('WORLD ' + (levelIndex + 1) + '  ' + level.name, 660, 24, 18);
  const tl = Math.ceil(timeLeft / 60), tc = tl < 60 ? '#ff8a80' : '#fff';
  ctx.strokeStyle = tc; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(858, 24, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(858, 24); ctx.lineTo(858, 19); ctx.moveTo(858, 24); ctx.lineTo(862, 26); ctx.stroke();
  text(String(tl), 874, 24, 20, tc, 'left');
  if (muted) text(t('muted'), W - 60, 60, 14, '#ffcc80');
  else if (!musicOn) text(t('musicOff'), W - 70, 60, 14, '#ffcc80');
  if (boss && bossStarted && !boss.gone) {
    const bw = 320, bx = W / 2 - bw / 2, by = 58;
    text(t('bossName'), W / 2, by, 16, '#ffab91');
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(bx - 3, by + 11, bw + 6, 16, 8); ctx.fill();
    const fw = bw * Math.max(0, boss.hp) / boss.maxHp;
    if (fw > 0) {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#ff9800'); g.addColorStop(1, '#ff3d00');
      ctx.fillStyle = g; rr(bx, by + 14, fw, 10, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(bx + 2, by + 15, Math.max(0, fw - 4), 3, 2); ctx.fill();
    }
  }
}

function overlay(alpha = 0.55) { ctx.fillStyle = `rgba(10,12,30,${alpha})`; ctx.fillRect(0, 0, W, H); }

// ---------- Language: Hinglish / English (L key ya title par tap) ----------
const STR = {
  hi: {
    langBtn: 'Bhasha: HINGLISH  (L)',
    subtitle: 'ek chhote fox ka bada safar',
    ctrl1: 'Arrow / A D : chalo    Space / W / Up : jump    Shift / X : daudo',
    touchCtrl: '◀ ▶ : chalo    ▲ : jump    » : daudo    FIRE : aag',
    rotate: 'Behtar khelne ke liye phone ko tircha (landscape) karo',
    ctrl2: 'Purple slime pe kood ke haraao - par kaante wale hedgehog se bacho!',
    ctrl3: 'Patta = double jump + extra hit    Aag (flame) = F se fire    P pause  M mute  N music',
    start: 'ENTER dabao (ya tap karo) shuru karne ke liye',
    high: 'HIGH SCORE',
    bossLevel: 'BOSS LEVEL!',
    fromCp: 'Checkpoint se shuru',
    levelClear: 'LEVEL CLEAR!',
    timeBonus: 'Time bonus...',
    gameOver: 'GAME OVER',
    newHigh: 'NEW HIGH SCORE!',
    score: 'Score', hs: 'High Score', final: 'Final Score', best: 'Best',
    again: 'ENTER dabao dobara khelne ke liye',
    winTitle: 'SHABAASH!',
    winLine: n => `${n} ne Magmo ko hara ke saare worlds paar kar liye!`,
    playAgain: 'ENTER dabao phir se khelne ke liye',
    paused: 'PAUSED', resume: 'P dabao continue karne ke liye',
    muted: 'MUTED', musicOff: 'MUSIC OFF',
    bossName: 'MAGMO',
    bossIntro: 'MAGMO jaag gaya!',
    bossHint: 'Uske sar pe kood ke maaro - 5 baar!',
    bossDown: 'Magmo haar gaya! Portal khul gaya!',
  },
  en: {
    langBtn: 'Language: ENGLISH  (L)',
    subtitle: 'a little fox on a big journey',
    ctrl1: 'Arrows / A D : move    Space / W / Up : jump    Shift / X : run',
    touchCtrl: '◀ ▶ : move    ▲ : jump    » : run    FIRE : shoot',
    rotate: 'Turn your phone sideways (landscape) to play better',
    ctrl2: 'Jump on purple slimes to beat them - but avoid the spiky hedgehogs!',
    ctrl3: 'Leaf = double jump + extra hit    Flame = press F to shoot    P pause  M mute  N music',
    start: 'Press ENTER (or tap) to start',
    high: 'HIGH SCORE',
    bossLevel: 'BOSS LEVEL!',
    fromCp: 'Starting from checkpoint',
    levelClear: 'LEVEL CLEAR!',
    timeBonus: 'Time bonus...',
    gameOver: 'GAME OVER',
    newHigh: 'NEW HIGH SCORE!',
    score: 'Score', hs: 'High Score', final: 'Final Score', best: 'Best',
    again: 'Press ENTER to play again',
    winTitle: 'WELL DONE!',
    winLine: n => `${n} beat Magmo and cleared every world!`,
    playAgain: 'Press ENTER to play again',
    paused: 'PAUSED', resume: 'Press P to continue',
    muted: 'MUTED', musicOff: 'MUSIC OFF',
    bossName: 'MAGMO',
    bossIntro: 'MAGMO has awoken!',
    bossHint: 'Jump on its head to hit it - 5 times!',
    bossDown: 'Magmo is defeated! The portal is open!',
  },
};
const LANG_KEY = 'tikkuRunLang';
let lang = 'hi';
try { if (localStorage.getItem(LANG_KEY) === 'en') lang = 'en'; } catch (e) {}
setTimeout(() => setLang(lang), 0);
function setLang(l) {
  lang = l; try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  const r = document.getElementById('rotate'); if (r) r.textContent = '↻  ' + t('rotate');
}
function t(key, ...args) { const v = STR[lang][key]; return typeof v === 'function' ? v(...args) : v; }

// ---------- BOSS: Magmo (lava ka gussail gola) ----------
let boss = null, bossStarted = false, bossIntro = 0, waves = [], shake = 0;
const ARENA_LEFT = 20; // is tile pe gate band hota hai

function makeBoss() {
  return { x: 40 * TILE, y: 15 * TILE - 76, w: 90, h: 76, vx: 0, vy: 0, hp: 5, maxHp: 5,
           mode: 'wait', timer: 0, invuln: 0, jumps: 0, squash: 0, dead: 0, gone: false,
           face: -1, noPlat: true, prevBottom: 0, onGround: true };
}

function updateBoss() {
  const b = boss, p = player;
  if (!b || b.gone) { if (b) b.dead++; updateWaves(); return; }

  if (!bossStarted) {
    if (p.x > (ARENA_LEFT + 3) * TILE) {
      bossStarted = true; bossIntro = 140; shake = 10;
      for (let ty = 11; ty <= 14; ty++) level.grid[ty][ARENA_LEFT] = 'B'; // gate band
      SFX.bump(); beep(80, 40, 0.6, 'sawtooth', 0.1);
    }
    return;
  }
  if (bossIntro > 0) bossIntro--;

  if (b.dead) {
    b.dead++;
    if (b.dead % 4 === 0) particles.push({ x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h,
      vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 6, life: 40, color: ['#ff5722', '#ffd54f', '#5d4037'][b.dead % 3] });
    if (b.dead === 100) {
      b.gone = true; shake = 14;
      portal = { x: 34 * TILE, y: 13 * TILE, w: 32, h: 64 };
      SFX.clear();
    }
    return;
  }

  if (b.invuln > 0) b.invuln--;
  if (b.squash > 0) b.squash--;
  if (frame % 6 === 0) particles.push({ x: b.x + 12 + Math.random() * (b.w - 24), y: b.y + 25 + Math.random() * 35,
    vx: 0, vy: 0.4, g: 0.22, r: 2.4, life: 32, color: Math.random() < 0.5 ? '#ff7043' : '#ffb300' });
  const anger = b.maxHp - b.hp; // jitna maar khaayega utna tez hoga

  b.vy = Math.min(b.vy + GRAV * 0.9, MAX_FALL);
  if (b.mode === 'wait') {
    b.vx = 0; b.timer++;
    b.face = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1;
    if (bossIntro === 0 && b.timer > 75 - anger * 11) {
      b.mode = 'jump'; b.timer = 0; b.jumps++;
      const big = b.jumps % 3 === 0;
      b.vy = big ? -15 : -10;
      const dx = (p.x + p.w / 2) - (b.x + b.w / 2);
      b.vx = Math.max(-6, Math.min(6, dx / (big ? 52 : 36)));
    }
  }
  b.x += b.vx; collideX(b);
  b.prevBottom = b.y + b.h; b.y += b.vy; collideY(b, false);

  if (b.mode === 'jump' && b.onGround && b.vy === 0) {
    b.mode = 'wait'; b.timer = 0; b.squash = 14; shake = 12;
    beep(90, 40, 0.3, 'sawtooth', 0.1);
    for (let i = 0; i < 14; i++) particles.push({ x: b.x + Math.random() * b.w, y: b.y + b.h,
      vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 4, life: 30, color: '#8d6e63' });
    // 3 HP ya kam: zameen pe aag ki lehrein
    if (b.hp <= 3) { waves.push({ x: b.x - 20, dir: -1 }); waves.push({ x: b.x + b.w - 4, dir: 1 }); }
    // 4 HP ya kam: chhote slime bhejta hai
    if (b.hp <= 4 && b.jumps % 2 === 0 && enemies.filter(e => !e.dead).length < 3) {
      enemies.push({ type: 'slime', x: b.x + b.w / 2 - 14, y: b.y - 24, w: 28, h: 22, vx: b.face * 1.2, speed: 1.2,
                     vy: -6, active: true, dead: 0, anim: 0 });
    }
  }

  // Tikku vs Magmo
  if (!p.dying && overlap(p, b)) {
    const fromAbove = p.vy > 0 && p.prevBottom <= b.y + 22;
    if (fromAbove) {
      p.vy = -12; p.jumping = true; p.canDouble = p.leaf;
      if (b.invuln === 0) {
        b.hp--; b.invuln = 70; b.squash = 14; shake = 8; score += 1000;
        floatText(b.x + b.w / 2, b.y - 10, '+1000', '#ffd54f', 22);
        SFX.stomp(); beep(220, 60, 0.35, 'square', 0.08);
        if (b.hp <= 0) {
          b.dead = 1; b.vx = 0; score += 5000; waves = [];
          enemies.forEach(e => { if (!e.dead) killEnemy(e, true); });
        }
      }
    } else hurtPlayer();
  }
  updateWaves();
}

function updateWaves() {
  for (const w of waves) {
    w.x += w.dir * 4.5; w.age = (w.age || 0) + 1;
    if (!player.dying && overlap(player, { x: w.x + 2, y: 15 * TILE - 20, w: 20, h: 20 })) hurtPlayer();
  }
  waves = waves.filter(w => w.x > (ARENA_LEFT + 1) * TILE - 24 && w.x < level.w * TILE);
}

function damageBoss() {
  const b = boss;
  floatText(b.x + b.w / 2, b.y - 10, '+1000', '#ffd54f', 22);
  b.hp--; b.invuln = 70; b.squash = 14; shake = 8; score += 1000;
  SFX.stomp(); beep(220, 60, 0.35, 'square', 0.08);
  if (b.hp <= 0) {
    b.dead = 1; b.vx = 0; score += 5000; waves = [];
    enemies.forEach(e => { if (!e.dead) killEnemy(e, true); });
  }
}

function fizzle(f, color = '#ffab40') {
  for (let i = 0; i < 6; i++) particles.push({ x: f.x + 6, y: f.y + 6, vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4, life: 16, color });
}

function updateFireballs() {
  for (const f of fireballs) {
    f.life--; f.spin += 0.4;
    f.vy = Math.min(f.vy + 0.5, 8);
    f.x += f.vx; collideX(f);
    if (f.hitWall) { f.dead = true; fizzle(f); continue; }
    f.prevBottom = f.y + f.h; f.y += f.vy; collideY(f, false);
    if (f.onGround) f.vy = -4; // zameen pe tappa khaata hai
    if (frame % 3 === 0) particles.push({ x: f.x + 6, y: f.y + 6, vx: -f.vx * 0.1, vy: -0.5, life: 12, color: '#ffca28' });
    if (f.life <= 0 || f.y > ROWS * TILE || f.x < cam.x - 60 || f.x > cam.x + W + 60) { f.dead = true; continue; }
    for (const e of enemies) {
      if (e.active && !e.dead && overlap(f, e)) { killEnemy(e, true); f.dead = true; fizzle(f); break; }
    }
    // Magmo pe aag ka kam asar: 4 gole = 1 HP
    const b = boss;
    if (!f.dead && b && bossStarted && !b.dead && !b.gone && overlap(f, b)) {
      f.dead = true; fizzle(f, '#ffd54f');
      if (b.invuln === 0) {
        b.fireHits = (b.fireHits || 0) + 1; b.flash = 6; beep(300, 200, 0.08, 'triangle', 0.06);
        if (b.fireHits >= 4) { b.fireHits = 0; damageBoss(); }
      }
    }
  }
  fireballs = fireballs.filter(f => !f.dead);
}

function drawFlame(cx, cy, r) {
  const fl = Math.sin(frame * 0.3) * r * 0.15;
  ctx.fillStyle = '#ff5722';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 1.4 - fl);
  ctx.quadraticCurveTo(cx + r * 1.2, cy - r * 0.1, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 1.2, cy - r * 0.1, cx, cy - r * 1.4 - fl); ctx.fill();
  ctx.fillStyle = '#ffca28';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.5 - fl * 0.5);
  ctx.quadraticCurveTo(cx + r * 0.65, cy + r * 0.25, cx, cy + r * 0.8);
  ctx.quadraticCurveTo(cx - r * 0.65, cy + r * 0.25, cx, cy - r * 0.5 - fl * 0.5); ctx.fill();
}

function drawFireballs() {
  for (const f of fireballs) {
    const cx = f.x + 6, cy = f.y + 6;
    ctx.fillStyle = 'rgba(255,152,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5722'; ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(cx + Math.cos(f.spin) * 1.5, cy + Math.sin(f.spin) * 1.5, 3.2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBoss() {
  for (const w of waves) { // aag ki lehar
    const fl = Math.sin(frame * 0.5 + w.x) * 3;
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.moveTo(w.x, 480); ctx.quadraticCurveTo(w.x + 4, 466 + fl, w.x + 12, 458 + fl);
    ctx.quadraticCurveTo(w.x + 20, 466 - fl, w.x + 24, 480); ctx.fill();
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.moveTo(w.x + 6, 480); ctx.quadraticCurveTo(w.x + 12, 466, w.x + 18, 480); ctx.fill();
  }
  const b = boss;
  if (!b || b.gone) return;
  const cx = b.x + b.w / 2, by = b.y + b.h;
  if (!b.dead) {
    const gy = groundBelow(b, 10);
    if (gy !== null) {
      const hg = ctx.createRadialGradient(cx, gy, 5, cx, gy, 80);
      hg.addColorStop(0, 'rgba(255,112,67,0.45)'); hg.addColorStop(1, 'rgba(255,112,67,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(cx, gy, 80, 16, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  let sx = 1, sy = 1;
  if (b.squash > 0) { const k = Math.sin((b.squash / 14) * Math.PI) * 0.22; sx = 1 + k; sy = 1 - k; }
  else if (b.mode === 'jump') { sx = 0.9; sy = 1.1; }
  else { sy = 1 + Math.sin(frame * 0.12) * 0.03; }
  ctx.save();
  if (b.dead) { const k = Math.min(1, b.dead / 100); sx *= 1 + k * 0.4; sy *= 1 - k * 0.85; ctx.globalAlpha = 1 - k * 0.5; }
  ctx.translate(cx, by); ctx.scale(sx, sy);
  if (b.flash > 0) b.flash--;
  const hurt = (b.invuln > 0 && Math.floor(b.invuln / 4) % 2 === 0) || b.flash > 3;
  // body
  ctx.fillStyle = hurt ? '#ffffff' : '#e8501f';
  ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-50, -78, 0, -76); ctx.quadraticCurveTo(50, -78, 46, 0); ctx.closePath(); ctx.fill();
  // glowing cracks
  if (!hurt) {
    ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-34, -12); ctx.lineTo(-26, -24); ctx.lineTo(-30, -34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, -10); ctx.lineTo(26, -22); ctx.lineTo(34, -30); ctx.stroke();
  }
  // rock plates on top
  ctx.fillStyle = '#4e342e';
  [[-26, -64, 14], [0, -76, 17], [26, -64, 14]].forEach(([x, y, r]) => {
    ctx.beginPath(); ctx.moveTo(x - r, y + 8); ctx.lineTo(x - r * 0.5, y - r * 0.6); ctx.lineTo(x + r * 0.4, y - r * 0.8);
    ctx.lineTo(x + r, y + 6); ctx.closePath(); ctx.fill();
  });
  // one big eye
  const look = b.face * 5;
  ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.ellipse(0, -44, 16, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(look, -43, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(look, -43, 2.5, 7, 0, 0, Math.PI * 2); ctx.fill();
  // angry brow
  ctx.fillStyle = '#3e2723';
  ctx.beginPath(); ctx.moveTo(-20, -64); ctx.lineTo(20, -64); ctx.lineTo(14, -56); ctx.lineTo(0, -60); ctx.lineTo(-14, -56); ctx.closePath(); ctx.fill();
  // jagged mouth
  ctx.fillStyle = '#3b0d06'; ctx.beginPath(); ctx.ellipse(0, -18, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff3e0';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 8 - 4, -26); ctx.lineTo(i * 8, -19); ctx.lineTo(i * 8 + 4, -26); ctx.fill();
  }
  ctx.restore();
}

function renderScene() {
  if (!level) loadLevel(0);
  const th = level.theme;
  drawBackground(th, cam.x);
  ctx.save();
  const sh = shake ? [(Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake] : [0, 0];
  ctx.translate(-Math.round(cam.x) + sh[0], sh[1]);
  drawTiles(th); drawFlags(); drawPortal(); drawGems(); drawItems(); drawEnemies(); drawBoss(); drawFireballs();
  if (state !== 'title') drawPlayer();
  drawParticles();
  ctx.restore();
  drawLighting(th);

  const blink = Math.floor(frame / 30) % 2 === 0;
  if (state === 'title') {
    overlay(0.3);
    // language button (top-left)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(14, 10, 300, 36, 8); ctx.fill();
    text(t('langBtn'), 164, 29, 18, '#fff');
    text(t('high') + ' ' + String(highScore).padStart(6, '0'), W - 20, 28, 20, '#ffe082', 'right');
    drawLogo(GAME_TITLE, W / 2, 135, 84);
    text(t('subtitle'), W / 2, 200, 22, '#ffe9b0');
    ctx.save(); ctx.translate(W / 2, 330); ctx.scale(3, 3);
    drawHero(0, 0, 1, frame * 0.3, { running: true, leaf: true }); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(W / 2 - 440, 370, 880, 96, 14); ctx.fill();
    text(touchMode ? t('touchCtrl') : t('ctrl1'), W / 2, 390, touchMode ? 22 : 18);
    text(t('ctrl2'), W / 2, 420, 18, '#e1bee7');
    text(t('ctrl3'), W / 2, 448, 18, '#c8e6c9');
    if (blink) text(t('start'), W / 2, 500, 24, '#fff');
    return;
  }
  drawHUD();
  if (state === 'ready') {
    overlay(0.35);
    text('WORLD ' + (levelIndex + 1), W / 2, 220, 48, '#ffcc4d');
    text(level.name, W / 2, 275, 30);
    if (LEVELS[levelIndex].boss) text(t('bossLevel'), W / 2, 170, 28, '#ff7043');
    text(HERO_NAME + ' x ' + lives, W / 2, 330, 22);
    if (checkpoint && checkpoint.level === levelIndex) text(t('fromCp'), W / 2, 365, 20, '#a5d6a7');
  } else if (state === 'playing' && boss) {
    if (bossIntro > 0) {
      text(t('bossIntro'), W / 2, 200, 44, '#ff7043');
      text(t('bossHint'), W / 2, 250, 22, '#ffe0b2');
    } else if (boss.dead && boss.dead < 280) {
      text(t('bossDown'), W / 2, 200, 30, '#ffeb3b');
    }
  } else if (state === 'clear') {
    text(t('levelClear'), W / 2, 220, 56, '#ffeb3b');
    text(t('timeBonus'), W / 2, 280, 24);
  } else if (state === 'gameover') {
    overlay(0.7);
    text(t('gameOver'), W / 2, 220, 64, '#ff6e6e');
    if (newHigh) text(t('newHigh'), W / 2, 272, 30, '#ffeb3b');
    text(t('score') + ': ' + score, W / 2, 310, 28);
    text(t('hs') + ': ' + highScore, W / 2, 345, 22, '#ffe082');
    if (blink) text(t('again'), W / 2, 400, 22);
  } else if (state === 'win') {
    overlay(0.6);
    if (newHigh) text(t('newHigh'), W / 2, 125, 30, '#ffeb3b');
    text(t('winTitle'), W / 2, 190, 68, '#ffcc4d');
    text(t('winLine', HERO_NAME), W / 2, 255, 26);
    text(t('final') + ': ' + score + '     ' + t('best') + ': ' + highScore, W / 2, 300, 26, '#b3e5fc');
    ctx.save(); ctx.translate(W / 2, 410); ctx.scale(2.5, 2.5);
    drawHero(0, 0, 1, 0, { leaf: true }); ctx.restore();
    if (blink) text(t('playAgain'), W / 2, 470, 22);
  }
  if (paused && state === 'playing') { overlay(0.5); text(t('paused'), W / 2, H / 2, 56); text(t('resume'), W / 2, H / 2 + 50, 20); }
}

// ---------- Effects: dhool, udta score, roshni, logo, fade ----------
function puff(x, y, n, color = 'rgba(235,225,205,0.9)') {
  for (let i = 0; i < n; i++) particles.push({ x: x + (Math.random() - 0.5) * 12, y: y - 2, vx: (Math.random() - 0.5) * 1.6,
    vy: -Math.random() * 0.7, g: 0, r: 2.5 + Math.random() * 2, grow: 0.18, life: 22, color });
}
function floatText(x, y, str, color = '#fff', size = 16) {
  particles.push({ x, y, vx: 0, vy: -1.3, g: 0.025, life: 45, text: str, color, size });
}

function drawLighting(th) {
  if (th.cave && player && state !== 'title') { // gufa mein Tikku ke aas-paas hi roshni
    const px = player.x + player.w / 2 - cam.x, py = player.y + player.h / 2;
    const g = ctx.createRadialGradient(px, py, 60, px, py, 380);
    g.addColorStop(0, 'rgba(5,3,15,0)'); g.addColorStop(1, 'rgba(5,3,15,0.78)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (th.embers) { // neeche se lava ki garmi
    const g = ctx.createLinearGradient(0, H, 0, H - 220);
    g.addColorStop(0, 'rgba(255,87,34,0.22)'); g.addColorStop(1, 'rgba(255,87,34,0)');
    ctx.fillStyle = g; ctx.fillRect(0, H - 220, W, 220);
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.7); // kinaare halke andhere
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

function drawLogo(str, cx, cy, size) {
  ctx.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const chars = [...str], widths = chars.map(ch => ctx.measureText(ch).width);
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  chars.forEach((ch, i) => {
    const y = cy + Math.sin(frame * 0.07 + i * 0.55) * 6;
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeText(ch, x, y + 6);
    ctx.strokeStyle = '#4a2408'; ctx.strokeText(ch, x, y);
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#ff8a1f');
    ctx.fillStyle = g; ctx.fillText(ch, x, y);
    x += widths[i];
  });
}

let fade = 0, fadeState = null;
function render() {
  renderScene();
  // screen badalne par kaale se halka fade-in
  if (state !== fadeState) {
    if (state === 'ready' || state === 'title' || state === 'gameover' || state === 'win') fade = 1;
    fadeState = state;
  }
  if (fade > 0.02) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); fade *= 0.88; }
  else fade = 0;
}

// ---------- Main loop (fixed 60 FPS logic) ----------
let last = performance.now(), acc = 0;
const STEP = 1000 / 60;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  render();
  requestAnimationFrame(loop);
}
loadLevel(0);
requestAnimationFrame(loop);
