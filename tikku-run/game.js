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
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; // naam likhte waqt game ko mat chhedo
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
  for (let i = ui.length - 1; i >= 0; i--) { // screen pe bane buttons
    const b = ui[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.act(x - b.x, b.w); return; }
  }
  if (state === 'editor') { edPointer(x, y); return; }
  if (!isMenuState()) pressed.add('Enter');
});

// ---------- Sound (tiny WebAudio beeps) ----------
let actx = null, muted = false;
function initAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
}
function beep(f1, f2, dur, type = 'square', vol = 0.07, delay = 0) {
  const sv = save.set.sfx / 8;
  if (!actx || muted || sv <= 0) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
  g.gain.setValueAtTime(vol * sv, t);
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
TRACKS.water = { bpm: 116, leadType: 'triangle', leadVol: 0.09, bassVol: 0.06,
  lead: seq(`C5 - E5 G5 A5 - G5 E5  F5 - A5 C6 B5 - G5 -  E5 - G5 C6 D6 - C6 A5  G5 - E5 - D5 - - -
             A4 - C5 E5 F5 - E5 C5  D5 - F5 A5 G5 - E5 -  F5 E5 D5 C5 D5 - G4 -  C5 - - - C5 - - -`),
  bass: seq(`C3 - G2 - C3 - G2 -  F2 - C3 - G2 - D3 -  A2 - E3 - F2 - C3 -  G2 - D3 - G2 - - -
             F2 - C3 - F2 - C3 -  D2 - A2 - G2 - D3 -  F2 - C3 - G2 - D3 -  C3 - G2 - C3 - - -`) };
TRACKS.desert = { bpm: 120, leadType: 'square', leadVol: 0.032, bassVol: 0.065,
  lead: seq(`E5 F5 G#5 A5 G#5 F5 E5 -  E5 F5 G#5 B5 A5 G#5 F5 -  A5 G#5 F5 E5 F5 E5 D5 C5  B4 C5 D5 E5 E5 - - -
             E5 - D5 C5 B4 - C5 D5  E5 - F5 G#5 A5 - G#5 F5  E5 F5 G#5 A5 B5 A5 G#5 F5  E5 - B4 - E5 - - -`),
  bass: seq(`E2 - B2 - E2 - B2 -  E2 - B2 - D2 - A2 -  F2 - C3 - F2 - C3 -  E2 - B2 - E2 - - -
             E2 - B2 - E2 - B2 -  F2 - C3 - F2 - C3 -  E2 - B2 - D2 - A2 -  E2 - B2 - E2 - - -`) };
TRACKS.temple = { bpm: 100, leadType: 'triangle', leadVol: 0.09, bassVol: 0.07,
  lead: seq(`A4 - C5 - E5 - D5 C5  B4 - D5 - F5 - E5 D5  C5 - E5 - A5 - G5 F5  E5 - - - E4 - - -
             F5 - E5 D5 C5 - B4 C5  D5 - C5 B4 A4 - G#4 A4  B4 - C5 D5 E5 - D5 B4  A4 - - - A3 - - -`),
  bass: seq(`A2 - - - A2 - E2 -  G2 - - - G2 - D2 -  F2 - - - F2 - C3 -  E2 - - - E2 - - -
             D2 - - - D2 - A2 -  F2 - - - E2 - - -  F2 - - - G2 - - -  A2 - - - A1 - - -`) };
TRACKS.city = { bpm: 132, leadType: 'square', leadVol: 0.03, bassVol: 0.065,
  lead: seq(`C5 - Eb5 F5 G5 - Bb5 G5  F5 - Eb5 C5 Eb5 - F5 -  G5 G5 Bb5 C6 Bb5 G5 F5 Eb5  F5 - C5 - - - - -
             Ab4 C5 Eb5 G5 F5 Eb5 C5 -  Bb4 D5 F5 Ab5 G5 F5 D5 -  C5 Eb5 G5 Bb5 Ab5 G5 F5 Eb5  C5 - G4 - C5 - - -`),
  bass: seq(`C3 - G2 - C3 - G2 -  F2 - C3 - F2 - C3 -  Eb2 - Bb2 - Eb2 - Bb2 -  F2 - C3 - G2 - D3 -
             Ab2 - Eb3 - Ab2 - Eb3 -  Bb2 - F2 - Bb2 - F2 -  C3 - G2 - Eb3 - Bb2 -  C3 - G2 - C3 - - -`) };
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
  musicGain.gain.setTargetAtTime(silent ? 0 : save.set.music / 8, actx.currentTime, 0.05);
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
  water: { top: '#7fd3ff', bot: '#1565c0', far: '#4aa3d8', near: '#2f86c0', grass: '#f2d38a', grassHi: '#fff0b8',
           dirt: '#c9a46a', dirtDark: '#a8834e', sun: '#fff6c0', stars: false, water: true },
  desert: { top: '#4fb3e8', bot: '#ffe0b2', far: '#e8b46a', near: '#d59a52', grass: '#f2c46d', grassHi: '#ffe29a',
            dirt: '#c98d4a', dirtDark: '#a66e33', sun: '#fff59d', stars: false, desert: true },
  temple: { top: '#16301f', bot: '#3f6b3c', far: '#2a4d33', near: '#1d3a27', grass: '#5fa04a', grassHi: '#8bd46a',
            dirt: '#7d7356', dirtDark: '#5e5640', sun: null, stars: false, temple: true },
  city: { top: '#141a38', bot: '#4a3d6b', far: '#2a2d52', near: '#1e2142', grass: '#607d8b', grassHi: '#90a4ae',
          dirt: '#4e4a66', dirtDark: '#3a3650', sun: '#f4f1d0', stars: true, city: true, rain: true },
};

// ---------- Levels (builder se banaye gaye) ----------
// Tiles: # ground, B stone, I ice, J spring, = wood platform, ^ spikes, K checkpoint, G gem, F portal, @ start
// Crates: C gem, P leaf, R fire, T star, M magnet, W wings  (X = khaali crate)
// Dushman: S slime, H hedgehog, V bat (udta hai), Y cactus (kaante phenkta), Q machhli (paani mein)
// Khatre: O ghoomta aag ka chakkar, r chhat se girta patthar
// Platforms: h aage-peeche chalti, v upar-neeche chalti, d khade hone par girti
// L.secret(x1,y1,x2,y2) = chhupa kamra: bahar se patthar dikhta hai, andar gems!
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
      L.row(112, 12, 'GGGG'); L.set(118, 11, 'M');
      L.fill(125, 14, 125, 14, 'B'); L.fill(126, 13, 126, 14, 'B'); L.fill(127, 12, 127, 14, 'B');
      L.fill(128, 11, 130, 14, 'B'); L.row(128, 9, 'GGG');
      L.set(134, 14, 'S');
      L.secret(137, 12, 142, 14); L.row(138, 14, 'GGGG'); L.row(138, 13, 'GGGG');
      L.set(75, 14, 'K'); // checkpoint
      L.set(148, 13, 'F');
    },
  },
  {
    name: 'Sunset Cliffs', theme: 'sunset', w: 180,
    build(L) {
      L.ground(0, 20); L.set(3, 14, '@');
      L.row(8, 11, 'BCBCB'); L.row(9, 8, 'G G');
      L.row(22, 12, '===='); L.row(23, 11, 'GG');
      L.set(28, 10, 'h'); L.row(29, 8, 'GG');
      L.row(34, 12, '===='); L.row(35, 11, 'GG');
      L.ground(38, 62);
      L.set(42, 14, 'S'); L.set(47, 14, 'S'); L.set(52, 14, 'Y'); L.set(57, 14, 'H');
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
      L.set(129, 14, 'H'); L.set(137, 14, 'Y'); L.row(132, 11, 'WRC'); L.row(132, 8, 'G G');
      L.row(141, 11, '===='); L.row(141, 10, 'GGGG');
      L.ground(145, 179);
      L.set(150, 14, 'S'); L.set(156, 14, 'S'); L.set(162, 14, 'H');
      L.fill(164, 13, 164, 14, 'B'); L.fill(165, 12, 165, 14, 'B'); L.fill(166, 11, 167, 14, 'B');
      L.row(165, 9, 'GGG');
      L.set(173, 13, 'F');
    },
  },
  {
    // World 3: samundar! Paani mein jump = tairna, upar satah pe jump = bahar uchhalna
    name: 'Coral Lagoon', theme: 'water', w: 170, water: [[13, 4, 154, 14]],
    build(L) {
      L.fill(0, 4, 12, 16, '#'); L.set(3, 3, '@');
      L.row(6, 1, 'CPC');
      L.ground(13, 154);
      L.fill(155, 4, 169, 16, '#');
      L.set(163, 2, 'F');
      L.row(16, 7, 'GGGG'); L.set(22, 10, 'Q');
      L.fill(30, 9, 31, 14, '#'); L.row(29, 7, 'GGGG');
      L.row(36, 14, '^^^^^^'); L.row(36, 11, 'GGGGGG'); L.set(40, 7, 'Q');
      L.row(46, 9, 'CMC');
      L.fill(55, 1, 56, 9, '#'); L.fill(55, 13, 56, 14, '#'); L.row(54, 11, 'GGGG'); // neeche se tunnel
      L.set(62, 14, 'K');
      L.set(68, 8, 'Q'); L.set(74, 11, 'Q'); L.set(79, 6, 'Q');
      L.row(66, 6, 'G  G  G  G'); L.row(70, 12, 'GGG');
      L.secret(84, 9, 90, 14); L.row(85, 13, 'GGGGG'); L.row(85, 11, 'GGGGG');
      L.fill(95, 1, 110, 8, '#'); L.fill(95, 13, 110, 14, '#'); L.row(97, 10, 'GGGGGGGGGGGG'); L.set(103, 11, 'Q');
      L.row(114, 8, 'CTC'); L.row(118, 14, '^^^^^^^^^'); L.set(120, 10, 'Q'); L.set(127, 7, 'Q'); L.row(119, 11, 'GGGGGG');
      L.set(140, 9, 'Q'); L.set(148, 6, 'Q'); L.row(136, 7, 'GGGGGG'); L.row(144, 12, 'GGGG');
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
      L.row(38, 11, 'CPT');
      L.row(47, 14, '^^^');
      L.row(52, 11, '===='); L.row(58, 8, '===='); L.row(59, 7, 'GG'); L.row(64, 11, '====');
      L.set(61, 4, 'V');
      L.ground(69, 95);
      L.set(72, 14, 'S'); L.set(78, 14, 'S'); L.set(84, 14, 'S'); L.set(91, 14, 'H');
      L.fill(80, 12, 80, 14, 'B'); L.fill(88, 11, 88, 14, 'B'); L.row(87, 9, 'GGG');
      L.set(97, 11, 'd'); L.row(97, 10, 'GGG');
      L.ground(101, 130);
      L.row(110, 14, '^^^^'); L.row(109, 11, '======'); L.row(110, 10, 'GGGG');
      L.set(102, 14, 'K'); L.set(107, 14, 'S'); L.set(117, 14, 'S'); L.set(120, 14, 'H'); L.set(126, 14, 'H');
      L.row(121, 10, 'BRB');
      L.set(132, 12, 'B'); L.set(132, 11, 'G'); L.set(135, 10, 'B'); L.set(135, 9, 'G');
      L.ground(138, 189);
      L.set(145, 14, 'S'); L.set(150, 14, 'S'); L.set(155, 14, 'S'); L.set(160, 14, 'H');
      L.row(147, 11, 'GGGGGGGG'); L.set(151, 8, 'V');
      L.fill(170, 14, 170, 14, 'B'); L.fill(171, 13, 171, 14, 'B'); L.fill(172, 12, 172, 14, 'B');
      L.fill(173, 11, 173, 14, 'B'); L.fill(174, 10, 175, 14, 'B'); L.row(174, 8, 'GG');
      L.set(183, 13, 'F');
    },
  },
  {
    // barf: 'I' = fisalne wali barf, 'J' = spring (uchhaal deta hai)
    name: 'Frosty Peaks', theme: 'snow', w: 180,
    build(L) {
      L.ground(0, 25); L.set(3, 14, '@');
      L.row(8, 11, 'CBPBC'); L.row(9, 8, 'G G G');
      L.fill(14, 15, 25, 15, 'I'); L.set(18, 14, 'S'); L.row(16, 12, 'GGG');
      L.set(26, 12, 'v');
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
      L.set(102, 14, 'S'); L.set(113, 14, 'S'); L.set(127, 14, 'H');
      L.row(104, 10, 'GGGG'); L.row(110, 11, 'CPC');
      L.secret(118, 12, 123, 14); L.row(119, 14, 'GGGG'); L.row(119, 13, 'GGGG');
      L.ground(135, 179);
      L.set(140, 15, 'J'); L.fill(143, 8, 144, 14, 'B'); L.row(143, 7, 'GG'); L.row(139, 6, 'GGG');
      L.set(150, 14, 'S'); L.set(156, 14, 'S'); L.set(162, 14, 'H');
      L.fill(166, 14, 166, 14, 'I'); L.fill(167, 13, 167, 14, 'I'); L.fill(168, 12, 169, 14, 'I'); L.row(167, 10, 'GGG');
      L.set(175, 13, 'F');
    },
  },
  {
    // BOSS 1: Frosto - barf ka golem. Fisal ke aata hai, gussa ho to upar se barf ke kaante giraata hai
    name: 'Frost Fort', theme: 'snow', w: 50, boss: 'frosto',
    build(L) {
      L.ground(0, 49); L.set(3, 14, '@');
      L.row(6, 10, 'GGGG'); L.row(8, 11, 'RBP'); L.set(13, 14, 'K');
      L.fill(9, 15, 16, 15, 'I');
      L.row(25, 11, '===='); L.row(41, 11, '===='); L.row(32, 8, '===='); L.row(33, 7, 'GG');
    },
  },
  {
    // andheri gufa, neechi chhat aur tunnel
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
      L.set(73, 8, 'V');
      L.ground(75, 110);
      L.row(80, 14, '^^^^'); L.row(79, 11, '======'); L.row(80, 10, 'GGGG');
      L.set(88, 14, 'H'); L.set(94, 14, 'S'); L.set(100, 14, 'H');
      L.row(85, 11, 'GGG');
      L.set(90, 2, 'r'); L.set(97, 2, 'r');
      L.fill(104, 2, 106, 10, 'B');
      L.set(113, 12, 'B'); L.set(113, 11, 'G');
      L.ground(116, 150);
      L.set(120, 15, 'J'); L.row(119, 4, 'GGG');
      L.set(125, 14, 'S'); L.set(132, 14, 'S'); L.set(140, 14, 'S'); L.set(146, 14, 'H');
      L.row(128, 11, 'CRPCC'); L.set(136, 7, 'V'); L.set(143, 2, 'r');
      L.ground(155, 189);
      L.set(158, 14, 'S'); L.set(168, 14, 'S'); L.set(171, 14, 'H');
      L.set(163, 12, 'O');
      L.fill(175, 14, 175, 14, 'B'); L.fill(176, 13, 176, 14, 'B'); L.fill(177, 12, 178, 14, 'B'); L.row(176, 10, 'GGG');
      L.set(183, 13, 'F');
    },
  },
  {
    // hawa mein tairte tapu. Neeche gire to gaye!
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
      L.set(70, 11, 'h'); L.row(76, 9, '===='); L.row(77, 8, 'GG'); L.row(82, 11, '====');
      island(88, 100, 13); L.set(91, 12, 'S'); L.set(96, 12, 'S'); L.row(93, 9, 'BRB');
      L.set(100, 13, 'J');
      island(106, 114, 9); L.row(107, 7, 'GGGGG'); L.set(112, 8, 'S');
      island(118, 124, 12); L.row(119, 10, 'GGG'); L.set(126, 6, 'V');
      island(128, 140, 14); L.set(131, 13, 'S'); L.set(138, 13, 'H'); L.row(133, 10, 'CWC');
      L.row(143, 12, '===='); L.set(149, 10, 'd'); L.set(151, 10, 'd'); L.row(150, 9, 'GG');
      island(155, 199, 13);
      L.set(165, 12, 'H'); L.set(170, 12, 'S'); L.set(176, 12, 'S'); L.set(172, 7, 'V');
      L.set(184, 12, 'B'); L.fill(185, 11, 185, 12, 'B'); L.fill(186, 10, 187, 12, 'B'); L.row(185, 8, 'GGG');
      L.set(193, 11, 'F');
    },
  },
  {
    // registaan: cactus, garam ret, chalti platform
    name: 'Sandy Dunes', theme: 'desert', w: 180,
    build(L) {
      L.ground(0, 30); L.set(3, 14, '@');
      L.row(7, 11, 'CRC'); L.row(8, 8, 'G G');
      L.set(14, 14, 'Y'); L.set(20, 14, 'S');
      L.fill(24, 13, 25, 14, 'B'); L.row(24, 11, 'GG');
      L.set(31, 12, 'h'); L.row(32, 10, 'GGG');
      L.ground(37, 70);
      L.set(42, 14, 'Y'); L.set(48, 14, 'H'); L.set(56, 14, 'S'); L.set(61, 14, 'Y');
      L.row(45, 11, 'BWB'); L.set(46, 8, 'G');
      L.row(52, 14, '^^^'); L.row(51, 11, '====='); L.row(52, 10, 'GGG');
      L.set(65, 14, 'K');
      L.fill(68, 12, 70, 14, 'B'); L.row(68, 10, 'GGG');
      L.ground(75, 110);
      L.set(77, 15, 'J'); L.fill(80, 8, 81, 14, 'B'); L.row(80, 6, 'GG');
      L.set(86, 14, 'S'); L.set(92, 14, 'S'); L.set(97, 14, 'H'); L.set(102, 14, 'Y');
      L.row(89, 11, 'CTC');
      L.secret(105, 12, 110, 14); L.row(106, 14, 'GGGG'); L.row(106, 13, 'GGGG');
      L.ground(115, 150);
      L.set(118, 14, 'S'); L.set(124, 14, 'Y'); L.set(130, 14, 'H'); L.set(135, 14, 'S');
      L.row(120, 10, 'GGGGG'); L.row(127, 11, 'CPC');
      L.row(140, 14, '^^^^'); L.row(139, 11, '======'); L.row(140, 10, 'GGGG');
      L.ground(155, 179);
      L.set(160, 14, 'Y'); L.set(166, 14, 'S');
      L.fill(168, 14, 168, 14, 'B'); L.fill(169, 13, 169, 14, 'B'); L.fill(170, 12, 171, 14, 'B'); L.row(169, 10, 'GGG');
      L.set(175, 13, 'F');
    },
  },
  {
    // purana jungle mandir: chhat se girte patthar, aag ke chakkar, girti platform
    name: 'Jungle Temple', theme: 'temple', w: 180,
    build(L) {
      L.ground(0, 26); L.set(3, 14, '@');
      L.row(7, 11, 'CPC'); L.set(14, 14, 'S'); L.set(20, 14, 'H');
      L.set(27, 12, 'd'); L.row(27, 10, 'GG');
      L.ground(31, 64); L.fill(31, 0, 64, 2, 'B');
      L.set(36, 3, 'r'); L.set(44, 3, 'r'); L.set(53, 3, 'r');
      L.set(40, 14, 'S'); L.set(49, 14, 'S'); L.set(57, 14, 'H');
      L.set(46, 11, 'O'); L.row(37, 12, 'GGG'); L.row(52, 12, 'GGG');
      L.set(61, 14, 'K');
      L.set(65, 12, 'd'); L.set(67, 12, 'd');
      L.ground(69, 105);
      L.fill(73, 13, 74, 14, 'B'); L.fill(80, 12, 81, 14, 'B'); L.fill(87, 11, 88, 14, 'B');
      L.row(80, 10, 'GG'); L.row(87, 9, 'GG');
      L.set(77, 14, 'S'); L.set(84, 14, 'S'); L.set(93, 14, 'H'); L.set(100, 14, 'S');
      L.set(96, 7, 'V'); L.row(91, 11, 'CRC');
      L.set(107, 12, 'v');
      L.ground(111, 150); L.fill(111, 0, 150, 2, 'B');
      L.set(116, 3, 'r'); L.set(127, 3, 'r'); L.set(141, 3, 'r');
      L.set(121, 12, 'O');
      L.set(131, 14, 'S'); L.set(137, 14, 'H'); L.set(146, 14, 'S');
      L.row(133, 11, 'CTC'); L.row(115, 11, 'GGG');
      L.ground(155, 179);
      L.set(162, 9, 'V');
      L.fill(168, 14, 168, 14, 'B'); L.fill(169, 13, 169, 14, 'B'); L.fill(170, 12, 171, 14, 'B'); L.row(169, 10, 'GGG');
      L.set(175, 13, 'F');
    },
  },
  {
    // baarish wala sheher: chhaton pe kood-kood ke chalo
    name: 'Rainy City', theme: 'city', w: 190,
    build(L) {
      const roof = (x1, x2, top) => L.fill(x1, top, x2, ROWS - 1, '#');
      roof(0, 16, 13); L.set(3, 12, '@');
      L.row(8, 9, 'CPC'); L.set(12, 12, 'S');
      roof(20, 30, 11); L.set(25, 10, 'S'); L.row(22, 7, 'GGG');
      L.set(33, 10, 'v'); L.row(33, 6, 'GGG');
      roof(37, 50, 12); L.set(42, 11, 'H'); L.set(47, 11, 'S'); L.row(40, 8, 'CRC');
      roof(53, 60, 10); L.set(56, 9, 'K'); L.set(58, 5, 'V');
      roof(64, 75, 12); L.set(68, 11, 'S'); L.set(72, 11, 'Y'); L.row(66, 8, 'GGGG');
      L.set(77, 11, 'h'); L.row(78, 8, 'GGG');
      roof(84, 98, 11); L.set(88, 10, 'S'); L.set(94, 10, 'H'); L.row(89, 7, 'CWC');
      L.set(101, 11, 'd'); L.set(103, 11, 'd'); L.row(101, 9, 'GGGG');
      roof(106, 120, 12); L.set(110, 11, 'S'); L.row(107, 8, 'GGGG'); L.set(113, 6, 'V');
      L.secret(116, 9, 120, 11); L.row(117, 11, 'GGG'); L.row(117, 10, 'GGG');
      roof(124, 135, 10); L.set(128, 9, 'H'); L.set(133, 9, 'S'); L.row(129, 6, 'CTC');
      roof(140, 150, 13); L.set(145, 12, 'Y'); L.row(142, 10, 'GGG');
      L.set(153, 12, 'v'); L.row(153, 8, 'GGG');
      roof(158, 189, 10); L.set(165, 9, 'S'); L.set(171, 9, 'H'); L.set(177, 9, 'S');
      L.set(185, 8, 'F');
    },
  },
  {
    // FINAL BOSS: tile 20 ke baad arena hai, wahan Magmo intezaar kar raha hai
    name: 'Magma Den', theme: 'lava', w: 50, boss: 'magmo',
    build(L) {
      L.ground(0, 49); L.set(3, 14, '@');
      L.row(6, 10, 'GGGG'); L.row(8, 11, 'RBP'); L.set(13, 14, 'K');
      L.set(17, 12, 'O');
      L.row(25, 11, '===='); L.row(41, 11, '===='); L.row(32, 8, '===='); L.row(33, 7, 'GG');
    },
  },
];

function buildGrid(def) {
  const g = [], secrets = [];
  for (let r = 0; r < ROWS; r++) g.push(new Array(def.w).fill('.'));
  const L = {
    set(x, y, c) { if (x >= 0 && x < def.w && y >= 0 && y < ROWS) g[y][x] = c; },
    fill(x1, y1, x2, y2, c) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, c); },
    ground(x1, x2, top = 15) { this.fill(x1, top, x2, ROWS - 1, '#'); },
    row(x, y, s) { for (let i = 0; i < s.length; i++) if (s[i] !== ' ') this.set(x + i, y, s[i]); },
    // chhupa kamra: chhat + daayi deewar asli patthar, baaki nakli (andar ja sakte ho)
    secret(x1, y1, x2, y2) {
      this.fill(x1, y1, x2, y1, 'B'); this.fill(x2, y1 + 1, x2, y2, 'B');
      secrets.push({ x1, y1: y1 + 1, x2: x2 - 1, y2 });
    },
  };
  def.build(L);
  g.secrets = secrets;
  return g;
}

// ---------- Game state ----------
let state = 'title';
let levelIndex = 0, level, player, players = [], enemies, gems, items, particles, popups, bumps, portal, flags = [];
let hazards = [], plats = [], thorns = [], ui = [];
let checkpoint = null; // { level, tx }
let score = 0, gemCount = 0, lives = 3, timeLeft = 0, stateTimer = 0, frame = 0, paused = false;
let levelGemsGot = 0, levelTotalGems = 0, levelDeaths = 0, clearStars = [true, false, false], starKills = 0;
// gameMode: adv (kahani), duo (2 player), trial (time trial), endless, rush (boss rush), daily, custom (apna level)
let gameMode = 'adv', curDef = null, runT = 0, rushIdx = 0;
const cam = { x: 0 };

const SOLID = new Set(['#', 'B', 'C', 'P', 'R', 'T', 'M', 'W', 'X', 'I', 'J']);
const CRATES = { C: 'gem', P: 'leaf', R: 'fire', T: 'star', M: 'magnet', W: 'wing' };
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
function inWater(x, y) {
  if (!level || !level.water) return false;
  for (const r of level.water)
    if (x >= r.x1 * TILE && x < (r.x2 + 1) * TILE && y >= r.y1 * TILE && y < (r.y2 + 1) * TILE) return true;
  return false;
}

// ---------- Save: progress, stars, dukaan, achievements, settings (browser mein) ----------
const SAVE_KEY = 'tikkuRunSave';
const save = { unlocked: 0, stars: [], wallet: 0, owned: ['green'], scarf: 'green', ach: {},
  chars: ['fox'], char: 'fox',
  stats: { gems: 0, kills: 0, fireKills: 0 }, set: { music: 8, sfx: 8, diff: 1, vib: true }, story: false,
  top: [], tops: { adv: [], endless: [], rush: [], daily: [] }, best: { endless: 0, rush: 0 }, times: {},
  daily: { date: '', best: 0, streak: 0, last: '' }, custom: null, cloud: '', lastName: '' };
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (s && typeof s === 'object') for (const k in save) if (k in s && s[k] !== null) {
    const d = save[k];
    if (d && typeof d === 'object' && !Array.isArray(d)) Object.assign(d, s[k]); else save[k] = s[k];
  }
  if (save.top.length && !save.tops.adv.length) save.tops.adv = save.top; // purane version se
  save.top = [];
} catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
// Easy / Normal / Hard
const DIFFS = [
  { lives: 5, time: 400, spd: 0.75, boss: 4 },
  { lives: 3, time: 300, spd: 1, boss: 5 },
  { lives: 2, time: 220, spd: 1.3, boss: 7 },
];
const diff = () => DIFFS[save.set.diff] || DIFFS[1];

// ---------- Kirdaar (characters): har ek ki apni khaasiyat ----------
const CHARS = {
  fox:   { name: 'Tikku', price: 0,   jump: 1,    speed: 1,    glide: false, tough: false },
  bunny: { name: 'Bunty', price: 200, jump: 1.12, speed: 0.95, glide: false, tough: false },
  panda: { name: 'Bholu', price: 400, jump: 0.95, speed: 0.95, glide: false, tough: true },
  owl:   { name: 'Chiku', price: 700, jump: 1,    speed: 0.92, glide: true,  tough: false },
};
const CHAR_IDS = Object.keys(CHARS);
const charName = (id = save.char) => (CHARS[id] || CHARS.fox).name;
// 2 player mein doosra khiladi: koi aur kirdaar jo tumhare paas hai, warna Bunty
function p2Char() { return save.chars.find(c => c !== save.char) || (save.char === 'bunny' ? 'fox' : 'bunny'); }

function newPlayer(x, y, keep = {}, idx = 0, ch = save.char) {
  return { idx, ch, x, y, w: 22, h: 28, vx: 0, vy: 0, facing: 1, onGround: false, coyote: 0, buffer: 0,
           jumping: false, leaf: !!keep.leaf, fire: !!keep.fire, wing: !!keep.wing, star: 0, magnet: 0, ride: null,
           gliding: false, wet: false, fireCd: 0, sx: 1, sy: 1, wasGround: true, shootT: 0, canDouble: false,
           invuln: idx ? 60 : 0, anim: 0, dying: false, deathT: 0, prevBottom: 0 };
}
const alivePlayers = () => players.filter(p => !p.dying);

// tiles ko dushman / gems / platforms mein badalna (x0 se x1 tak ke columns)
function spawnRange(x0, x1) {
  const spd = diff().spd;
  let start = null;
  for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx < x1; tx++) {
    const c = level.grid[ty][tx];
    const px = tx * TILE, py = ty * TILE;
    if (c === 'C') levelTotalGems++;
    if (c === '@') start = { x: px + 5, y: py + TILE - 28 };
    else if (c === 'S') enemies.push({ type: 'slime', x: px + 2, y: py + 10, w: 28, h: 22, vx: -0.8 * spd, speed: 0.8 * spd, vy: 0 });
    else if (c === 'H') enemies.push({ type: 'hedge', x: px + 2, y: py + 10, w: 28, h: 22, vx: -1.1 * spd, speed: 1.1 * spd, vy: 0 });
    else if (c === 'V') enemies.push({ type: 'bat', x: px + 3, y: py + 7, w: 26, h: 18, ox: px + 3, oy: py + 7, range: 80,
                                       vx: -1.2 * spd, speed: 1.2 * spd, vy: 0, t: tx });
    else if (c === 'Q') enemies.push({ type: 'fish', x: px + 2, y: py + 7, w: 28, h: 18, ox: px + 2, oy: py + 7, range: 64,
                                       vx: -0.9 * spd, speed: 0.9 * spd, vy: 0, t: tx });
    else if (c === 'Y') enemies.push({ type: 'cactus', x: px + 4, y: py + 2, w: 24, h: 30, vx: 0, speed: 0, vy: 0, cd: 60 + (tx % 4) * 20, face: -1 });
    else if (c === 'G') { gems.push({ x: px + 8, y: py + 6, w: 16, h: 20, phase: tx * 0.7 }); levelTotalGems++; }
    else if (c === 'F') portal = { x: px, y: py, w: 32, h: 64 };
    else if (c === 'K') flags.push({ x: px + 4, y: py - 52, w: 24, h: 84, tx, active: false, wave: 0 });
    else if (c === 'O') {
      hazards.push({ type: 'bar', cx: px + 16, cy: py + 16, a: tx * 0.7, n: 5, spd: 0.03 * spd * (tx % 2 ? 1 : -1) });
      level.grid[ty][tx] = 'B'; continue;
    }
    else if (c === 'r') hazards.push({ type: 'rock', x: px + 4, y: py, w: 24, h: 30, st: 'hang', t: 0, vy: 0 });
    else if (c === 'h' || c === 'v') plats.push({ type: c, x: px, y: py, ox: px, oy: py, w: 96, h: 14, t: tx * 0.4,
                                                  speed: 0.022, range: c === 'h' ? 64 : 72, dx: 0, dy: 0 });
    else if (c === 'd') plats.push({ type: 'd', x: px, y: py, ox: px, oy: py, w: 64, h: 14, shakeT: 0, falling: false, gone: false, vy: 0, dx: 0, dy: 0 });
    else continue;
    level.grid[ty][tx] = '.';
  }
  for (const e of enemies) if (e.anim === undefined) { e.active = false; e.dead = 0; e.anim = Math.random() * 6; }
  return start;
}

function loadLevel(i, keep = {}, def = LEVELS[i]) {
  curDef = def;
  const grid = buildGrid(def);
  level = { w: def.w, grid, theme: THEMES[def.theme], themeName: def.theme, name: def.name,
            secrets: grid.secrets.map(s => ({ ...s, found: false, a: 1 })),
            water: def.water ? def.water.map(([x1, y1, x2, y2]) => ({ x1, y1, x2, y2 })) : null };
  enemies = []; gems = []; items = []; particles = []; popups = []; bumps = []; portal = null; flags = []; fireballs = [];
  hazards = []; plats = []; thorns = [];
  levelTotalGems = 0; levelGemsGot = 0; starKills = 0;
  let start = spawnRange(0, level.w) || { x: 64, y: 400 };
  // checkpoint mila hua hai to wahin se shuru karo
  if (checkpoint && checkpoint.level === i && gameMode !== 'trial') {
    const f = flags.find(f => f.tx === checkpoint.tx);
    if (f) {
      f.active = true; f.wave = 1;
      start = { x: f.x + 30, y: f.y + f.h - 28 };
      // flag ke aas-paas ke dushman hata do, taaki respawn hote hi maar na khao
      enemies = enemies.filter(e => Math.abs(e.x - start.x) > TILE * 5);
    }
  }
  players = [newPlayer(start.x, start.y, keep, 0, save.char)];
  if (gameMode === 'duo') players.push(newPlayer(start.x + 26, start.y, keep, 1, p2Char()));
  player = players[0];
  boss = def.boss ? makeBoss(def.boss) : null;
  bossStarted = false; bossIntro = 0; waves = [];
  timeLeft = diff().time * 60;
  cam.x = Math.max(0, Math.min(player.x + player.w / 2 - W * 0.42, level.w * TILE - W));
  ghostStart(i);
}

// ---------- Visitor/khiladi ginti (GoatCounter) ----------
// index.html mein GoatCounter script laga ho tabhi kaam karta hai, warna chupchaap kuch nahi karta
function track(name, title) {
  try {
    if (window.goatcounter && window.goatcounter.count)
      window.goatcounter.count({ path: 'tikku-run-' + name, title: title || name, event: true });
  } catch (e) {}
}

function resetRun(livesN) {
  score = 0; gemCount = 0; lives = livesN; checkpoint = null; newHigh = false; levelDeaths = 0; runT = 0; paused = false;
}
// World map se shuru (kahani, 2 player ya time trial - jo mode chuna ho)
function startFrom(i) {
  if (gameMode !== 'duo' && gameMode !== 'trial') gameMode = 'adv';
  track(gameMode === 'adv' ? 'start' : 'start-' + gameMode, 'Game shuru kiya (' + gameMode + ')');
  resetRun(gameMode === 'trial' ? 1 : diff().lives + (gameMode === 'duo' ? 2 : 0));
  levelIndex = i;
  loadLevel(i);
  if (i === 0 && gameMode === 'adv' && !save.story) startStory(INTRO, () => { save.story = true; persist(); state = 'ready'; stateTimer = 0; });
  else { state = 'ready'; stateTimer = 0; }
}
function startGame() { gameMode = 'adv'; startFrom(0); }
function startEndless() {
  gameMode = 'endless'; track('start-endless', 'Endless shuru'); resetRun(1); levelIndex = -1;
  loadLevel(-1, {}, endlessDef()); state = 'ready'; stateTimer = 0;
}
const RUSH = LEVELS.map((L, i) => L.boss ? i : -1).filter(i => i >= 0);
function startRush() {
  gameMode = 'rush'; track('start-rush', 'Boss Rush shuru'); resetRun(diff().lives); rushIdx = 0;
  levelIndex = RUSH[0]; loadLevel(levelIndex); state = 'ready'; stateTimer = 0;
}
function startDaily() {
  gameMode = 'daily'; track('start-daily', 'Daily challenge shuru'); resetRun(3); levelIndex = -1;
  loadLevel(-1, {}, dailyDef()); state = 'ready'; stateTimer = 0;
}
function startCustom(def) {
  gameMode = 'custom'; resetRun(3); levelIndex = -1;
  loadLevel(-1, {}, def); state = 'ready'; stateTimer = 0;
}

// ---------- High score (browser mein save hota hai) ----------
const HS_KEY = 'tikkuRunHighScore';
let highScore = 0, newHigh = false;
try { highScore = parseInt(localStorage.getItem(HS_KEY)) || 0; } catch (e) {}
function saveHighScore() {
  if (gameMode !== 'adv' && gameMode !== 'duo') return;
  if (score > highScore) {
    highScore = score; newHigh = true;
    try { localStorage.setItem(HS_KEY, String(highScore)); } catch (e) {}
  }
}

// ---------- Endless / Daily: apne aap banne wala level ----------
function makeRng(seed) { // chhota sa seeded random (har baar same seed = same level)
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pickR = (r, arr) => arr[Math.floor(r() * arr.length)];
function foe(L, x, y, r, d) { if (r() < 0.35 + d * 0.4) L.set(x, y, r() < 0.25 + d * 0.35 ? 'H' : 'S'); }
// har chunk: kahan se shuru (x), kitna mushkil (d: 0..1); chaudai (width) wapas deta hai
const CHUNKS = [
  { min: 0, f(L, x, r, d) { L.ground(x, x + 13); foe(L, x + 5 + ri(r, 0, 5), 14, r, d); if (r() < 0.6) L.row(x + 3, 11, 'GGGG'); return 14; } },
  { min: 0, f(L, x, r, d) { const g = 2 + ri(r, 0, d > 0.5 ? 2 : 1); L.ground(x, x + 5); L.ground(x + 6 + g, x + 11 + g); L.row(x + 6, 11, 'G'.repeat(g)); return 12 + g; } },
  { min: 0, f(L, x, r, d) { L.ground(x, x + 3); L.row(x + 5, 12, '==='); L.row(x + 9, 11, '==='); L.row(x + 9, 9, 'GGG'); L.ground(x + 13, x + 16); return 17; } },
  { min: 0.1, f(L, x, r, d) { L.ground(x, x + 3); L.set(x + 6, 12, 'h'); L.row(x + 6, 9, 'GGG'); L.ground(x + 12, x + 15); return 16; } },
  { min: 0, f(L, x, r, d) { L.ground(x, x + 14); L.set(x + 3, 14, 'B'); L.fill(x + 4, 13, x + 4, 14, 'B'); L.fill(x + 5, 12, x + 6, 14, 'B'); L.fill(x + 7, 13, x + 7, 14, 'B'); L.row(x + 5, 10, 'GG'); foe(L, x + 11, 14, r, d); return 15; } },
  { min: 0.05, f(L, x, r, d) { const n = 3 + ri(r, 0, 2); L.ground(x, x + 14); L.row(x + 5, 14, '^'.repeat(n)); L.row(x + 4, 11, '='.repeat(n + 2)); L.row(x + 5, 10, 'G'.repeat(n)); return 15; } },
  { min: 0, f(L, x, r, d) { L.ground(x, x + 12); L.row(x + 4, 11, pickR(r, ['CPC', 'CRC', 'CCC', 'BCB', 'CTC', 'CMC', 'CWC', 'BCB'])); foe(L, x + 9, 14, r, d); return 13; } },
  { min: 0.1, f(L, x, r, d) { L.ground(x, x + 12); L.set(x + 3, 15, 'J'); L.fill(x + 6, 9, x + 7, 14, 'B'); L.row(x + 6, 7, 'GG'); return 13; } },
  { min: 0.2, f(L, x, r, d) { L.ground(x, x + 15); L.set(x + 6, 9, 'V'); if (d > 0.5) L.set(x + 12, 8, 'V'); L.row(x + 3, 12, 'GGG'); return 16; } },
  { min: 0.15, f(L, x, r, d) { L.ground(x, x + 13); L.set(x + 9, 14, 'Y'); L.row(x + 3, 11, 'BCB'); return 14; } },
  { min: 0.3, f(L, x, r, d) { L.ground(x, x + 3); L.set(x + 5, 12, 'd'); L.set(x + 8, 11, 'd'); L.row(x + 8, 9, 'GG'); L.ground(x + 12, x + 15); return 16; } },
  { min: 0.45, f(L, x, r, d) { L.ground(x, x + 14); L.set(x + 7, 11, 'O'); foe(L, x + 12, 14, r, d); return 15; } },
];
function addChunk(L, x, r, d) {
  const ok = CHUNKS.filter(c => c.min <= d);
  return pickR(r, ok).f(L, x, r, d);
}
const ENDLESS_THEMES = ['day', 'sunset', 'night', 'desert', 'snow', 'sky', 'city', 'temple'];
let gen = null;
function endlessDef() {
  gen = { r: makeRng((Math.random() * 1e9) | 0), x: 0, zones: [{ x: 0, th: 'day' }] };
  return { name: 'Endless Run', theme: 'day', w: 31, endless: true,
    build(L) { L.ground(0, 30); L.set(3, 14, '@'); L.row(8, 11, 'CPC'); L.row(16, 11, 'GGGG'); } };
}
// player aage badhe to aage naya raasta banta jaata hai
function growEndless() {
  if (!gen) return;
  if (gen.x === 0) gen.x = level.w;
  const L = {
    set(x, y, c) { if (y < 0 || y >= ROWS) return; const row = level.grid[y]; while (row.length <= x) row.push('.'); row[x] = c; },
    fill(x1, y1, x2, y2, c) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, c); },
    ground(x1, x2, top = 15) { this.fill(x1, top, x2, ROWS - 1, '#'); },
    row(x, y, s) { for (let i = 0; i < s.length; i++) if (s[i] !== ' ') this.set(x + i, y, s[i]); },
  };
  while (gen.x - player.x / TILE < 70) {
    const d = Math.min(1, gen.x / 1400);
    const x0 = gen.x, w = addChunk(L, x0, gen.r, d);
    for (const row of level.grid) while (row.length < x0 + w) row.push('.');
    level.w = x0 + w;
    spawnRange(x0, x0 + w);
    gen.x = x0 + w;
    if (Math.floor(x0 / 150) !== Math.floor(gen.x / 150))
      gen.zones.push({ x: Math.floor(gen.x / 150) * 150, th: ENDLESS_THEMES[Math.floor(gen.x / 150) % ENDLESS_THEMES.length] });
  }
}
const todayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function dailyDef() {
  const key = todayKey(), r = makeRng(key * 7919);
  const dayNo = Math.floor(Date.now() / 864e5);
  return { name: 'Daily ' + String(key).slice(6) + '/' + String(key).slice(4, 6), theme: ENDLESS_THEMES[dayNo % ENDLESS_THEMES.length], w: 240, daily: true,
    build(L) {
      L.ground(0, 24); L.set(3, 14, '@'); L.row(8, 11, pickR(r, ['CPC', 'CRC', 'CWC']));
      let x = 25;
      while (x < 205) x += addChunk(L, x, r, Math.min(0.85, 0.25 + (x / 205) * 0.6));
      L.ground(x, 239); L.set(x + 2, 14, 'K'); L.set(x + 8, 13, 'F');
    } };
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
  const t = tileAt(tx, ty), kind = CRATES[t];
  if (kind === 'gem') {
    level.grid[ty][tx] = 'X';
    addGem(); score += 50; floatText(tx * TILE + 16, ty * TILE - 24, '+50', '#b3e5fc');
    popups.push({ x: tx * TILE + 16, y: ty * TILE - 8, vy: -7, life: 28 });
  } else if (kind) {
    level.grid[ty][tx] = 'X';
    items.push({ x: tx * TILE + 4, y: ty * TILE, w: 24, h: 24, targetY: ty * TILE - 28, phase: 0, kind });
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
  gemCount++; levelGemsGot++; SFX.gem();
  save.wallet++; save.stats.gems++;
  if (save.stats.gems >= 100) unlock('gem100');
  if (save.stats.gems >= 500) unlock('gem500');
  if (gemCount >= 100) { gemCount -= 100; lives++; SFX.life(); }
  if (save.stats.gems % 10 === 0) persist();
}

// phone halka sa kaanpe (sirf Android phones pe; iPhone mein ye suvidha nahi hai)
function buzz(ms) { if (save.set.vib && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

const ENEMY_COL = { slime: '#b06cff', hedge: '#8d6e63', bat: '#7e57c2', fish: '#ff8a65', cactus: '#7cb342' };
function killEnemy(e, flip) {
  e.dead = 1; e.flip = !!flip;
  if (flip) { e.vy = -7; }
  score += 200;
  save.stats.kills++;
  if (save.stats.kills >= 50) unlock('stomp50');
  SFX.stomp(); buzz(15);
  floatText(e.x + e.w / 2, e.y - 6, '+200', '#fff59d');
  puff(e.x + e.w / 2, e.y + e.h, 5, e.type === 'slime' ? 'rgba(186,140,255,0.85)' : 'rgba(200,180,160,0.85)');
  for (let i = 0; i < 8; i++) particles.push({
    x: e.x + e.w / 2, y: e.y + e.h / 2, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4,
    life: 30, color: ENEMY_COL[e.type] || '#fff' });
}

function hurtPlayer(p = player) {
  if (p.invuln > 0 || p.dying || p.star > 0) return;
  const lose = col => {
    p.invuln = 110; SFX.hurt(); buzz(80);
    for (let i = 0; i < 10; i++) particles.push({ x: p.x + 11, y: p.y, vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 5, life: 40, color: col });
  };
  // pehle aag jaati hai, phir pankh, phir patta, phir jaan
  if (p.fire) { p.fire = false; lose('#ff7043'); }
  else if (p.wing) { p.wing = false; lose('#ffffff'); }
  else if (p.leaf) { p.leaf = false; lose('#66bb6a'); }
  else killPlayer(false, p);
}

function killPlayer(fell, p = player) {
  if (p.dying) return;
  p.dying = true; p.vx = 0; p.vy = fell ? 0 : -10; p.star = 0; p.deathT = 0; p.ride = null;
  levelDeaths++; SFX.die(); buzz(250);
  // 2 player: dost zinda hai to game chalta rehta hai, ye thodi der baad wapas aayega
  if (alivePlayers().length > 0) return;
  player = p;
  state = 'dying'; stateTimer = 0;
}

// ---------- Update ----------
const MENU_STATES = new Set(['title', 'settings', 'shop', 'achievements', 'scores', 'help', 'gameover', 'win',
                             'result', 'modes', 'chars', 'cloud']);
const OK_KEYS = ['Enter', 'Space', 'KeyZ', 'PadStart'];
function isMenuState() { return MENU_STATES.has(state) || state === 'map' || state === 'editor' || (state === 'playing' && paused); }

function update() {
  frame++;
  pollPad();
  if (textOpen) { pressed.clear(); return; } // naam/code likh rahe ho to game ruka rahe
  if (hit('KeyM')) muted = !muted;
  if (hit('KeyN')) musicOn = !musicOn;
  if (hit('KeyL') && state !== 'editor') setLang(lang === 'hi' ? 'en' : 'hi');
  if (shake > 0) shake *= 0.85;
  if (shake < 0.5) shake = 0;
  // kis screen pe kaunsa gaana
  if (state === 'ready' || state === 'playing') setMusic(boss && bossStarted && !boss.dead ? 'boss' : level.themeName);
  else if (state === 'dying' || state === 'clear' || state === 'gameover' || state === 'result') setMusic(null);
  else if (state === 'story') setMusic('sunset');
  else setMusic('title');
  syncBodyClass();
  for (const ts of toasts) ts.t--;
  toasts = toasts.filter(ts => ts.t > 0);

  // title / menu ke peeche background dheere-dheere sarakta hai
  if ((state === 'title' || SUB_SCREENS[state]) && level) cam.x = (0.5 - 0.5 * Math.cos(frame * 0.0015)) * Math.max(0, level.w * TILE - W);

  if (MENU_STATES.has(state)) {
    if (state !== 'title' && hit('Escape', 'PadBack')) menuBack();
    else menuUpdate(menuItems());
  } else if (state === 'map') updateMap();
  else if (state === 'story') updateStory();
  else if (state === 'editor') updateEditor();
  else if (state === 'ready') {
    stateTimer++;
    if (stateTimer > 90 || (stateTimer > 20 && hit('Enter', 'PadStart', ...JUMP_KEYS))) state = 'playing';
  } else if (state === 'playing') {
    if (hit('KeyP', 'Escape', 'PadStart')) { paused = !paused; menuFor = null; }
    else if (paused) menuUpdate(menuItems());
    if (!paused && state === 'playing') updatePlaying();
  } else if (state === 'dying') {
    stateTimer++;
    if (stateTimer > 25) { player.vy = Math.min(player.vy + GRAV, MAX_FALL); player.y += player.vy; }
    updateParticles();
    if (stateTimer > 150) {
      if (gameMode === 'trial') { loadLevel(levelIndex); runT = 0; state = 'ready'; stateTimer = 0; } // time trial: turant dobara
      else {
        lives--;
        if (lives <= 0) runOver(false);
        else { loadLevel(levelIndex, {}, curDef); state = 'ready'; stateTimer = 0; }
      }
    }
  } else if (state === 'clear') {
    stateTimer++;
    if (gameMode !== 'trial') for (let k = 0; k < 3; k++) if (stateTimer === 30 + k * 25 && clearStars[k]) beep(660 + k * 220, 990 + k * 330, 0.18, 'triangle', 0.08);
    // bacha hua time score mein convert hota hai
    if (timeLeft > 0 && gameMode !== 'trial') { const d = Math.min(timeLeft, 60 * 3); timeLeft -= d; score += Math.floor(d / 60) * 10; }
    updateParticles();
    if (stateTimer > 200) afterClear();
  }
  pressed.clear();
}

// level paar hone ke baad kahan jaana hai (mode ke hisaab se)
function afterClear() {
  const i = levelIndex;
  if (gameMode === 'trial') { openMap(); return; }
  if (gameMode === 'daily' || gameMode === 'custom') { runOver(true); return; }
  if (gameMode === 'rush') {
    rushIdx++;
    if (rushIdx >= RUSH.length) { runOver(true); return; }
    levelIndex = RUSH[rushIdx]; checkpoint = null; levelDeaths = 0;
    loadLevel(levelIndex, { leaf: player.leaf, fire: player.fire, wing: player.wing }); state = 'ready'; stateTimer = 0;
    return;
  }
  track('world-' + (i + 1) + '-clear', 'World ' + (i + 1) + ' paar kiya');
  levelIndex++; checkpoint = null; levelDeaths = 0; saveHighScore();
  if (levelIndex >= LEVELS.length) {
    levelIndex = LEVELS.length - 1;
    track('win', 'Poora game jeeta');
    if (save.set.diff === 2) unlock('hard');
    startStory(ENDING, () => { state = 'win'; stateTimer = 0; endRun('adv', true); });
  } else {
    loadLevel(levelIndex, { leaf: player.leaf, fire: player.fire, wing: player.wing });
    state = 'ready'; stateTimer = 0;
  }
}

// game khatam (haare ya mode poora hua)
function runOver(won) {
  stateTimer = 0;
  if (gameMode === 'adv' || gameMode === 'duo') {
    state = 'gameover';
    track('gameover-world-' + (levelIndex + 1), 'Game over (World ' + (levelIndex + 1) + ')');
    endRun('adv', false);
    return;
  }
  const R = { won, lines: [] };
  if (gameMode === 'endless') {
    const dist = Math.floor(player.x / TILE);
    score += dist * 10;
    R.title = t('endlessOver'); R.lines = [`${t('distance')}: ${dist} m`, `${t('score')}: ${score}`];
    if (dist > save.best.endless) { save.best.endless = dist; R.lines.push(t('newBest')); }
    R.lines.push(`${t('best')}: ${save.best.endless} m`);
    if (dist >= 500) unlock('endless500');
    track('endless-over', 'Endless khatam');
    endRun('endless', false);
  } else if (gameMode === 'rush') {
    R.title = won ? t('rushWin') : t('gameOver');
    if (won) { score += Math.max(0, 20000 - Math.floor(runT / 6)); unlock('rush'); }
    R.lines = [`${t('time')}: ${fmtTime(runT)}`, `${t('score')}: ${score}`];
    if (won && score > save.best.rush) { save.best.rush = score; R.lines.push(t('newBest')); }
    endRun('rush', won);
  } else if (gameMode === 'daily') {
    const k = String(todayKey()), D = save.daily;
    R.title = won ? t('dailyWin') : t('gameOver');
    if (won) {
      unlock('daily');
      if (D.date !== k) { // aaj pehli baar paar kiya: streak badhao
        const y = new Date(Date.now() - 864e5), yk = String(y.getFullYear() * 10000 + (y.getMonth() + 1) * 100 + y.getDate());
        D.streak = D.last === yk ? D.streak + 1 : 1; D.last = k; D.date = k; D.best = 0;
      }
      if (score > D.best) { D.best = score; R.lines.push(t('newBest')); }
      R.lines.unshift(`${t('score')}: ${score}`, `${t('streak')}: ${D.streak} 🔥`);
      endRun('daily', true);
    } else R.lines = [`${t('score')}: ${score}`, t('dailyRetry')];
  } else if (gameMode === 'custom') {
    R.title = won ? t('levelClear') : t('gameOver');
    R.lines = [`${t('score')}: ${score}`];
    if (won && curDef && curDef.mine) unlock('creator');
  }
  persist();
  resultInfo = R; goState('result');
}

// level khatam: stars ginna aur progress save karna
function onLevelClear() {
  const i = levelIndex;
  const gemsOk = levelTotalGems === 0 || levelGemsGot >= Math.ceil(levelTotalGems * 0.8);
  clearStars = [true, gemsOk, levelDeaths === 0];
  if (levelDeaths === 0) unlock('nodeath');
  if (curDef.water) unlock('swim');
  if (gameMode === 'duo') unlock('duo');
  if (gameMode === 'trial') {
    trialNew = !save.times[i] || runT < save.times[i];
    if (trialNew) { save.times[i] = runT; ghostSave(i); }
  }
  if (gameMode === 'adv' || gameMode === 'duo') {
    const n = clearStars.filter(Boolean).length;
    save.stars[i] = Math.max(save.stars[i] || 0, n);
    save.unlocked = Math.max(save.unlocked, Math.min(i + 1, LEVELS.length - 1));
    if (i === 0) unlock('w1');
    if (n === 3) unlock('stars3');
    if (LEVELS.every((_, k) => save.stars[k] === 3)) unlock('allstars');
  }
  persist();
}

// ---------- Controls: 1 player ya 2 player ----------
const CTRL_SOLO = { left: ['ArrowLeft', 'KeyA', 'TLeft'], right: ['ArrowRight', 'KeyD', 'TRight'], jump: JUMP_KEYS,
                    run: ['ShiftLeft', 'ShiftRight', 'KeyX'], fire: ['KeyF', 'KeyC'] };
const CTRL_P1 = { left: ['KeyA', 'TLeft', 'G0L'], right: ['KeyD', 'TRight', 'G0R'], jump: ['KeyW', 'Space', 'G0J'],
                  run: ['ShiftLeft', 'G0Run'], fire: ['KeyF', 'G0F'] };
const CTRL_P2 = { left: ['ArrowLeft', 'G1L'], right: ['ArrowRight', 'G1R'], jump: ['ArrowUp', 'G1J'],
                  run: ['ShiftRight', 'G1Run'], fire: ['Enter', 'NumpadEnter', 'Slash', 'Period', 'G1F'] };
const ctrlFor = p => gameMode !== 'duo' ? CTRL_SOLO : p.idx ? CTRL_P2 : CTRL_P1;

const fireBtn = document.getElementById('firebtn');
const POWER_TXT = { fire: 'FIRE!', leaf: 'LEAF!', wing: 'WINGS!', star: 'STAR!', magnet: 'MAGNET!' };
const POWER_COL = { fire: '#ffab40', leaf: '#c5e1a5', wing: '#ffffff', star: '#fff176', magnet: '#ef9a9a' };

// ek khiladi ki chaal: chalna, koodna, tairna, fire, spring, spikes
function playerCore(p) {
  const C = ctrlFor(p), st = CHARS[p.ch] || CHARS.fox;
  if (p.ride) {
    const pl = p.ride;
    if (pl.gone) p.ride = null;
    else { const svx = p.vx; p.vx = pl.dx; p.x += pl.dx; collideX(p); p.vx = svx; p.y += pl.dy; }
  }
  const left = down(...C.left), right = down(...C.right);
  const run = down(...C.run);
  const jumpHeld = down(...C.jump), jumpHit = hit(...C.jump);
  const wet = inWater(p.x + p.w / 2, p.y + p.h / 2);
  if (wet && !p.wet && p.vy > 1.5) splash(p);
  p.wet = wet;
  const max = (wet ? (run ? 3.4 : 2.6) : run ? 5.2 : 3.2) * st.speed;
  const onIce = !wet && p.onGround && footTiles(p).includes('I');
  const acc = wet ? 0.25 : onIce ? 0.13 : p.onGround ? 0.45 : 0.32;

  if (left && !right) { p.vx -= acc; p.facing = -1; }
  else if (right && !left) { p.vx += acc; p.facing = 1; }
  else { p.vx *= wet ? 0.9 : onIce ? 0.985 : p.onGround ? 0.78 : 0.96; if (Math.abs(p.vx) < 0.05) p.vx = 0; }
  if (Math.abs(p.vx) > max) p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) * 0.92);

  if (wet) {
    // PAANI: jump = tairo, upar satah ke paas jump = bahar uchhlo
    p.coyote = 0; p.buffer = 0; p.jumping = false; p.gliding = false;
    if (jumpHit) {
      const nearTop = !inWater(p.x + p.w / 2, p.y - 6);
      p.vy = nearTop ? -9.5 : -4.4; p.sx = 0.85; p.sy = 1.18;
      beep(nearTop ? 300 : 480, nearTop ? 760 : 820, 0.12, 'sine', 0.06);
      bubbles(p.x + p.w / 2, p.y + p.h, 3);
    }
    p.vy = Math.min(p.vy + 0.12, 1.7);
    if (frame % 24 === 0) bubbles(p.x + p.w / 2 + p.facing * 8, p.y + 6, 1);
  } else {
    p.coyote = p.onGround ? 7 : p.coyote - 1;
    p.buffer = jumpHit ? 7 : p.buffer - 1;
    if (p.buffer > 0) {
      if (p.coyote > 0) {
        p.vy = -13 * st.jump; p.coyote = 0; p.buffer = 0; p.jumping = true; SFX.jump(); p.ride = null;
        p.sx = 0.72; p.sy = 1.3; puff(p.x + p.w / 2, p.y + p.h, 5);
      } else if (p.leaf && p.canDouble) {
        p.vy = -11 * st.jump; p.canDouble = false; p.buffer = 0; p.jumping = true; SFX.djump();
        p.sx = 0.8; p.sy = 1.25;
        for (let i = 0; i < 8; i++) particles.push({ x: p.x + 11, y: p.y + p.h, vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 2, life: 20, color: '#a5d6a7' });
      }
    }
    if (p.jumping && !jumpHeld && p.vy < -3) { p.vy *= 0.45; p.jumping = false; }
    if (p.vy >= 0) p.jumping = false;
    p.vy = Math.min(p.vy + GRAV, MAX_FALL);
    // PANKH (ya Chiku ullu): hawa mein jump dabaye rakho to dheere-dheere utro
    p.gliding = (p.wing || st.glide) && !p.onGround && jumpHeld && p.vy > 1.3;
    if (p.gliding) {
      p.vy = 1.3;
      if (frame % 6 === 0) particles.push({ x: p.x + p.w / 2 - p.facing * 10, y: p.y + 10, vx: -p.facing * 0.5, vy: 0.3, g: 0,
        r: 2, life: 18, color: 'rgba(255,255,255,0.8)' });
    }
  }

  p.x += p.vx; collideX(p);
  if (p.x < 0) { p.x = 0; p.vx = 0; }
  p.prevBottom = p.y + p.h;
  const vyBefore = p.vy;
  p.y += p.vy; collideY(p, true);
  // chalti/girti platform pe utarna (sirf upar se)
  p.ride = null;
  if (p.vy >= 0) for (const pl of plats) {
    if (pl.gone) continue;
    if (p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 && p.prevBottom <= pl.y + 6 && p.y + p.h >= pl.y) {
      p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.ride = pl;
      if (pl.type === 'd' && !pl.shakeT) pl.shakeT = 1;
      break;
    }
  }
  if (p.onGround && !p.wasGround && vyBefore > 3) { // zameen pe girne par dabna + dhool
    p.sx = 1.3; p.sy = 0.72; puff(p.x + p.w / 2, p.y + p.h, vyBefore > 9 ? 8 : 4);
  }
  p.wasGround = p.onGround;
  // FIRE: ek baar mein max 2 gole har khiladi ke (paani mein aag nahi chalti)
  if (p.fireCd > 0) p.fireCd--;
  if (p.fire && !wet && hit(...C.fire) && p.fireCd === 0 && fireballs.filter(f => f.owner === p.idx).length < 2) {
    fireballs.push({ x: p.facing > 0 ? p.x + p.w : p.x - 12, y: p.y + 8, w: 12, h: 12,
                     vx: 7.5 * p.facing, vy: 2, life: 150, spin: 0, owner: p.idx });
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
  if (p.star > 0) {
    p.star--;
    if (frame % 3 === 0) particles.push({ x: p.x + Math.random() * p.w, y: p.y + Math.random() * p.h, vx: 0, vy: -0.6, g: 0,
      r: 2, life: 20, color: `hsl(${(frame * 9) % 360},100%,65%)` });
  }
  if (p.magnet > 0) p.magnet--;

  // spikes (star power ho to kuch nahi hota)
  if (p.star <= 0) {
    const l = Math.floor(p.x / TILE), r = Math.floor((p.x + p.w) / TILE);
    const t = Math.floor(p.y / TILE), b = Math.floor((p.y + p.h) / TILE);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++)
      if (tileAt(tx, ty) === '^' && overlap(p, { x: tx * TILE + 4, y: ty * TILE + 16, w: 24, h: 16 })) hurtPlayer(p);
  }
  if (p.y > ROWS * TILE + 20) killPlayer(true, p);
}

// 2 player: gira hua khiladi dost ke paas wapas aata hai (ek jaan kam hoti hai)
function updateDowned() {
  for (const p of players) {
    if (!p.dying) continue;
    p.deathT++;
    if (p.deathT > 25 && p.y < ROWS * TILE + 100) { p.vy = Math.min(p.vy + GRAV, MAX_FALL); p.y += p.vy; }
    if (p.deathT > 120) {
      const buddy = alivePlayers()[0];
      if (!buddy) continue;
      lives--;
      if (lives <= 0) { player = p; runOver(false); return; }
      const np = newPlayer(buddy.x, buddy.y - 4, {}, p.idx, p.ch);
      np.invuln = 120; np.facing = buddy.facing;
      players[players.indexOf(p)] = np;
      for (let i = 0; i < 14; i++) particles.push({ x: np.x + 11, y: np.y + 14, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 30, color: '#fff59d' });
    }
  }
  player = players[0];
}

function updatePlaying() {
  if (fireBtn) fireBtn.classList.toggle('off', !player.fire);
  updatePlats();
  for (const p of players) if (!p.dying) playerCore(p);
  if (state !== 'playing') return;
  if (gameMode === 'duo') { updateDowned(); if (state !== 'playing') return; }
  if (level.water && frame % 20 === 0) { // samundar mein bulbule
    const bx = cam.x + Math.random() * W;
    if (inWater(bx, 470)) bubbles(bx, 470, 1);
  }

  // timer
  runT++;
  if (gameMode !== 'endless' && gameMode !== 'trial') {
    timeLeft--;
    if (timeLeft <= 0) { timeLeft = 0; for (const p of alivePlayers()) killPlayer(false, p); return; }
  }
  if (gameMode === 'trial') ghostRecord();

  // camera: 1 khiladi ke peeche, ya 2 khiladiyon ke beech mein
  const live = alivePlayers(), lead = live.length ? live : players;
  const mid = lead.reduce((a, p) => a + p.x + p.w / 2, 0) / lead.length;
  cam.x += (mid - W * 0.42 - cam.x) * 0.15;
  cam.x = Math.max(0, Math.min(cam.x, level.w * TILE - W));
  if (bossStarted) cam.x += (level.w * TILE - W - cam.x) * 0.12; // arena mein camera ruk jaata hai
  if (gameMode === 'duo') for (const p of live) { // screen se bahar mat jaane do
    if (p.x < cam.x) { p.x = cam.x; if (p.vx < 0) p.vx = 0; }
    if (p.x + p.w > cam.x + W) { p.x = cam.x + W - p.w; if (p.vx > 0) p.vx = 0; }
  }
  if (curDef.endless) {
    growEndless();
    const tx = player.x / TILE, z = [...gen.zones].reverse().find(z => tx >= z.x);
    if (z && z.th !== level.themeName) { level.themeName = z.th; level.theme = THEMES[z.th]; fade = 0.7; }
    if (frame % 120 === 0) { // peeche chhoot gayi cheezein hatao
      const cut = cam.x - 900;
      enemies = enemies.filter(e => e.x > cut); gems = gems.filter(g => g.x > cut); hazards = hazards.filter(h => (h.x || h.cx) > cut);
      plats = plats.filter(pl => pl.ox > cut || players.some(p => p.ride === pl));
    }
  }
  updateEnemies();
  updateBoss();
  updateFireballs();
  updateHazards();
  updateThorns();
  if (state !== 'playing') return;

  for (const p of alivePlayers()) collectFor(p);
  gems = gems.filter(g => !g.got);
  items = items.filter(i => !i.got);
  for (const it of items) { if (it.y > it.targetY) it.y = Math.max(it.targetY, it.y - 1.2); it.phase += 0.08; }

  // popups & bumps
  for (const pu of popups) { pu.y += pu.vy; pu.vy += 0.5; pu.life--; }
  popups = popups.filter(pu => pu.life > 0);
  for (const b of bumps) b.t--;
  bumps = bumps.filter(b => b.t > 0);
  updateParticles();
  for (const s of level.secrets) if (s.found && s.a > 0) s.a = Math.max(0, s.a - 0.05);
  for (const f of flags) if (f.wave) f.wave++;
}

// gems, power-ups, secret, checkpoint, portal: har khiladi ke liye
function collectFor(p) {
  for (const g of gems) {
    if (g.got) continue;
    if (p.magnet > 0) {
      const dx = p.x + p.w / 2 - (g.x + 8), dy = p.y + p.h / 2 - (g.y + 10), d = Math.hypot(dx, dy);
      if (d < 190 && d > 1) { const s = Math.min(d, 7) / d; g.x += dx * s; g.y += dy * s; }
    }
    if (overlap(p, g)) {
      g.got = true; addGem(); score += 50; floatText(g.x + 8, g.y - 4, '+50', '#b3e5fc');
      for (let i = 0; i < 6; i++) particles.push({ x: g.x + 8, y: g.y + 10, vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3, life: 20, color: '#80deea' });
    }
  }
  for (const it of items) {
    if (!it.got && it.y <= it.targetY + 10 && overlap(p, it)) {
      it.got = true; SFX.power(); buzz(30);
      const K = it.kind || 'leaf';
      floatText(it.x + 12, it.y - 6, POWER_TXT[K], POWER_COL[K], 18);
      if (K === 'fire') { score += p.fire ? 1000 : 500; p.fire = true; }
      else if (K === 'wing') { score += p.wing ? 1000 : 500; p.wing = true; }
      else if (K === 'star') { score += 1000; p.star = 8 * 60; starKills = 0; }
      else if (K === 'magnet') { score += 500; p.magnet = 12 * 60; }
      else { score += p.leaf ? 1000 : 500; p.leaf = true; p.canDouble = !p.onGround; }
    }
  }
  for (const s of level.secrets) {
    if (!s.found && overlap(p, { x: s.x1 * TILE, y: s.y1 * TILE, w: (s.x2 - s.x1 + 1) * TILE, h: (s.y2 - s.y1 + 1) * TILE })) {
      s.found = true; score += 500; SFX.power(); unlock('secret');
      floatText(p.x + p.w / 2, p.y - 24, t('secret'), '#ffd54f', 20);
    }
  }
  for (const f of flags) {
    if (!f.active && overlap(p, f)) {
      flags.forEach(o => { o.active = false; });
      f.active = true; f.wave = 1;
      checkpoint = { level: levelIndex, tx: f.tx };
      score += 100; SFX.life(); floatText(f.x + 12, f.y - 8, 'CHECKPOINT', '#a5d6a7');
      for (let i = 0; i < 16; i++) particles.push({ x: f.x + 12, y: f.y + 10, vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5, life: 40, color: ['#ffca28', '#66bb6a', '#ffffff'][i % 3] });
    }
  }
  if (state === 'playing' && portal && overlap(p, { x: portal.x + 6, y: portal.y, w: 20, h: 64 })) {
    player = p;
    state = 'clear'; stateTimer = 0; SFX.clear();
    onLevelClear();
    for (let i = 0; i < 30; i++) particles.push({ x: portal.x + 16, y: portal.y + 32, vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8, life: 50, color: ['#ffeb3b', '#e040fb', '#40c4ff'][i % 3] });
  }
}

// sabse paas wala zinda khiladi (dushman isi ko nishana banate hain)
function nearestPlayer(x) {
  let best = player, bd = 1e9;
  for (const p of alivePlayers()) { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p; } }
  return best;
}

function updateEnemies() {
  for (const e of enemies) {
    if (!e.active) { if (e.x < cam.x + W + 64) e.active = true; else continue; }
    e.anim += 0.15;
    if (e.dead) {
      e.dead++;
      if (e.flip) { e.vy += GRAV; e.y += e.vy; }
      continue;
    }
    if (e.type === 'bat' || e.type === 'fish') {
      // udte / tairte hain: aage-peeche + lehar jaisa upar-neeche
      e.t += e.type === 'bat' ? 0.06 : 0.035;
      e.x += e.vx;
      if (Math.abs(e.x - e.ox) > e.range) { e.x = e.ox + Math.sign(e.x - e.ox) * e.range; e.vx = -e.vx; }
      e.y = e.oy + Math.sin(e.t) * (e.type === 'bat' ? 26 : 14);
    } else if (e.type === 'cactus') {
      // ek jagah khada rehta hai aur sabse paas wale khiladi ki taraf kaante phenkta hai
      const tp = nearestPlayer(e.x);
      e.vy = Math.min(e.vy + GRAV, MAX_FALL);
      e.prevBottom = e.y + e.h; e.y += e.vy; collideY(e, false);
      e.face = tp.x + tp.w / 2 < e.x + e.w / 2 ? -1 : 1;
      if (Math.abs(tp.x - e.x) < 460 && e.x > cam.x - 40 && e.x < cam.x + W + 40 && --e.cd <= 0) {
        e.cd = Math.round(130 / diff().spd); e.shootT = 12;
        thorns.push({ x: e.x + e.w / 2 - 6 + e.face * 10, y: e.y + 10, w: 12, h: 6,
                      vx: 3.2 * e.face * Math.min(1.25, diff().spd), life: 200 });
        beep(900, 500, 0.08, 'triangle', 0.04);
      }
      if (e.shootT > 0) e.shootT--;
    } else {
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
    }
    if (e.y > ROWS * TILE + 64) { e.dead = 999; continue; }

    for (const p of alivePlayers()) {
      if (e.dead || !overlap(p, e)) continue;
      if (p.star > 0) { // star power: chhoote hi dushman gaya
        killEnemy(e, true);
        if (++starKills >= 5) unlock('starpower');
        continue;
      }
      const tough = (CHARS[p.ch] || CHARS.fox).tough; // Bholu panda kaante walon pe bhi kood sakta hai
      const stompable = e.type === 'slime' || e.type === 'bat' || e.type === 'fish' || tough;
      if (stompable && p.vy > 0 && p.prevBottom <= e.y + 10) {
        killEnemy(e, false);
        p.vy = p.wet ? -3 : down(...ctrlFor(p).jump) ? -12 : -8; p.jumping = !p.wet; p.sx = 0.8; p.sy = 1.25;
        p.canDouble = p.leaf;
      } else hurtPlayer(p);
    }
  }
  // zameen pe chalne wale dushman ek doosre se takra ke mudte hain
  const liveE = enemies.filter(e => e.active && !e.dead && (e.type === 'slime' || e.type === 'hedge'));
  for (let i = 0; i < liveE.length; i++) for (let j = i + 1; j < liveE.length; j++) {
    const a = liveE[i], b = liveE[j];
    if (overlap(a, b)) {
      if (a.x < b.x) { a.vx = -a.speed; b.vx = b.speed; } else { a.vx = a.speed; b.vx = -b.speed; }
    }
  }
  enemies = enemies.filter(e => !(e.dead > 40 && !e.flip) && !(e.dead && e.y > ROWS * TILE + 64));
}

// chalti aur girti platforms
function updatePlats() {
  for (const pl of plats) {
    const x0 = pl.x, y0 = pl.y;
    if (pl.type === 'h' || pl.type === 'v') {
      pl.t += pl.speed * diff().spd;
      const o = Math.sin(pl.t) * pl.range;
      if (pl.type === 'h') pl.x = pl.ox + o; else pl.y = pl.oy + o;
    } else if (pl.gone) {
      if (--pl.respawn <= 0) Object.assign(pl, { x: pl.ox, y: pl.oy, gone: false, falling: false, shakeT: 0, vy: 0 });
    } else if (pl.falling) {
      pl.vy = Math.min(pl.vy + 0.35, 10); pl.y += pl.vy;
      if (pl.y > H + 40) { pl.gone = true; pl.respawn = 200; }
    } else if (pl.shakeT > 0 && ++pl.shakeT > 32) { pl.falling = true; pl.vy = 0; beep(220, 90, 0.2, 'triangle', 0.05); }
    pl.dx = pl.x - x0; pl.dy = pl.y - y0;
  }
}

// aag ke chakkar aur girte patthar / barf ke kaante
function updateHazards() {
  for (const hz of hazards) {
    if (hz.type === 'bar') {
      hz.a += hz.spd;
      for (const p of alivePlayers()) {
        if (p.star > 0) continue;
        for (let i = 1; i <= hz.n; i++) {
          const bx = hz.cx + Math.cos(hz.a) * i * 15, by = hz.cy + Math.sin(hz.a) * i * 15;
          const nx = Math.max(p.x + 3, Math.min(bx, p.x + p.w - 3)), ny = Math.max(p.y + 3, Math.min(by, p.y + p.h - 2));
          if ((bx - nx) ** 2 + (by - ny) ** 2 < 36) { hurtPlayer(p); break; }
        }
      }
    } else if (hz.type === 'rock') {
      if (hz.st === 'hang') {
        if (alivePlayers().some(p => Math.abs(p.x + p.w / 2 - (hz.x + hz.w / 2)) < 64 && p.y > hz.y)) { hz.st = 'shake'; hz.t = 0; beep(180, 120, 0.15, 'triangle', 0.05); }
      } else if (hz.st === 'shake') { if (++hz.t > (hz.ice ? 45 : 24)) hz.st = 'fall'; }
      else {
        hz.vy = Math.min(hz.vy + 0.6, 12); hz.y += hz.vy;
        if (isSolid(Math.floor((hz.x + hz.w / 2) / TILE), Math.floor((hz.y + hz.h) / TILE)) || hz.y > H + 40) { shatter(hz); continue; }
      }
      for (const p of alivePlayers()) {
        if (hz.dead || !overlap(p, { x: hz.x + 4, y: hz.y, w: hz.w - 8, h: hz.h - 6 })) continue;
        if (p.star > 0) shatter(hz);
        else { hurtPlayer(p); if (hz.st === 'fall') shatter(hz); }
      }
    }
  }
  hazards = hazards.filter(h => !h.dead);
}
function shatter(hz) {
  hz.dead = true;
  for (let i = 0; i < 9; i++) particles.push({ x: hz.x + hz.w / 2, y: hz.y + hz.h - 4, vx: (Math.random() - 0.5) * 5,
    vy: -Math.random() * 4, life: 26, color: hz.ice ? '#e1f5fe' : '#8d8399' });
  beep(hz.ice ? 1400 : 300, hz.ice ? 600 : 80, 0.12, hz.ice ? 'triangle' : 'square', 0.05);
}

// cactus ke kaante
function updateThorns() {
  for (const tn of thorns) {
    tn.x += tn.vx; tn.life--;
    if (tn.life <= 0 || isSolid(Math.floor((tn.x + (tn.vx > 0 ? tn.w : 0)) / TILE), Math.floor((tn.y + 3) / TILE))) { tn.dead = true; continue; }
    for (const p of alivePlayers()) if (!tn.dead && overlap(p, tn)) { tn.dead = true; if (p.star <= 0) hurtPlayer(p); }
  }
  thorns = thorns.filter(tn => !tn.dead);
}

function bubbles(x, y, n) {
  for (let i = 0; i < n; i++) particles.push({ x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 0.3,
    vy: -0.6 - Math.random() * 0.5, g: -0.004, r: 1.5 + Math.random() * 1.8, life: 90, color: 'rgba(225,245,255,0.75)', bubble: true });
}
function splash(p) {
  for (let i = 0; i < 12; i++) particles.push({ x: p.x + p.w / 2 + (Math.random() - 0.5) * 16, y: p.y + p.h / 2,
    vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3, life: 26, color: 'rgba(200,235,255,0.95)' });
  beep(500, 150, 0.18, 'sine', 0.06);
}

function updateParticles() {
  for (const pt of particles) {
    pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.g !== undefined ? pt.g : 0.2; if (pt.grow) pt.r += pt.grow; pt.life--;
    if (pt.bubble && !inWater(pt.x, pt.y)) pt.life = 0; // bulbula paani se bahar = phoot gaya
  }
  particles = particles.filter(pt => pt.life > 0);
}

// ---------- Time trial ki parchhai (ghost): tumhara sabse tez run ----------
let ghostRec = [], ghostPlay = null, trialNew = false;
function ghostStart(i) {
  ghostRec = []; ghostPlay = null;
  if (gameMode !== 'trial') return;
  try { ghostPlay = JSON.parse(localStorage.getItem('tikkuRunGhost' + i) || 'null'); } catch (e) {}
}
function ghostRecord() {
  if (runT % 2 || ghostRec.length > 20000) return;
  const p = player;
  ghostRec.push(Math.round(p.x), Math.round(p.y), (p.facing > 0 ? 1 : 0) | (p.onGround ? 0 : 2) | (Math.abs(p.vx) > 0.3 ? 4 : 0));
}
function ghostSave(i) { try { localStorage.setItem('tikkuRunGhost' + i, JSON.stringify(ghostRec)); } catch (e) {} }
const fmtTime = f => { const s = f / 60, m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`; };

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
  for (let i = 0; i < (th.cave || th.water || th.temple ? 0 : th.sky ? 12 : 7); i++) {
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
  if (th.city) return;
  if (th.desert) { if (kind < 2) { ctx.fillStyle = '#d9a75a'; ctx.beginPath(); ctx.ellipse(ox, y + 1, 4, 2.5, 0, Math.PI, 0); ctx.fill(); } return; }
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
  const x0 = Math.floor(cam.x / TILE), x1 = x0 + Math.ceil(W / viewScale / TILE) + 1;
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
      if (th.city && GROUNDISH.has(tileAt(tx, ty - 1))) { // imarat ki khidkiyan
        ctx.fillStyle = (hsh >> 3) % 3 ? 'rgba(255,224,130,0.8)' : 'rgba(30,30,50,0.85)'; ctx.fillRect(x + 6, y + 9, 7, 10);
        ctx.fillStyle = (hsh >> 5) % 3 ? 'rgba(255,224,130,0.8)' : 'rgba(30,30,50,0.85)'; ctx.fillRect(x + 19, y + 9, 7, 10);
      }
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
      drawStone(x, y, hsh);
      const openTop = tileAt(tx, ty - 1) === '.';
      if (openTop && th.snow) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 2, TILE, 5);
        ctx.beginPath(); ctx.ellipse(x + 8 + (hsh % 14), y + 3, 5, 3, 0, 0, Math.PI); ctx.fill();
      } else if (openTop && !th.cave && !th.embers) { // kaai (moss)
        ctx.fillStyle = '#6aa84f'; ctx.fillRect(x, y, TILE, 3);
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + ((hsh >> (i * 3)) % 24), y + 3, 3, 2 + ((hsh >> i) % 5));
      }
    } else if (CRATES[t] || t === 'X') {
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
        else if (t === 'T') drawStar(x + 16, y + 16, 9, '#ffeb3b');
        else if (t === 'M') drawMagnet(x + 16, y + 18, 6);
        else if (t === 'W') drawWing(x + 9, y + 18, 10, -0.5);
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
    else if (th.desert) {
      if (kind === 0) { // door piramid
        ctx.fillStyle = '#d8a35a'; ctx.beginPath(); ctx.moveTo(x - size * 0.8, base); ctx.lineTo(x, base - size * 0.9); ctx.lineTo(x + size * 0.8, base); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.moveTo(x, base - size * 0.9); ctx.lineTo(x + size * 0.8, base); ctx.lineTo(x + size * 0.15, base); ctx.fill();
      } else { // cactus
        const ch = size * 0.7; ctx.fillStyle = '#6f9e4a';
        rr(x - 6, base - ch, 12, ch, 6); ctx.fill(); rr(x - 18, base - ch * 0.7, 8, ch * 0.35, 4); ctx.fill(); rr(x - 18, base - ch * 0.45, 14, 7, 3); ctx.fill();
        rr(x + 10, base - ch * 0.8, 8, ch * 0.35, 4); ctx.fill(); rr(x + 4, base - ch * 0.52, 14, 7, 3); ctx.fill();
      }
    }
    else if (th.temple) { // purane toote khambhe
      const ph = size + 40;
      ctx.fillStyle = '#4b5a42'; ctx.fillRect(x - 12, base - ph, 24, ph); ctx.fillRect(x - 18, base - ph - 8, 36, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 4, base - ph, 8, ph);
      if (kind === 0) { ctx.fillStyle = '#3f7d3a'; ctx.beginPath(); ctx.arc(x - 10, base - ph + 6, 11, 0, Math.PI * 2); ctx.fill(); }
    }
    else if (th.city) { // imaratein aur roshan khidkiyan
      const bw = 50 + (h >> 4) % 40, bh = size * 2 + 40;
      ctx.fillStyle = '#262a4f'; ctx.fillRect(x - bw / 2, base - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,224,130,0.5)';
      for (let r = 0; r * 16 + 22 < bh; r++) for (let c = 0; c * 13 + 15 < bw; c++)
        if (hash2(k * 31 + c, r) % 3 === 0) ctx.fillRect(x - bw / 2 + 7 + c * 13, base - bh + 10 + r * 16, 6, 8);
    }
    else if (th.water) { // samundar ke andar lehrati ghaas (kelp)
      const hgt = size + 30;
      ctx.strokeStyle = kind === 0 ? '#2e7d5b' : '#3f8f6a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, base);
      for (let sg = 1; sg <= 6; sg++) ctx.lineTo(x + Math.sin(frame * 0.03 + sg * 0.9 + k) * 2 * sg, base - hgt * sg / 6);
      ctx.stroke(); ctx.lineCap = 'butt';
    }
    else if (th.sky && kind === 0) { // door tairte chhote tapu
      const iy = 200 + ((h >> 11) % 120), w = 30 + ((h >> 13) % 30);
      ctx.fillStyle = '#9ccf9f'; ctx.beginPath(); ctx.ellipse(x, iy, w, 7, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#b7a58f'; ctx.beginPath(); ctx.moveTo(x - w, iy); ctx.lineTo(x, iy + w * 0.7); ctx.lineTo(x + w, iy); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  if (th.temple) { // upar se latakti bele
    ctx.strokeStyle = '#2e6b35'; ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const vx = ((i * 137 - cx * 0.6) % 1100 + 1100) % 1100 - 70, len = 60 + (i * 53) % 130;
      ctx.beginPath(); ctx.moveTo(vx, 0);
      for (let sg = 1; sg <= 5; sg++) ctx.lineTo(vx + Math.sin(frame * 0.02 + i + sg) * 4, len * sg / 5);
      ctx.stroke();
      ctx.fillStyle = '#3f8f45'; ctx.beginPath(); ctx.ellipse(vx + 4, len, 5, 3, 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (th.stars && !th.city) { // jugnu
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
    const K = it.kind || 'leaf', cx = it.x + 12, cy = it.y + 12 + bob;
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = K === 'star' ? `hsl(${(frame * 6) % 360},100%,70%)` : POWER_COL[K];
    ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (K === 'fire') drawFlame(cx, cy + 2, 9);
    else if (K === 'star') drawStar(cx, cy, 12, '#ffeb3b', Math.sin(frame * 0.1) * 0.3);
    else if (K === 'magnet') drawMagnet(cx, cy + 3, 8);
    else if (K === 'wing') drawWing(cx - 9, cy + 3, 13, -0.5 + Math.sin(frame * 0.2) * 0.2);
    else drawLeafShape(cx, cy, 12, Math.sin(it.phase) * 0.3);
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
    if (!e.dead && e.type !== 'bat' && e.type !== 'fish') drawShadow(cx, by, 13);
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
    } else if (e.type === 'bat') {
      if (e.dead && !e.flip) ctx.scale(1.3, 0.4);
      const fl = Math.sin(e.anim * 2.2) * 7;
      ctx.translate(0, -9);
      ctx.fillStyle = '#4527a0';
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sd * 4, -2); ctx.lineTo(sd * 19, -7 - fl); ctx.lineTo(sd * 16, 1 - fl * 0.3);
        ctx.lineTo(sd * 11, -1); ctx.lineTo(sd * 7, 5); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#5e35b1'; ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(-5, -13); ctx.lineTo(-1, -6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7, -4); ctx.lineTo(5, -13); ctx.lineTo(1, -6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -1, 2.7, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(3.5, -1, 2.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d50000'; ctx.beginPath(); ctx.arc(-3 + face, -1, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(3.5 + face, -1, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(-2, 7); ctx.lineTo(-1, 4); ctx.moveTo(1, 4); ctx.lineTo(2, 7); ctx.lineTo(3, 4); ctx.fill();
    } else if (e.type === 'fish') {
      if (e.dead && !e.flip) ctx.scale(1.3, 0.5);
      ctx.translate(0, -9); ctx.scale(face, 1);
      const tw = Math.sin(e.anim * 1.5) * 3;
      ctx.fillStyle = '#ff7043';
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-18, -7 + tw); ctx.lineTo(-18, 7 + tw); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(2, -14); ctx.lineTo(6, -7); ctx.fill();
      ctx.fillStyle = '#ff8a65'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffccbc'; ctx.beginPath(); ctx.ellipse(1, 3.5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e64a19'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(-3, 6); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, -2, 3.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(7, -2, 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(3, -6.5); ctx.lineTo(9, -4.5); ctx.stroke();
    } else if (e.type === 'cactus') {
      if (e.dead && !e.flip) ctx.scale(1.3, 0.4);
      ctx.scale(e.face || 1, 1);
      if (e.shootT > 0) ctx.scale(1 + e.shootT * 0.012, 1 - e.shootT * 0.01);
      ctx.fillStyle = '#7cb342';
      rr(-8, -30, 16, 30, 7); ctx.fill();
      rr(-16, -21, 6, 13, 3); ctx.fill(); rr(-14, -13, 8, 5, 2); ctx.fill();
      rr(10, -25, 6, 13, 3); ctx.fill(); rr(6, -17, 8, 5, 2); ctx.fill();
      ctx.strokeStyle = '#558b2f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-3, -27); ctx.lineTo(-3, -2); ctx.moveTo(3, -27); ctx.lineTo(3, -2); ctx.stroke();
      ctx.fillStyle = '#f1f8e9';
      for (const [sx, sy] of [[-9, -24], [9, -10], [-9, -6], [9, -26], [-17, -17], [17, -21]]) ctx.fillRect(sx, sy, 2, 1);
      ctx.fillStyle = '#f06292'; ctx.beginPath(); ctx.arc(0, -31, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(0, -31, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(1, -19, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(5.5, -19, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(1, -14, 5, 1.5);
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

// Kirdaar: Tikku (fox), Bunty (khargosh), Bholu (panda), Chiku (ullu) - sab ka scarf, sab ki chaal
const CHAR_LOOK = {
  fox:   { body: '#f28c28', belly: '#fff3e0', leg: '#7b3f12' },
  bunny: { body: '#e9edf0', belly: '#ffffff', leg: '#b0bec5' },
  panda: { body: '#f7f7f7', belly: '#ffffff', leg: '#212121' },
  owl:   { body: '#8d6e63', belly: '#d7ccc8', leg: '#ff9800' },
};
function drawHero(cx, by, facing, anim, opts = {}) {
  const t = frame, kind = CHAR_LOOK[opts.kind] ? opts.kind : 'fox', P = CHAR_LOOK[kind];
  const running = opts.running, air = opts.air;
  ctx.save(); ctx.translate(cx, by); ctx.scale(facing * (opts.sx || 1), opts.sy || 1);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.ghost) ctx.globalAlpha *= 0.4;
  if (opts.star) { // star power: satrangi chamak
    ctx.fillStyle = `hsla(${(t * 8) % 360},100%,60%,0.45)`;
    ctx.beginPath(); ctx.arc(0, -18, 24, 0, Math.PI * 2); ctx.fill();
  }
  // legs
  const s = running ? Math.sin(anim) * 4 : 0;
  ctx.fillStyle = P.leg;
  if (air) { ctx.fillRect(-7, -6, 5, 5); ctx.fillRect(3, -7, 5, 5); }
  else { ctx.fillRect(-7 + s, -5, 5, 5); ctx.fillRect(3 - s, -5, 5, 5); }
  // daudte waqt shareer upar-neeche, khade ho to halki saans
  ctx.translate(0, running ? -Math.abs(Math.sin(anim)) * 2 : Math.sin(t * 0.06) * 0.6);
  if (opts.wing) { // pankh (glide karte waqt tez phadphadate hain)
    const fl = opts.glide ? Math.sin(t * 0.6) * 0.5 : Math.sin(t * 0.08) * 0.15;
    drawWing(-4, -19, 12, -2.3 - fl);
  }
  // tail
  if (kind === 'fox') {
    const wag = running ? Math.sin(t * 0.4) * 0.35 : Math.sin(t * 0.15) * 0.25;
    ctx.save(); ctx.translate(-9, -11); ctx.rotate(-0.6 + wag + (air ? -0.4 : 0) + (opts.vy || 0) * 0.02);
    ctx.fillStyle = '#ef7d1a'; ctx.beginPath(); ctx.ellipse(-8, 0, 10, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8ee'; ctx.beginPath(); ctx.ellipse(-15, 0, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (kind === 'bunny') {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-10, -11, 4.5, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'panda') {
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(-10, -10, 3, 0, Math.PI * 2); ctx.fill();
  } else { // ullu ki poonch ke pankh
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-16, -4); ctx.lineTo(-14, -9); ctx.lineTo(-17, -10); ctx.lineTo(-8, -13); ctx.fill();
  }
  // body
  ctx.fillStyle = P.body; ctx.beginPath(); ctx.ellipse(0, -12, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = P.belly; ctx.beginPath(); ctx.ellipse(3, -10, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (kind === 'panda') { ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(1, -13, 4, 6, 0.3, 0, Math.PI * 2); ctx.fill(); }
  if (kind === 'owl') { // ullu ke apne pankh
    const fl = opts.glide ? Math.sin(t * 0.6) * 0.6 : Math.sin(t * 0.05) * 0.08;
    ctx.save(); ctx.translate(-2, -16); ctx.rotate(0.5 - fl - (opts.glide ? 0.6 : 0));
    ctx.fillStyle = '#6d4c41'; ctx.beginPath(); ctx.ellipse(0, 6, 5, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.ellipse(0, 10, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // fire karte waqt aage badha hua paw
  if (opts.shoot) {
    ctx.fillStyle = kind === 'panda' ? '#212121' : P.body; ctx.beginPath(); ctx.ellipse(11, -12, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.leg; ctx.beginPath(); ctx.arc(15, -12, 2, 0, Math.PI * 2); ctx.fill();
  }
  // scarf
  const fl = running || air ? 4 : 2.5, fs = running ? 0.45 : 0.3;
  ctx.fillStyle = opts.fire ? '#ff5722' : (opts.scarf || '#2e9d5b');
  ctx.fillRect(-6, -19, 15, 4);
  ctx.beginPath(); ctx.moveTo(-5, -18);
  ctx.lineTo(-15, -20 + Math.sin(t * fs) * fl); ctx.lineTo(-14, -15 + Math.sin(t * fs + 1) * fl); ctx.lineTo(-4, -15); ctx.fill();
  const ew = Math.sin(t * 0.25) * (running || air ? 1.5 : 0.5);
  let eye = [6.5, -27];
  if (kind === 'fox') {
    ctx.fillStyle = P.body; ctx.beginPath(); ctx.arc(4, -25, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, -29); ctx.lineTo(0 + ew, -38); ctx.lineTo(4, -31); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -31); ctx.lineTo(9 + ew, -38); ctx.lineTo(11, -28); ctx.fill();
    ctx.fillStyle = '#5a2a0a';
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0.6 + ew * 0.6, -35); ctx.lineTo(3, -31); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6.5, -31); ctx.lineTo(8.6 + ew * 0.6, -35); ctx.lineTo(9.6, -29.5); ctx.fill();
    ctx.fillStyle = '#fff8ee'; ctx.beginPath(); ctx.ellipse(9.5, -22.5, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,110,110,0.35)'; ctx.beginPath(); ctx.arc(5, -21.5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(14, -23.5, 1.8, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'bunny') {
    for (const [ex, rot] of [[1.5, -0.2], [6.5, 0.15]]) { // lambe kaan
      ctx.save(); ctx.translate(ex, -33); ctx.rotate(rot + ew * 0.04);
      ctx.fillStyle = P.body; ctx.beginPath(); ctx.ellipse(0, -5, 2.8, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f8bbd0'; ctx.beginPath(); ctx.ellipse(0, -5, 1.3, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = P.body; ctx.beginPath(); ctx.arc(4, -24, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(9.5, -21.5, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.arc(13, -22.5, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,110,140,0.35)'; ctx.beginPath(); ctx.arc(5, -20.5, 2, 0, Math.PI * 2); ctx.fill();
    eye = [7, -25.5];
  } else if (kind === 'panda') {
    ctx.fillStyle = '#212121';
    ctx.beginPath(); ctx.arc(-1, -32, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -33, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.body; ctx.beginPath(); ctx.arc(4, -25, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(7.5, -26, 3.2, 4, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(10.5, -22.5, 4.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(13.5, -23.3, 1.7, 0, Math.PI * 2); ctx.fill();
    eye = [7.8, -26.4];
  } else { // ullu
    ctx.fillStyle = P.body;
    ctx.beginPath(); ctx.moveTo(-3, -29); ctx.lineTo(-3 + ew * 0.5, -38); ctx.lineTo(3, -31); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7, -32); ctx.lineTo(11 + ew * 0.5, -39); ctx.lineTo(12, -29); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -25, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.belly; ctx.beginPath(); ctx.ellipse(8, -25, 5.5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9800'; ctx.beginPath(); ctx.moveTo(11, -23); ctx.lineTo(15.5, -21); ctx.lineTo(11, -19); ctx.fill();
    eye = [8.3, -26.5];
  }
  // aankh
  const blink = (t % 200) < 6;
  if (kind === 'owl' || kind === 'panda') { // badi safed aankh
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(eye[0], eye[1], kind === 'owl' ? 3.6 : 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#222';
  if (opts.dead) { ctx.fillRect(eye[0] - 2.5, eye[1] - 1, 4, 1.5); }
  else if (blink) ctx.fillRect(eye[0] - 2, eye[1], 3.5, 1.4);
  else { ctx.beginPath(); ctx.arc(eye[0], eye[1], kind === 'owl' ? 1.9 : 1.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(eye[0] + 0.1, eye[1] - 1.2, 1, 1); }
  // leaf power on head
  if (opts.leaf) drawLeafShape(1, -37, 6, -0.3 + Math.sin(t * 0.1) * 0.2);
  ctx.restore();
}

function playerOpts(p) {
  return {
    kind: p.ch, running: Math.abs(p.vx) > 0.3 && (p.onGround || p.wet), air: !p.onGround && !p.wet, leaf: p.leaf, fire: p.fire,
    wing: p.wing, glide: p.gliding, star: p.star > 0 && (p.star > 90 || frame % 10 < 6),
    scarf: p.idx ? '#1e88e5' : scarfCol(), sx: p.sx, sy: p.sy, shoot: p.shootT > 0, vy: p.vy,
    dead: p.dying, rot: p.dying ? Math.PI * Math.min(1, (gameMode === 'duo' && state === 'playing' ? p.deathT : stateTimer) / 25) : 0 };
}
function drawPlayer() {
  // time trial: pichhle best run ki parchhai
  if (ghostPlay && gameMode === 'trial') {
    const k = Math.min(Math.floor(runT / 2), ghostPlay.length / 3 - 1) * 3;
    if (k >= 0) {
      const f = ghostPlay[k + 2];
      drawHero(ghostPlay[k] + 11, ghostPlay[k + 1] + 28, f & 1 ? 1 : -1, runT * 0.25, { kind: save.char, ghost: true, air: !!(f & 2), running: !!(f & 4), scarf: '#ffffff' });
    }
  }
  for (const p of players) {
    if (!p.dying) {
      const gy = groundBelow(p, 8);
      if (gy !== null) drawShadow(p.x + p.w / 2, gy, Math.max(4, 11 - (gy - p.y - p.h) * 0.04));
    }
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) continue;
    drawHero(p.x + p.w / 2, p.y + p.h, p.facing, p.anim, playerOpts(p));
    if (gameMode === 'duo' && !p.dying) text(p.idx ? 'P2' : 'P1', p.x + p.w / 2, p.y - 22, 12, p.idx ? '#90caf9' : '#ffe082');
  }
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
  drawHero(30, 38, 1, 0, { kind: save.char, scarf: scarfCol() });
  if (gameMode !== 'trial' && gameMode !== 'endless') text('x ' + lives, 50, 24, 20, '#fff', 'left');
  drawGemShape(132, 24, 10);
  text('x ' + String(gemCount).padStart(2, '0'), 147, 24, 20, '#fff', 'left');
  let ix = 204;
  const icon = fn => { fn(ix); ix += 21; };
  if (player) {
    const blinkOk = v => v > 90 || frame % 10 < 6;
    if (player.fire) icon(x => drawFlame(x, 26, 8));
    if (player.leaf) icon(x => drawLeafShape(x, 24, 8, 0.3));
    if (player.wing) icon(x => drawWing(x - 6, 27, 10, -0.6));
    if (player.star > 0 && blinkOk(player.star)) icon(x => drawStar(x, 24, 9, '#ffeb3b'));
    if (player.magnet > 0 && blinkOk(player.magnet)) icon(x => drawMagnet(x, 26, 6));
  }
  text('SCORE ' + String(score).padStart(6, '0'), 385, 24, 20);
  if (gameMode === 'adv' || gameMode === 'duo') text('HI ' + String(Math.max(highScore, score)).padStart(6, '0'), 510, 24, 16, '#ffe082');
  if (gameMode === 'endless') {
    text(`${Math.floor(player.x / TILE)} m`, 640, 24, 22, '#b3e5fc');
    text(`BEST ${save.best.endless} m`, 820, 24, 15, '#ffe082');
  } else if (gameMode === 'trial' || gameMode === 'rush') {
    text(gameMode === 'trial' ? 'WORLD ' + (levelIndex + 1) : `BOSS RUSH ${rushIdx + 1}/${RUSH.length}`, 620, 24, 16);
    text(fmtTime(runT), 830, 24, 22, '#ffffff');
    const best = gameMode === 'trial' ? save.times[levelIndex] : 0;
    if (best) text('BEST ' + fmtTime(best), 830, 54, 13, '#ffe082');
  } else {
    const label = gameMode === 'daily' ? t('dailyName') : gameMode === 'custom' ? t('myLevel') : 'WORLD ' + (levelIndex + 1) + '  ' + level.name;
    text(label, 690, 24, 16);
    const tl = Math.ceil(timeLeft / 60), tc = tl < 60 ? '#ff8a80' : '#fff';
    ctx.strokeStyle = tc; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(858, 24, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(858, 24); ctx.lineTo(858, 19); ctx.moveTo(858, 24); ctx.lineTo(862, 26); ctx.stroke();
    text(String(tl), 874, 24, 20, tc, 'left');
  }
  if (muted) text(t('muted'), W - 60, 72, 14, '#ffcc80');
  else if (!musicOn) text(t('musicOff'), W - 70, 72, 14, '#ffcc80');
  if (boss && bossStarted && !boss.gone) {
    const bw = 320, bx = W / 2 - bw / 2, by = 58, frost = boss.kind === 'frosto';
    text(t(bossKey('Name')), W / 2, by, 16, frost ? '#b3e5fc' : '#ffab91');
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(bx - 3, by + 11, bw + 6, 16, 8); ctx.fill();
    const fw = bw * Math.max(0, boss.hp) / boss.maxHp;
    if (fw > 0) {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, frost ? '#4fc3f7' : '#ff9800'); g.addColorStop(1, frost ? '#1565c0' : '#ff3d00');
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
function t(key, ...args) {
  let v = STR[lang][key];
  if (v === undefined) v = STR.en[key];
  if (v === undefined) return key;
  return typeof v === 'function' ? v(...args) : v;
}

// ---------- BOSSES: Magmo (lava ka gussail gola) aur Frosto (barf ka golem) ----------
let boss = null, bossStarted = false, bossIntro = 0, waves = [], shake = 0;
const ARENA_LEFT = 20; // is tile pe gate band hota hai
const bossKey = k => (boss && boss.kind === 'frosto' ? 'frost' : 'boss') + k;

function makeBoss(kind = 'magmo') {
  const hp = kind === 'frosto' ? Math.max(4, diff().boss - 1) : diff().boss;
  return { kind, x: 40 * TILE, y: 15 * TILE - 76, w: 90, h: 76, vx: 0, vy: 0, hp, maxHp: hp,
           mode: 'wait', timer: 0, invuln: 0, jumps: 0, squash: 0, dead: 0, gone: false,
           face: -1, noPlat: true, prevBottom: 0, onGround: true, fireHits: 0, flash: 0 };
}

function updateBoss() {
  const b = boss;
  if (!b || b.gone) { if (b) b.dead++; updateWaves(); return; }
  const p = nearestPlayer(b.x + b.w / 2);

  if (!bossStarted) {
    if (players.some(q => !q.dying && q.x > (ARENA_LEFT + 3) * TILE)) {
      bossStarted = true; bossIntro = 140; shake = 10; buzz(120);
      // 2 player: peeche reh gaya dost bhi arena mein aa jaaye
      for (const q of alivePlayers()) if (q.x < (ARENA_LEFT + 1) * TILE) { q.x = (ARENA_LEFT + 2) * TILE; q.y = 14 * TILE - 4; q.vy = 0; }
      for (let ty = 11; ty <= 14; ty++) level.grid[ty][ARENA_LEFT] = 'B'; // gate band
      SFX.bump(); beep(80, 40, 0.6, 'sawtooth', 0.1);
    }
    return;
  }
  if (bossIntro > 0) bossIntro--;
  const frost = b.kind === 'frosto';

  if (b.dead) {
    b.dead++;
    if (b.dead % 4 === 0) particles.push({ x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h,
      vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 6, life: 40,
      color: (frost ? ['#e3f2fd', '#90caf9', '#ffffff'] : ['#ff5722', '#ffd54f', '#5d4037'])[b.dead % 3] });
    if (b.dead === 100) {
      b.gone = true; shake = 14;
      portal = { x: 34 * TILE, y: 13 * TILE, w: 32, h: 64 };
      SFX.clear(); unlock(b.kind);
    }
    return;
  }

  if (b.invuln > 0) b.invuln--;
  if (b.squash > 0) b.squash--;
  if (frost) {
    if (frame % 7 === 0) particles.push({ x: b.x + 10 + Math.random() * (b.w - 20), y: b.y + 10 + Math.random() * 30,
      vx: (Math.random() - 0.5) * 0.6, vy: -0.3, g: 0.03, r: 2, life: 40, color: 'rgba(255,255,255,0.9)' });
  } else if (frame % 6 === 0) particles.push({ x: b.x + 12 + Math.random() * (b.w - 24), y: b.y + 25 + Math.random() * 35,
    vx: 0, vy: 0.4, g: 0.22, r: 2.4, life: 32, color: Math.random() < 0.5 ? '#ff7043' : '#ffb300' });
  const anger = b.maxHp - b.hp; // jitna maar khaayega utna tez hoga

  b.vy = Math.min(b.vy + GRAV * 0.9, MAX_FALL);
  if (b.mode === 'wait') {
    b.vx *= 0.8; if (Math.abs(b.vx) < 0.1) b.vx = 0;
    b.timer++;
    b.face = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1;
    if (frost && b.hp <= 3 && b.timer === 25) dropIcicles(anger);
    if (bossIntro === 0 && b.timer > (frost ? 80 : 75) - anger * 10) {
      b.timer = 0; b.jumps++;
      const big = b.jumps % 3 === 0;
      if (frost && !big) { // Frosto fisal ke seedha aata hai
        b.mode = 'slide'; b.vx = b.face * (4 + anger * 0.45) * Math.min(1.2, diff().spd);
        beep(500, 150, 0.3, 'sawtooth', 0.05);
      } else {
        b.mode = 'jump';
        b.vy = big ? -15 : -10;
        const dx = (p.x + p.w / 2) - (b.x + b.w / 2);
        b.vx = Math.max(-6, Math.min(6, dx / (big ? 52 : 36)));
      }
    }
  } else if (b.mode === 'slide') {
    b.timer++;
    if (frame % 2 === 0) particles.push({ x: b.x + (b.vx > 0 ? 0 : b.w), y: b.y + b.h - 4, vx: -b.vx * 0.3,
      vy: -Math.random() * 2, life: 22, color: '#e3f2fd' });
  }
  b.x += b.vx; collideX(b);
  b.prevBottom = b.y + b.h; b.y += b.vy; collideY(b, false);

  if (b.mode === 'slide' && (b.hitWall || b.timer > 150)) {
    b.mode = 'wait'; b.timer = 0; b.squash = 10; b.vx = 0;
    if (b.hitWall) { shake = 9; beep(120, 50, 0.3, 'square', 0.08); }
  }
  if (b.mode === 'jump' && b.onGround && b.vy === 0) {
    b.mode = 'wait'; b.timer = 0; b.squash = 14; shake = 12;
    beep(90, 40, 0.3, 'sawtooth', 0.1);
    for (let i = 0; i < 14; i++) particles.push({ x: b.x + Math.random() * b.w, y: b.y + b.h,
      vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 4, life: 30, color: frost ? '#e3f2fd' : '#8d6e63' });
    if (frost) { if (b.hp <= 4) dropIcicles(anger); }
    else {
      // 3 HP ya kam: zameen pe aag ki lehrein
      if (b.hp <= 3) { waves.push({ x: b.x - 20, dir: -1 }); waves.push({ x: b.x + b.w - 4, dir: 1 }); }
      // 4 HP ya kam: chhote slime bhejta hai
      if (b.hp <= 4 && b.jumps % 2 === 0 && enemies.filter(e => !e.dead).length < 3) {
        enemies.push({ type: 'slime', x: b.x + b.w / 2 - 14, y: b.y - 24, w: 28, h: 22, vx: b.face * 1.2, speed: 1.2,
                       vy: -6, active: true, dead: 0, anim: 0 });
      }
    }
  }

  // Tikku vs boss: sar pe kood ke maaro
  for (const q of alivePlayers()) {
    if (b.dead || !overlap(q, b)) continue;
    const fromAbove = q.vy > 0 && q.prevBottom <= b.y + 22;
    if (fromAbove) {
      q.vy = -12; q.jumping = true; q.canDouble = q.leaf;
      if (b.invuln === 0) damageBoss();
    } else if (q.star > 0) { if (b.invuln === 0) damageBoss(); }
    else hurtPlayer(q);
  }
  updateWaves();
}

// Frosto upar se barf ke kaante giraata hai (neeche parchhai dikhti hai - hat jaao!)
function dropIcicles(anger) {
  const n = 2 + Math.min(2, Math.floor(anger / 2));
  for (let i = 0; i < n; i++) {
    const tp = alivePlayers()[i % Math.max(1, alivePlayers().length)] || player;
    const x = Math.max((ARENA_LEFT + 1) * TILE, Math.min(level.w * TILE - 40, tp.x + (i - (n - 1) / 2) * 110 + (Math.random() - 0.5) * 30));
    hazards.push({ type: 'rock', ice: true, x, y: 40, w: 22, h: 30, st: 'shake', t: 0, vy: 0 });
  }
  beep(1200, 600, 0.2, 'triangle', 0.05);
}

function updateWaves() {
  for (const w of waves) {
    w.x += w.dir * 4.5; w.age = (w.age || 0) + 1;
    for (const q of alivePlayers()) if (overlap(q, { x: w.x + 2, y: 15 * TILE - 20, w: 20, h: 20 })) hurtPlayer(q);
  }
  waves = waves.filter(w => w.x > (ARENA_LEFT + 1) * TILE - 24 && w.x < level.w * TILE);
}

function damageBoss() {
  const b = boss;
  floatText(b.x + b.w / 2, b.y - 10, '+1000', '#ffd54f', 22);
  b.hp--; b.invuln = 70; b.squash = 14; shake = 8; score += 1000;
  SFX.stomp(); beep(220, 60, 0.35, 'square', 0.08); buzz(60);
  if (b.hp <= 0) {
    b.dead = 1; b.vx = 0; b.mode = 'wait'; score += 5000; waves = [];
    hazards = hazards.filter(h => !h.ice);
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
    if (inWater(f.x + 6, f.y + 6)) { f.dead = true; fizzle(f, '#e1f5fe'); continue; } // paani mein bujh gaya
    if (frame % 3 === 0) particles.push({ x: f.x + 6, y: f.y + 6, vx: -f.vx * 0.1, vy: -0.5, life: 12, color: '#ffca28' });
    if (f.life <= 0 || f.y > ROWS * TILE || f.x < cam.x - 60 || f.x > cam.x + W + 60) { f.dead = true; continue; }
    for (const e of enemies) {
      if (e.active && !e.dead && overlap(f, e)) {
        killEnemy(e, true); f.dead = true; fizzle(f);
        save.stats.fireKills++; if (save.stats.fireKills >= 25) unlock('fire25');
        break;
      }
    }
    // boss pe aag ka kam asar: Magmo ko 4 gole = 1 HP, Frosto (barf) ko sirf 2 gole = 1 HP
    const b = boss;
    if (!f.dead && b && bossStarted && !b.dead && !b.gone && overlap(f, b)) {
      f.dead = true; fizzle(f, '#ffd54f');
      if (b.invuln === 0) {
        b.fireHits = (b.fireHits || 0) + 1; b.flash = 6; beep(300, 200, 0.08, 'triangle', 0.06);
        if (b.fireHits >= (b.kind === 'frosto' ? 2 : 4)) { b.fireHits = 0; damageBoss(); }
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
  const frost = b.kind === 'frosto';
  const cx = b.x + b.w / 2, by = b.y + b.h;
  if (!b.dead && !b.noGlow) {
    const gy = groundBelow(b, 10);
    if (gy !== null) {
      const hg = ctx.createRadialGradient(cx, gy, 5, cx, gy, 80);
      hg.addColorStop(0, frost ? 'rgba(129,212,250,0.45)' : 'rgba(255,112,67,0.45)');
      hg.addColorStop(1, frost ? 'rgba(129,212,250,0)' : 'rgba(255,112,67,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(cx, gy, 80, 16, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  let sx = 1, sy = 1;
  if (b.squash > 0) { const k = Math.sin((b.squash / 14) * Math.PI) * 0.22; sx = 1 + k; sy = 1 - k; }
  else if (b.mode === 'jump') { sx = 0.9; sy = 1.1; }
  else if (b.mode === 'slide') { sx = 1.08; sy = 0.94; }
  else { sy = 1 + Math.sin(frame * 0.12) * 0.03; }
  ctx.save();
  if (b.dead) { const k = Math.min(1, b.dead / 100); sx *= 1 + k * 0.4; sy *= 1 - k * 0.85; ctx.globalAlpha = 1 - k * 0.5; }
  ctx.translate(cx, by); ctx.scale(sx, sy);
  if (b.flash > 0) b.flash--;
  const hurt = (b.invuln > 0 && Math.floor(b.invuln / 4) % 2 === 0) || b.flash > 3;
  if (frost) drawFrostoBody(b, hurt); else drawMagmoBody(b, hurt);
  ctx.restore();
}

function drawMagmoBody(b, hurt) {
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
}

// Frosto: bada sa barf ka gola, sar pe neele crystal, chhote haath
function drawFrostoBody(b, hurt) {
  ctx.fillStyle = hurt ? '#ef9a9a' : '#cfe8fb';
  ctx.beginPath(); ctx.ellipse(-46, -30, 10, 15, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(46, -30, 10, 15, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hurt ? '#ff8a80' : '#eef7ff';
  ctx.beginPath(); ctx.moveTo(-44, 0); ctx.quadraticCurveTo(-52, -80, 0, -78); ctx.quadraticCurveTo(52, -80, 44, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hurt ? '#ef5350' : '#bbdefb';
  ctx.beginPath(); ctx.ellipse(0, -6, 40, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  [[-26, -50, 6], [-30, -30, 4], [28, -24, 5], [20, -58, 3]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  // crystal crown
  [[-24, -66, 16], [0, -78, 24], [24, -66, 16]].forEach(([x, y, hgt]) => {
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.lineTo(x, y - hgt); ctx.lineTo(x + 7, y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b3e5fc';
    ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.lineTo(x, y - hgt); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill();
  });
  // aankhein
  const look = b.face * 4;
  ctx.fillStyle = '#0d47a1';
  ctx.beginPath(); ctx.ellipse(-14 + look, -44, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14 + look, -44, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-15 + look, -48, 2.5, 2.5); ctx.fillRect(13 + look, -48, 2.5, 2.5);
  // gusse wali bhauhein
  ctx.strokeStyle = '#1a237e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-24, -58); ctx.lineTo(-7, -52); ctx.moveTo(24, -58); ctx.lineTo(7, -52); ctx.stroke();
  ctx.lineCap = 'butt';
  // muh + barf ke daant
  ctx.fillStyle = '#1a237e'; ctx.beginPath(); ctx.ellipse(0, -22, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e1f5fe';
  for (let i = -2; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 8, -29); ctx.lineTo(i * 8 + 4, -20); ctx.lineTo(i * 8 + 8, -29); ctx.fill(); }
}

// menu / kahani mein boss dikhane ke liye (asli boss ko chhede bina)
function drawBossAt(kind, x, by, s = 1, face = -1) {
  const ob = boss, ow = waves;
  boss = makeBoss(kind); boss.noGlow = true; boss.face = face; waves = [];
  boss.x = -boss.w / 2; boss.y = -boss.h;
  ctx.save(); ctx.translate(x, by); ctx.scale(s, s);
  drawBoss();
  ctx.restore();
  boss = ob; waves = ow;
}

// ---------- Poori duniya draw karna ----------
let viewScale = 1; // editor mein chhota dikhane ke liye
function renderWorld() {
  if (!level) loadLevel(0);
  const th = level.theme;
  drawBackground(th, cam.x);
  ctx.save();
  const sh = shake ? [(Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake] : [0, 0];
  ctx.translate(-Math.round(cam.x) + sh[0], sh[1]);
  drawTiles(th); drawPlats(); drawFlags(); drawPortal(); drawGems(); drawItems(); drawEnemies(); drawHazards(); drawThorns();
  drawBoss(); drawFireballs();
  if (state !== 'title' && !SUB_SCREENS[state]) drawPlayer();
  drawSecrets(); drawWater();
  drawParticles();
  ctx.restore();
  drawLighting(th);
}

let resultInfo = { title: '', lines: [], won: false };
function readyTitle() {
  return gameMode === 'endless' ? 'ENDLESS RUN' : gameMode === 'daily' ? t('dailyName') : gameMode === 'custom' ? t('myLevel')
    : gameMode === 'rush' ? `BOSS RUSH  ${rushIdx + 1}/${RUSH.length}` : 'WORLD ' + (levelIndex + 1);
}

function renderScene() {
  ui = [];
  if (state === 'map') return drawMap();
  if (state === 'story') return drawStory();
  if (state === 'editor') return drawEditor();
  renderWorld();
  if (SUB_SCREENS[state]) { overlay(0.62); SUB_SCREENS[state](); return; }
  if (state === 'title') {
    overlay(0.3);
    drawButton(t('langBtn'), 14, 10, 300, 36, false, () => { setLang(lang === 'hi' ? 'en' : 'hi'); SFX.tick(); }, 17);
    text(t('high') + ' ' + String(highScore).padStart(6, '0'), W - 20, 28, 20, '#ffe082', 'right');
    drawLogo(GAME_TITLE, W / 2, 92, 80);
    text(t('subtitle'), W / 2, 150, 22, '#ffe9b0');
    ctx.save(); ctx.translate(140, 470); ctx.scale(3, 3);
    drawHero(0, 0, 1, frame * 0.3, { kind: save.char, running: true, leaf: true, scarf: scarfCol() }); ctx.restore();
    drawBossAt('magmo', 840, 470, 1);
    drawMenuGrid(menuItems(), W / 2 - 255, 182, 250, 38, 10, 9, 2, 18);
    text(touchMode ? t('touchCtrl') : t('ctrl1'), W / 2, 526, 14, 'rgba(255,255,255,0.85)');
    return;
  }
  drawHUD();
  if (state === 'ready') {
    overlay(0.35);
    text(readyTitle(), W / 2, 220, 48, '#ffcc4d');
    if (gameMode !== 'endless') text(level.name, W / 2, 275, 30);
    if (curDef.boss) text(t('bossLevel'), W / 2, 170, 28, '#ff7043');
    else if (curDef.water) text(t('waterTip'), W / 2, 170, 20, '#81d4fa');
    const who = gameMode === 'duo' ? `${charName(players[0].ch)} + ${charName(players[1].ch)}` : charName();
    if (gameMode === 'trial') text(t('trialTip'), W / 2, 330, 22);
    else text(who + ' x ' + lives, W / 2, 330, 22);
    if (gameMode === 'duo') text(t('dDuo'), W / 2, 370, 15, '#b3e5fc');
    else if (checkpoint && checkpoint.level === levelIndex) text(t('fromCp'), W / 2, 365, 20, '#a5d6a7');
  } else if (state === 'playing' && boss && !paused) {
    if (bossIntro > 0) {
      text(t(bossKey('Intro')), W / 2, 200, 44, boss.kind === 'frosto' ? '#81d4fa' : '#ff7043');
      text(t(bossKey('Hint'), boss.maxHp), W / 2, 250, 22, '#ffe0b2');
    } else if (boss.dead && boss.dead < 280) {
      text(t(bossKey('Down')), W / 2, 200, 30, '#ffeb3b');
    }
  } else if (state === 'clear') {
    drawClear();
  } else if (state === 'gameover') {
    overlay(0.7);
    text(t('gameOver'), W / 2, 150, 64, '#ff6e6e');
    if (newHigh) text(t('newHigh'), W / 2, 205, 30, '#ffeb3b');
    text(t('score') + ': ' + score, W / 2, 245, 28);
    text(t('hs') + ': ' + highScore, W / 2, 280, 22, '#ffe082');
    drawMenu(menuItems(), W / 2 - 150, 320, 300, 42, 50);
  } else if (state === 'result') {
    overlay(0.68);
    const R = resultInfo;
    text(R.title, W / 2, 125, 52, R.won ? '#ffcc4d' : '#ff6e6e');
    R.lines.forEach((ln, i) => text(ln, W / 2, 185 + i * 32, 23, i === 0 ? '#ffffff' : '#b3e5fc'));
    drawMenu(menuItems(), W / 2 - 150, 330, 300, 42, 50);
  } else if (state === 'win') {
    overlay(0.6);
    if (newHigh) text(t('newHigh'), W / 2, 70, 30, '#ffeb3b');
    text(t('winTitle'), W / 2, 125, 68, '#ffcc4d');
    text(t('winLine', charName()), W / 2, 180, 24);
    text(t('final') + ': ' + score + '     ' + t('best') + ': ' + highScore, W / 2, 215, 24, '#b3e5fc');
    ctx.save(); ctx.translate(W / 2, 318); ctx.scale(1.9, 1.9);
    drawHero(0, 0, 1, 0, { kind: save.char, leaf: true, scarf: scarfCol() }); ctx.restore();
    drawCrystal(W / 2 + 40, 250, 12);
    drawMenu(menuItems(), W / 2 - 150, 335, 300, 42, 50);
  }
  if (paused && state === 'playing') {
    overlay(0.55);
    text(t('paused'), W / 2, 190, 56);
    drawMenu(menuItems(), W / 2 - 140, 250, 280, 44, 56);
  }
}

// level clear: 3 star ek-ek karke aate hain (time trial mein time dikhta hai)
function drawClear() {
  text(t('levelClear'), W / 2, 170, 56, '#ffeb3b');
  if (gameMode === 'trial') {
    text(fmtTime(runT), W / 2, 250, 50, '#ffffff');
    if (trialNew) text(t('newRecord'), W / 2, 305, 28, '#ffd54f');
    else text(t('best') + ': ' + fmtTime(save.times[levelIndex] || runT), W / 2, 305, 22, '#ffe082');
    return;
  }
  const labels = [t('starClear'), `${t('starGems')} ${Math.min(levelGemsGot, levelTotalGems)}/${levelTotalGems}`, t('starNoDeath')];
  for (let k = 0; k < 3; k++) {
    const x = W / 2 + (k - 1) * 140, appear = stateTimer - (30 + k * 25);
    drawStar(x, 250, 30, 'rgba(0,0,0,0.35)');
    if (clearStars[k] && appear > 0) {
      const sc = Math.min(1, appear / 10) * (1 + 0.3 * Math.max(0, 1 - appear / 14));
      ctx.save(); ctx.translate(x, 250); ctx.scale(sc, sc); drawStar(0, 0, 30, '#ffd54f'); ctx.restore();
    }
    text(labels[k], x, 300, 16, clearStars[k] ? '#fff' : '#9e9e9e');
  }
  text(t('timeBonus'), W / 2, 345, 22);
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
  if (th.rain) { // baarish + kabhi-kabhi bijli
    ctx.strokeStyle = 'rgba(180,200,255,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = ((i * 97 + frame * 3) % (W + 60)) - 30, ry = (i * 61 + frame * 11) % (H + 40) - 20;
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14);
    }
    ctx.stroke();
    if (frame % 700 < 8 && frame % 700 !== 4) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(0, 0, W, H); }
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
    if (state === 'ready' || state === 'story') fade = 1;
    else if (['title', 'gameover', 'win', 'map'].includes(state)) fade = 0.6;
    fadeState = state;
  }
  if (fade > 0.02) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); fade *= 0.88; }
  else fade = 0;
  drawToasts();
}

// =====================================================
//  MENUS, WORLD MAP, KAHANI, DUKAAN, ACHIEVEMENTS, SCORES, SETTINGS
// =====================================================
SFX.tick = () => beep(660, 660, 0.04, 'square', 0.03);

Object.assign(STR.hi, {
  ctrl1: 'Arrow / A D : chalo    Space / W : jump    Shift / X : daudo    F : fire    P : pause',
  mPlay: 'KHELO', mShop: 'DUKAAN (SHOP)', mAch: 'ACHIEVEMENTS', mScores: 'TOP SCORES', mSettings: 'SETTINGS',
  mHelp: 'KAISE KHELEIN', mInstall: 'APP INSTALL KARO',
  back: '◀  WAPAS', play: 'KHELO  ▶', resume: 'JAARI RAKHO', toMap: 'WORLD MAP', retry: 'PHIR SE KHELO',
  share: 'SCORE SHARE KARO', menu: 'MAIN MENU',
  map: 'WORLD MAP', locked: 'Pehle pichhla world paar karo!', mapHint: '◀ ▶ chuno    ENTER khelo    ESC wapas',
  sMusic: 'Music', sSfx: 'Awaaz (SFX)', sDiff: 'Mushkil', sLang: 'Bhasha', sStory: 'Kahani dobara dekho',
  diffs: ['AASAAN', 'NORMAL', 'MUSHKIL'],
  shop: 'DUKAAN', owned: 'PEHNO', equipped: 'PEHNA HUA ✓', buy: n => `${n} gems`,
  noGems: 'Itne gems nahi hain - aur khelo!', bought: 'Naya scarf mil gaya!',
  scarves: { green: 'Hara Scarf', red: 'Laal Scarf', blue: 'Neela Scarf', purple: 'Baingani Scarf', gold: 'Sone ka Scarf', rainbow: 'Satrangi Scarf' },
  shopNote: 'Gems khel ke kamao - asli paise nahi lagte',
  achTitle: 'ACHIEVEMENTS', achGot: 'ACHIEVEMENT MILA!',
  scoresTitle: 'TOP SCORES', noScores: 'Abhi koi score nahi - pehle khelo!', localNote: 'Ye scores is phone/PC mein save hote hain',
  helpTitle: 'KAISE KHELEIN',
  starClear: 'Level paar', starGems: 'Gems', starNoDeath: 'Bina mare',
  secret: 'SECRET MILA! +500',
  nameTitle: 'Top 10 mein aa gaye! Apna naam likho:', nameOk: 'SAVE', nameSkip: 'Rehne do', savedTop: 'Top Scores mein naam aa gaya!',
  shareMsg: s => `Maine TIKKU RUN game mein ${s} score kiya! Kya tum mujhe hara sakte ho?`,
  installIOS: 'iPhone: Safari mein Share dabao, phir "Add to Home Screen"',
  waterTip: 'Paani mein jump = tairo,  satah pe jump = bahar uchhlo',
  bossHint: n => `Uske sar pe kood ke maaro - ${n} baar!`,
  frostName: 'FROSTO', frostIntro: 'FROSTO aa gaya!', frostHint: n => `Sar pe kood ke maaro - ${n} baar! Fisalte waqt upar kood jao`,
  frostDown: 'Frosto pighal gaya! Portal khul gaya!',
  win: 'JEETA', world: 'World',
  st1: 'Hare-bhare jungle mein ek chhota fox rehta tha - TIKKU.\nPoore jungle ki roshni ek Sooraj-Crystal se aati thi.',
  st2: 'Ek raat gussail MAGMO aaya aur crystal chura le gaya!\nUska dost FROSTO barf ke kile mein pehra de raha hai.',
  st3: 'Jungle murjhaane laga. Tikku ne apna scarf baandha...\n...aur crystal wapas laane nikal pada!',
  st4: 'Magmo haar gaya! Sooraj-Crystal wapas Tikku ke paas!',
  st5: 'Jungle phir se chamak utha. Sab ne Tikku ko shukriya kaha!\nTHE END - khelne ke liye dhanyavaad!',
  storyNext: 'ENTER / tap = aage      ESC = skip',
  help: [
    'Keyboard: ← → chalo,  Space/↑ jump,  Shift daudo,  F fire,  P pause',
    'Phone: ◀ ▶ chalo,  ▲ jump,  » daudo,  aag wala button = fire',
    'Controller: A jump,  B daudo,  X fire,  Start pause',
    'Slime, chamgaadad, machhli: upar se kood ke haraao',
    'Hedgehog, cactus, aag ke chakkar: chhuna mat! (fire se maaro)',
    'Patta: double jump + ek extra hit',
    'Aag: F dabao, gole phenko',
    'Pankh: hawa mein jump dabaye rakho = dheere-dheere utro',
    'Taara: 8 second tak koi chhu bhi nahi sakta',
    'Magnet: paas ke saare gems khinch ke aate hain',
    'Paani: jump = tairo,  satah pe jump = bahar uchhlo',
    'Kuch patthar asli nahi hote - andar ghus ke dekho!',
    '3 star: level paar + 80% gems + bina mare',
  ],
});
Object.assign(STR.en, {
  ctrl1: 'Arrows / A D : move    Space / W : jump    Shift / X : run    F : fire    P : pause',
  mPlay: 'PLAY', mShop: 'SHOP', mAch: 'ACHIEVEMENTS', mScores: 'TOP SCORES', mSettings: 'SETTINGS',
  mHelp: 'HOW TO PLAY', mInstall: 'INSTALL APP',
  back: '◀  BACK', play: 'PLAY  ▶', resume: 'RESUME', toMap: 'WORLD MAP', retry: 'TRY AGAIN',
  share: 'SHARE SCORE', menu: 'MAIN MENU',
  map: 'WORLD MAP', locked: 'Clear the previous world first!', mapHint: '◀ ▶ choose    ENTER play    ESC back',
  sMusic: 'Music', sSfx: 'Sound (SFX)', sDiff: 'Difficulty', sLang: 'Language', sStory: 'Watch the story again',
  diffs: ['EASY', 'NORMAL', 'HARD'],
  shop: 'SHOP', owned: 'WEAR', equipped: 'WEARING ✓', buy: n => `${n} gems`,
  noGems: 'Not enough gems - keep playing!', bought: 'New scarf unlocked!',
  scarves: { green: 'Green Scarf', red: 'Red Scarf', blue: 'Blue Scarf', purple: 'Purple Scarf', gold: 'Golden Scarf', rainbow: 'Rainbow Scarf' },
  shopNote: 'Earn gems by playing - no real money',
  achTitle: 'ACHIEVEMENTS', achGot: 'ACHIEVEMENT UNLOCKED!',
  scoresTitle: 'TOP SCORES', noScores: 'No scores yet - go play!', localNote: 'Scores are saved on this phone/PC',
  helpTitle: 'HOW TO PLAY',
  starClear: 'Cleared', starGems: 'Gems', starNoDeath: 'No deaths',
  secret: 'SECRET FOUND! +500',
  nameTitle: 'You made the Top 10! Enter your name:', nameOk: 'SAVE', nameSkip: 'Skip', savedTop: 'Added to Top Scores!',
  shareMsg: s => `I scored ${s} in TIKKU RUN! Can you beat me?`,
  installIOS: 'iPhone: tap Share in Safari, then "Add to Home Screen"',
  waterTip: 'In water: jump = swim,  jump at the surface = leap out',
  bossHint: n => `Jump on its head to hit it - ${n} times!`,
  frostName: 'FROSTO', frostIntro: 'FROSTO is here!', frostHint: n => `Stomp its head ${n} times! Jump over it when it slides`,
  frostDown: 'Frosto melted! The portal is open!',
  win: 'WON', world: 'World',
  st1: 'In a green jungle lived a little fox - TIKKU.\nThe whole jungle got its light from the Sun Crystal.',
  st2: 'One night, angry MAGMO came and stole the crystal!\nHis friend FROSTO guards the ice fort.',
  st3: 'The jungle began to wilt. Tikku tied on the scarf...\n...and set off to bring the crystal back!',
  st4: 'Magmo is beaten! The Sun Crystal is back with Tikku!',
  st5: 'The jungle shines again. Everyone thanked Tikku!\nTHE END - thanks for playing!',
  storyNext: 'ENTER / tap = next      ESC = skip',
  help: [
    'Keyboard: ← → move,  Space/↑ jump,  Shift run,  F fire,  P pause',
    'Phone: ◀ ▶ move,  ▲ jump,  » run,  flame button = fire',
    'Controller: A jump,  B run,  X fire,  Start pause',
    'Slimes, bats, fish: jump on them from above',
    'Hedgehogs, cacti, fire bars: don\'t touch! (use fire)',
    'Leaf: double jump + one extra hit',
    'Flame: press F to throw fireballs',
    'Wings: hold jump in the air to glide down slowly',
    'Star: nothing can touch you for 8 seconds',
    'Magnet: pulls in all nearby gems',
    'Water: jump = swim,  jump at the surface = leap out',
    'Some rocks are fake - walk into them!',
    '3 stars: clear + 80% gems + no deaths',
  ],
});
const HELP_ICONS = ['keys', 'touch', 'pad', 'slime', 'hedge', 'leaf', 'fire', 'wing', 'star', 'magnet', 'water', 'secret', 'stars'];

// ---------- Achievements ----------
const ACH = [
  { id: 'w1', name: { hi: 'Pehla Kadam', en: 'First Steps' }, desc: { hi: 'World 1 paar karo', en: 'Clear World 1' } },
  { id: 'gem100', name: { hi: 'Gem Collector', en: 'Gem Collector' }, desc: { hi: 'Kul 100 gems ikatthe karo', en: 'Collect 100 gems in total' } },
  { id: 'gem500', name: { hi: 'Gem ka Raja', en: 'Gem King' }, desc: { hi: 'Kul 500 gems ikatthe karo', en: 'Collect 500 gems in total' } },
  { id: 'stomp50', name: { hi: 'Dushman Dhamaka', en: 'Foe Smasher' }, desc: { hi: '50 dushman haraao', en: 'Defeat 50 enemies' } },
  { id: 'fire25', name: { hi: 'Aag ka Gola', en: 'Fireball Pro' }, desc: { hi: 'Aag se 25 dushman haraao', en: 'Defeat 25 enemies with fire' } },
  { id: 'starpower', name: { hi: 'Superstar', en: 'Superstar' }, desc: { hi: 'Ek star power mein 5 dushman', en: '5 enemies in one star power' } },
  { id: 'nodeath', name: { hi: 'Bedaag', en: 'Flawless' }, desc: { hi: 'Bina mare koi level paar karo', en: 'Clear a level without dying' } },
  { id: 'stars3', name: { hi: 'Teen Taare', en: 'Three Stars' }, desc: { hi: 'Kisi level mein 3 star lo', en: 'Get 3 stars on a level' } },
  { id: 'secret', name: { hi: 'Khoji', en: 'Explorer' }, desc: { hi: 'Ek chhupa kamra dhoondo', en: 'Find a secret room' } },
  { id: 'swim', name: { hi: 'Machhli Fox', en: 'Fishy Fox' }, desc: { hi: 'Coral Lagoon paar karo', en: 'Clear Coral Lagoon' } },
  { id: 'frosto', name: { hi: 'Barf Todu', en: 'Ice Breaker' }, desc: { hi: 'Frosto ko haraao', en: 'Defeat Frosto' } },
  { id: 'magmo', name: { hi: 'Jungle ka Hero', en: 'Jungle Hero' }, desc: { hi: 'Magmo ko haraao', en: 'Defeat Magmo' } },
  { id: 'shop', name: { hi: 'Fashion Fox', en: 'Fashion Fox' }, desc: { hi: 'Dukaan se scarf khareedo', en: 'Buy a scarf in the shop' } },
  { id: 'allstars', name: { hi: 'Taaron ka Badshah', en: 'Star Master' }, desc: { hi: 'Har level mein 3 star', en: '3 stars on every level' } },
  { id: 'hard', name: { hi: 'Asli Ustaad', en: 'True Master' }, desc: { hi: 'MUSHKIL mode mein game jeeto', en: 'Beat the game on HARD' } },
];
let toasts = [];
function toast(msg, col = '#fff') { if (!toasts.some(ts => ts.msg === msg)) toasts.push({ msg, col, t: 170 }); }
function unlock(id) {
  if (save.ach[id]) return;
  const a = ACH.find(a => a.id === id); if (!a) return;
  save.ach[id] = Date.now(); persist();
  toasts.push({ ach: a, t: 220 }); SFX.life();
}

// ---------- Dukaan: Tikku ke scarf ----------
const SCARVES = [
  { id: 'green', col: '#2e9d5b', price: 0 }, { id: 'red', col: '#e53935', price: 50 },
  { id: 'blue', col: '#1e88e5', price: 100 }, { id: 'purple', col: '#8e24aa', price: 150 },
  { id: 'gold', col: '#ffc107', price: 300 }, { id: 'rainbow', col: null, price: 600 },
];
function scarfCol(id = save.scarf) {
  if (id === 'rainbow') return `hsl(${(frame * 4) % 360},85%,55%)`;
  const s = SCARVES.find(s => s.id === id); return s ? s.col : '#2e9d5b';
}
function shopLabel(s) {
  const st = save.scarf === s.id ? t('equipped') : save.owned.includes(s.id) ? t('owned') : t('buy', s.price);
  return `${t('scarves')[s.id]}   -   ${st}`;
}
function shopBuy(s) {
  if (save.owned.includes(s.id)) { save.scarf = s.id; persist(); return; }
  if (save.wallet < s.price) { toast(t('noGems'), '#ff8a80'); SFX.bump(); return; }
  save.wallet -= s.price; save.owned.push(s.id); save.scarf = s.id; persist();
  SFX.power(); toast(t('bought'), '#a5d6a7'); unlock('shop');
  track('shop-' + s.id, 'Scarf khareeda: ' + s.id);
}

// ---------- Menu system (keyboard, touch, mouse, controller sab se chalta hai) ----------
let menuSel = 0, menuFor = null;
const cyc = (v, d, n) => (v + d + n) % n;
function goState(s) { state = s; menuFor = null; }
function menuBack() { SFX.tick(); if (state === 'gameover') openMap(); else if (state === 'cloud') goState('settings'); else goState('title'); }
function openMap() { goState('map'); paused = false; mapSel = Math.min(save.unlocked, LEVELS.length - 1); }
function toggleLang() { setLang(lang === 'hi' ? 'en' : 'hi'); }

function menuItems() {
  if (state === 'title') {
    const it = [
      { label: t('mPlay'), act: () => { gameMode = 'adv'; openMap(); } },
      { label: t('mModes'), act: () => goState('modes') },
      { label: t('mChars'), act: () => goState('chars') },
      { label: t('mShop'), act: () => goState('shop') },
      { label: t('mAch'), act: () => goState('achievements') },
      { label: t('mScores'), act: () => goState('scores') },
      { label: t('mSettings'), act: () => goState('settings') },
      { label: t('mHelp'), act: () => goState('help') },
    ];
    if (canInstall()) it.push({ label: t('mInstall'), act: doInstall });
    it.cols = 2;
    return it;
  }
  if (state === 'settings') {
    const S = save.set, vol = (k, d) => () => { S[k] = Math.max(0, Math.min(10, S[k] + d)); persist(); if (k === 'sfx') SFX.gem(); };
    const vib = () => { S.vib = !S.vib; persist(); buzz(60); };
    return [
      { label: () => `${t('sMusic')}     ◀  ${S.music}  ▶`, left: vol('music', -1), right: vol('music', 1) },
      { label: () => `${t('sSfx')}     ◀  ${S.sfx}  ▶`, left: vol('sfx', -1), right: vol('sfx', 1) },
      { label: () => `${t('sDiff')}     ◀  ${t('diffs')[S.diff]}  ▶`,
        left: () => { S.diff = cyc(S.diff, -1, 3); persist(); }, right: () => { S.diff = cyc(S.diff, 1, 3); persist(); } },
      { label: () => `${t('sLang')}     ◀  ${lang === 'hi' ? 'HINGLISH' : 'ENGLISH'}  ▶`, left: toggleLang, right: toggleLang },
      { label: () => `${t('sVib')}     ◀  ${S.vib ? t('on') : t('off')}  ▶`, left: vib, right: vib },
      { label: () => `${t('sName')}:  ${save.lastName || t('noName')}`,
        act: () => openTextBox(t('sName'), save.lastName, 12, v => { if (v !== null) { save.lastName = v.trim().slice(0, 12); persist(); } }) },
      { label: t('sCloud'), act: () => goState('cloud') },
      { label: t('sStory'), act: () => startStory(INTRO, () => goState('settings')) },
      { label: t('back'), act: menuBack },
    ];
  }
  if (state === 'shop') return [...SCARVES.map(s => ({ label: () => shopLabel(s), act: () => shopBuy(s), scarf: s.id })),
                                 { label: t('back'), act: menuBack }];
  if (state === 'chars') return [...CHAR_IDS.map(id => ({ label: () => charLabel(id), act: () => charBuy(id), ch: id })),
                                  { label: t('back'), act: menuBack }];
  if (state === 'modes') return [
    { label: t('modeEndless'), act: startEndless, d: () => t('dEndless', save.best.endless) },
    { label: t('modeTrial'), act: () => { gameMode = 'trial'; openMap(); }, d: () => t('dTrial') },
    { label: t('modeRush'), act: () => { if (save.unlocked > RUSH[0]) startRush(); else toast(t('rushLocked'), '#ffcc80'); }, d: () => t('dRush') },
    { label: t('modeDaily'), act: startDaily, d: () => t('dDaily', save.daily.streak, save.daily.date === String(todayKey()) ? save.daily.best : 0) },
    { label: t('modeDuo'), act: () => { if (touchMode) toast(t('duoTouch'), '#ffcc80'); gameMode = 'duo'; openMap(); }, d: () => t('dDuo') },
    { label: t('modeEditor'), act: openEditor, d: () => t('dEditor') },
    { label: t('back'), act: menuBack },
  ];
  if (state === 'scores') {
    const nb = BOARDS.length;
    return [
      { label: () => `◀   ${t('boards')[BOARDS[scoreBoard]]}   ▶`, left: () => { scoreBoard = cyc(scoreBoard, -1, nb); }, right: () => { scoreBoard = cyc(scoreBoard, 1, nb); } },
      { label: () => scoreOnline ? t('srcOnline') : t('srcLocal'), act: () => { scoreOnline = !scoreOnline; } },
      { label: t('back'), act: menuBack },
    ];
  }
  if (state === 'cloud') return [
    { label: t('cloudUp'), act: cloudUpload },
    { label: t('cloudDown'), act: cloudDownload },
    { label: t('back'), act: menuBack },
  ];
  if (state === 'achievements' || state === 'help') return [{ label: t('back'), act: menuBack }];
  if (state === 'gameover') return [
    { label: t('retry'), act: () => startFrom(levelIndex) },
    { label: t('toMap'), act: openMap },
    { label: t('share'), act: shareScore },
  ];
  if (state === 'win') return [
    { label: t('share'), act: shareScore },
    { label: t('mScores'), act: () => goState('scores') },
    { label: t('menu'), act: () => goState('title') },
  ];
  if (state === 'result') {
    const again = { endless: startEndless, rush: startRush, daily: startDaily, custom: () => startCustom(curDef) }[gameMode] || (() => goState('title'));
    const it = [{ label: t('retry'), act: again }];
    if (gameMode === 'custom') it.push({ label: t('edEdit'), act: () => { if (curDef.code) ed = edDecode(curDef.code) || ed; openEditor(); } });
    else it.push({ label: t('share'), act: shareScore });
    it.push({ label: t('menu'), act: () => goState('title') });
    return it;
  }
  if (state === 'playing' && paused) return [
    { label: t('resume'), act: () => { paused = false; } },
    { label: gameMode === 'adv' || gameMode === 'duo' || gameMode === 'trial' ? t('toMap') : t('menu'),
      act: () => { saveHighScore(); persist(); if (gameMode === 'adv' || gameMode === 'duo' || gameMode === 'trial') openMap(); else goState('title'); paused = false; } },
  ];
  return [];
}

function menuUpdate(items) {
  const key = state + (paused ? 'P' : '');
  if (menuFor !== key) { menuFor = key; menuSel = 0; }
  const n = items.length; if (!n) return;
  if (menuSel >= n) menuSel = n - 1;
  const cols = items.cols || 1;
  const it = items[menuSel];
  if (hit('ArrowUp', 'KeyW', 'PadUp')) { menuSel = cols > 1 ? (menuSel - cols + n * cols) % n : cyc(menuSel, -1, n); SFX.tick(); }
  else if (hit('ArrowDown', 'KeyS', 'PadDown')) { menuSel = cols > 1 ? (menuSel + cols) % n : cyc(menuSel, 1, n); SFX.tick(); }
  else if (hit('ArrowLeft', 'KeyA')) { if (it.left) it.left(); else if (cols > 1) menuSel = cyc(menuSel, -1, n); SFX.tick(); }
  else if (hit('ArrowRight', 'KeyD')) { if (it.right) it.right(); else if (cols > 1) menuSel = cyc(menuSel, 1, n); SFX.tick(); }
  else if (hit(...OK_KEYS)) { SFX.tick(); if (it.act) it.act(); else if (it.right) it.right(); }
}

function drawButton(label, x, y, w, h, sel, act, size = 20) {
  ctx.fillStyle = sel ? 'rgba(255,204,77,0.96)' : 'rgba(18,22,44,0.78)'; rr(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = sel ? '#fff8e1' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; rr(x + 1, y + 1, w - 2, h - 2, 11); ctx.stroke();
  if (sel) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(x + 6, y + 4, w - 12, h * 0.3, 8); ctx.fill(); }
  ctx.font = `bold ${size}px "Trebuchet MS", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = sel ? '#4a2408' : '#fff'; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  if (act) ui.push({ x, y, w, h, act });
}
function drawMenu(items, x, y, w, h, gap, size = 20) {
  items.forEach((it, i) => {
    const label = typeof it.label === 'function' ? it.label() : it.label;
    drawButton(label, x, y + i * gap, w, h, i === menuSel, (lx, bw) => {
      menuSel = i; SFX.tick();
      if (it.left && lx < bw * 0.35) it.left();
      else if (it.act) it.act();
      else if (it.right) it.right();
    }, size);
  });
}

// ---------- World map: level chuno ----------
function drawMenuGrid(items, x, y, w, h, gx, gy, cols, size = 19) {
  items.forEach((it, i) => {
    const label = typeof it.label === 'function' ? it.label() : it.label;
    drawButton(label, x + (i % cols) * (w + gx), y + Math.floor(i / cols) * (h + gy), w, h, i === menuSel,
      () => { menuSel = i; SFX.tick(); if (it.act) it.act(); }, size);
  });
}
let mapSel = 0;
const mapNode = i => ({ x: 62 + i * (836 / (LEVELS.length - 1)), y: 262 + Math.sin(i * 1.25 + 0.4) * 72 });
const NODE_COL = { day: '#4caf50', sunset: '#ff8a65', water: '#29b6f6', night: '#5c6bc0', snow: '#90caf9',
                   cave: '#7e57c2', sky: '#4fc3f7', lava: '#ff5722', desert: '#ffb74d', temple: '#66bb6a', city: '#9575cd' };
function toastLocked() { toast(t('locked'), '#ffcc80'); SFX.bump(); }
function mapBack() { SFX.tick(); goState(gameMode === 'adv' ? 'title' : 'modes'); }
function updateMap() {
  const maxU = Math.min(save.unlocked, LEVELS.length - 1);
  if (hit('ArrowLeft', 'KeyA', 'TLeft') && mapSel > 0) { mapSel--; SFX.tick(); }
  if (hit('ArrowRight', 'KeyD', 'TRight')) { if (mapSel < maxU) { mapSel++; SFX.tick(); } else if (mapSel < LEVELS.length - 1) toastLocked(); }
  if (hit('Escape', 'PadBack')) mapBack();
  else if (hit(...OK_KEYS)) { SFX.tick(); startFrom(mapSel); }
}
function drawMap() {
  cam.x = frame * 0.6;
  drawBackground(THEMES.day, cam.x);
  overlay(0.2);
  const title = gameMode === 'trial' ? t('modeTrial') : gameMode === 'duo' ? t('modeDuo') : t('map');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(W / 2 - 190, 12, 380, 48, 14); ctx.fill();
  text(title, W / 2, 37, 30, '#ffcc4d');
  const maxU = Math.min(save.unlocked, LEVELS.length - 1);
  ctx.save(); ctx.setLineDash([12, 10]); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(110,70,30,0.6)';
  ctx.beginPath(); LEVELS.forEach((_, i) => { const n = mapNode(i); i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y); }); ctx.stroke();
  ctx.restore();
  LEVELS.forEach((L, i) => {
    const n = mapNode(i), open = i <= maxU, sel = i === mapSel, r = L.boss ? 26 : 21;
    if (sel) {
      const g = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 24);
      g.addColorStop(0, 'rgba(255,241,118,0.6)'); g.addColorStop(1, 'rgba(255,241,118,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, r + 24, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(n.x, n.y + r - 2, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = open ? NODE_COL[L.theme] || '#8bc34a' : '#616161'; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(n.x - r * 0.3, n.y - r * 0.4, r * 0.45, r * 0.25, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = sel ? 5 : 3; ctx.strokeStyle = sel ? '#fff59d' : L.boss ? '#ff1744' : '#ffffff';
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    if (open) text(String(i + 1), n.x, n.y + 1, 21, '#fff'); else drawLock(n.x, n.y);
    if (gameMode === 'trial') { if (save.times[i]) text(fmtTime(save.times[i]), n.x, n.y + r + 13, 11, '#e1f5fe'); }
    else for (let k = 0; k < 3; k++) drawStar(n.x - 14 + k * 14, n.y + r + 12, 6, k < (save.stars[i] || 0) ? '#ffd54f' : 'rgba(255,255,255,0.3)');
    if (L.boss) text('BOSS', n.x, n.y + r + 28, 11, '#ff8a80');
    ui.push({ x: n.x - r - 8, y: n.y - r - 8, w: 2 * r + 16, h: 2 * r + 16, act: () => {
      if (!open) return toastLocked();
      if (mapSel === i) startFrom(i); else { mapSel = i; SFX.tick(); }
    } });
  });
  const n = mapNode(mapSel), hop = Math.abs(Math.sin(frame * 0.1)) * 10;
  ctx.save(); ctx.translate(n.x, n.y - (LEVELS[mapSel].boss ? 26 : 21) - 2 - hop); ctx.scale(1.3, 1.3);
  drawHero(0, 0, 1, 0, { kind: save.char, scarf: scarfCol() }); ctx.restore();
  const L = LEVELS[mapSel];
  ctx.fillStyle = 'rgba(10,12,30,0.72)'; rr(220, 404, 520, 56, 14); ctx.fill();
  text(`WORLD ${mapSel + 1}  -  ${L.name}`, W / 2, 424, 22, '#fff');
  const sub = gameMode === 'trial' ? `${t('best')}: ${save.times[mapSel] ? fmtTime(save.times[mapSel]) : '--'}` : `${t('sDiff')}: ${t('diffs')[save.set.diff]}`;
  text(sub, W / 2, 447, 14, '#ffe082');
  drawButton(t('back'), 20, 480, 170, 44, false, mapBack, 18);
  drawButton(t('play'), W / 2 - 110, 474, 220, 52, true, () => { SFX.tick(); startFrom(mapSel); }, 22);
  if (!touchMode) text(t('mapHint'), W - 20, 502, 13, '#fff', 'right');
}


// ---------- Kahani (shuru aur end mein) ----------
const INTRO = [{ th: 'day', scene: 'home', key: 'st1' }, { th: 'lava', scene: 'steal', key: 'st2' }, { th: 'sunset', scene: 'go', key: 'st3' }];
const ENDING = [{ th: 'lava', scene: 'beat', key: 'st4' }, { th: 'day', scene: 'party', key: 'st5' }];
let story = null;
function startStory(pages, after) { story = { pages, i: 0, t: 0, after }; state = 'story'; menuFor = null; }
function finishStory() { const a = story.after; story = null; a(); }
function updateStory() {
  story.t++;
  if (hit('Escape', 'PadBack')) { finishStory(); return; }
  if (story.t > 15 && hit(...OK_KEYS)) {
    story.i++; story.t = 0; SFX.tick();
    if (story.i >= story.pages.length) finishStory();
  }
}
function heroAt(x, by, s, o = {}) {
  ctx.save(); ctx.translate(x, by); ctx.scale(s, s);
  drawHero(0, 0, o.facing || 1, o.anim || 0, { running: o.running, leaf: o.leaf, scarf: scarfCol() });
  ctx.restore();
}
function drawStory() {
  const pg = story.pages[story.i], th = THEMES[pg.th], T = story.t, G = 440;
  cam.x = frame * 0.5;
  drawBackground(th, cam.x);
  ctx.fillStyle = th.dirt; ctx.fillRect(0, G, W, H - G);
  ctx.fillStyle = th.grass; ctx.fillRect(0, G, W, 12); ctx.fillStyle = th.grassHi; ctx.fillRect(0, G, W, 4);
  if (pg.scene === 'home') {
    heroAt(380, G, 2.6);
    ctx.fillStyle = '#8f96a3'; ctx.fillRect(560, 380, 60, 60); ctx.fillStyle = '#a9b0bd'; ctx.fillRect(552, 372, 76, 12);
    drawCrystal(590, 330 + Math.sin(T * 0.05) * 4, 24);
  } else if (pg.scene === 'steal') {
    drawBossAt('magmo', 640, G, 1.3);
    drawCrystal(640 + Math.sin(T * 0.05) * 4, 230, 20);
    heroAt(300, G, 2.4);
    if (Math.floor(T / 20) % 2 === 0) text('!', 312, 300, 52, '#ffeb3b');
  } else if (pg.scene === 'go') {
    heroAt(((T * 3.2) % (W + 200)) - 100, G, 2.6, { running: true, anim: T * 0.35 });
  } else if (pg.scene === 'beat') {
    ctx.save(); ctx.translate(700, G); ctx.scale(1.3, 0.55); ctx.globalAlpha = 0.85; ctx.translate(-700, -G);
    drawBossAt('magmo', 700, G, 1); ctx.restore();
    heroAt(400, G, 2.6, { leaf: true });
    drawCrystal(415, G - 150 - Math.abs(Math.sin(T * 0.08)) * 8, 22);
  } else {
    heroAt(480, G, 2.8, { leaf: true });
    drawCrystal(480, 200, 34);
    for (let i = 0; i < 46; i++) {
      const x = (i * 97 + T * (1 + i % 3)) % W, y = (i * 53 + T * (1.2 + (i % 4) * 0.4)) % G;
      ctx.fillStyle = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'][i % 5];
      ctx.save(); ctx.translate(x, y); ctx.rotate(T * 0.1 + i); ctx.fillRect(-4, -2, 8, 4); ctx.restore();
    }
  }
  ctx.fillStyle = 'rgba(10,12,30,0.8)'; rr(50, 458, 860, 76, 14); ctx.fill();
  const lines = t(pg.key).split('\n');
  lines.forEach((ln, k) => text(ln, W / 2, 496 + (k - (lines.length - 1) / 2) * 27, 19, '#fff'));
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(W / 2 - 200, 10, 400, 28, 10); ctx.fill();
  text(t('storyNext'), W / 2, 24, 14, '#fff');
  for (let k = 0; k < story.pages.length; k++) {
    ctx.fillStyle = k === story.i ? '#ffcc4d' : 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(W - 40 - (story.pages.length - 1 - k) * 18, 24, 5, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- Settings / Dukaan / Achievements / Scores / Help screens ----------
function drawShop() {
  text(t('shop'), W / 2, 42, 34, '#ffcc4d');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(W - 200, 20, 180, 42, 12); ctx.fill();
  drawGemShape(W - 172, 41, 12); text(String(save.wallet), W - 150, 41, 22, '#b3e5fc', 'left');
  const items = menuItems(), cur = (items[menuSel] && items[menuSel].scarf) || save.scarf;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(50, 96, 340, 380, 20); ctx.fill();
  ctx.save(); ctx.translate(220, 400); ctx.scale(4.2, 4.2);
  drawHero(0, 0, 1, frame * 0.2, { kind: save.char, running: true, scarf: scarfCol(cur) }); ctx.restore();
  text(t('scarves')[cur], 220, 440, 22, '#fff');
  drawMenu(items, 420, 96, 490, 46, 54, 18);
  text(t('shopNote'), W / 2, 512, 14, '#cfd8dc');
}
function drawHelp() {
  text(t('helpTitle'), W / 2, 36, 32, '#ffcc4d');
  t('help').forEach((ln, i) => {
    const y = 80 + i * 30;
    drawHelpIcon(HELP_ICONS[i], 96, y);
    text(ln, 126, y, 16, '#fff', 'left');
  });
  drawMenu(menuItems(), W / 2 - 110, 484, 220, 40, 0, 18);
}
function drawSettings() {
  text(t('mSettings'), W / 2, 40, 32, '#ffcc4d');
  drawMenu(menuItems(), W / 2 - 240, 74, 480, 42, 49, 19);
}
function drawAchievements() {
  const got = ACH.filter(a => save.ach[a.id]).length;
  text(`${t('achTitle')}   ${got}/${ACH.length}`, W / 2, 34, 30, '#ffcc4d');
  ACH.forEach((a, i) => {
    const x = 16 + (i % 3) * 312, y = 62 + Math.floor(i / 3) * 58, ok = !!save.ach[a.id];
    ctx.fillStyle = ok ? 'rgba(255,204,77,0.2)' : 'rgba(0,0,0,0.42)'; rr(x, y, 304, 52, 10); ctx.fill();
    drawMedal(x + 22, y + 26, ok);
    text(a.name[lang], x + 44, y + 17, 16, ok ? '#ffe082' : '#bdbdbd', 'left');
    text(a.desc[lang], x + 44, y + 37, 12, ok ? '#ffffff' : '#9e9e9e', 'left');
  });
  drawMenu(menuItems(), W / 2 - 110, 478, 220, 42, 0, 18);
}
const BOARDS = ['adv', 'endless', 'rush', 'daily'];
let scoreBoard = 0, scoreOnline = false;
function drawScores() {
  const b = BOARDS[scoreBoard];
  text(`${t('scoresTitle')}  -  ${t('boards')[b]}`, W / 2, 36, 28, '#ffcc4d');
  let rows = save.tops[b] || [], msg = null;
  if (scoreOnline) {
    if (!online()) { rows = []; msg = t('offline'); }
    else {
      const c = onlineCache[b];
      if (!c) { onlineCache[b] = { st: 'loading', rows: [] }; fbTop(b).then(r => { onlineCache[b] = { st: 'ok', rows: r }; }).catch(() => { onlineCache[b] = { st: 'err', rows: [] }; }); }
      rows = c ? c.rows : [];
      if (!c || c.st === 'loading') msg = t('loading'); else if (c.st === 'err') msg = t('loadFail');
    }
  }
  if (!msg && !rows.length) msg = t('noScores');
  if (msg) text(msg, W / 2, 200, 20, '#fff');
  rows.slice(0, 10).forEach((r, i) => {
    const y = 78 + i * 31, c = ['#ffd54f', '#e0e0e0', '#ffab91'][i] || '#ffffff';
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.45)'; rr(170, y - 14, 620, 28, 8); ctx.fill();
    text(`${i + 1}.`, 195, y, 17, c, 'left');
    text(String(r.n), 245, y, 17, c, 'left');
    text(String(r.s), 590, y, 17, c, 'right');
    const info = b === 'adv' ? (+r.w ? `${t('world')} ${r.w}` : '★ ' + t('win')) : b === 'daily' && r.w ? String(r.w).slice(6) + '/' + String(r.w).slice(4, 6) : '';
    text(info, 625, y, 14, '#b3e5fc', 'left');
  });
  if (!scoreOnline) text(t('localNote'), W / 2, 394, 13, '#cfd8dc');
  drawMenu(menuItems(), W / 2 - 170, 408, 340, 36, 43, 17);
}
function drawModes() {
  text(t('mModes'), W / 2, 40, 32, '#ffcc4d');
  const items = menuItems();
  drawMenu(items, W / 2 - 200, 78, 400, 44, 52, 19);
  const it = items[menuSel];
  if (it && it.d) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(60, 450, 840, 44, 12); ctx.fill(); text(it.d(), W / 2, 472, 16, '#ffe082'); }
}
function charLabel(id) {
  const c = CHARS[id];
  const st = save.char === id ? t('selected') : save.chars.includes(id) ? t('select') : t('buy', c.price);
  return `${c.name}   -   ${st}`;
}
function charBuy(id) {
  const c = CHARS[id];
  if (save.chars.includes(id)) { save.char = id; persist(); return; }
  if (save.wallet < c.price) { toast(t('noGems'), '#ff8a80'); SFX.bump(); return; }
  save.wallet -= c.price; save.chars.push(id); save.char = id; persist();
  SFX.power(); toast(t('newFriend', c.name), '#a5d6a7'); unlock('friend');
  track('char-' + id, 'Kirdaar khola: ' + c.name);
}
function drawChars() {
  text(t('mChars'), W / 2, 42, 34, '#ffcc4d');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(W - 200, 20, 180, 42, 12); ctx.fill();
  drawGemShape(W - 172, 41, 12); text(String(save.wallet), W - 150, 41, 22, '#b3e5fc', 'left');
  const items = menuItems(), cur = (items[menuSel] && items[menuSel].ch) || save.char;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(50, 96, 340, 380, 20); ctx.fill();
  ctx.save(); ctx.translate(220, 380); ctx.scale(4.2, 4.2);
  drawHero(0, 0, 1, frame * 0.2, { kind: cur, running: true, scarf: scarfCol() }); ctx.restore();
  text(CHARS[cur].name, 220, 420, 24, '#fff');
  text(t('charDesc')[cur], 220, 450, 13, '#ffe082');
  drawMenu(items, 420, 110, 490, 50, 62, 19);
}
function drawCloud() {
  text(t('cloudTitle'), W / 2, 50, 32, '#ffcc4d');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(110, 90, 740, 120, 14); ctx.fill();
  text(t('cloudInfo1'), W / 2, 122, 16, '#fff');
  text(save.cloud ? t('cloudCode', save.cloud) : t('cloudNoCode'), W / 2, 160, 22, save.cloud ? '#ffd54f' : '#bdbdbd');
  if (!online()) text(t('offline'), W / 2, 192, 14, '#ff8a80');
  drawMenu(menuItems(), W / 2 - 200, 250, 400, 48, 60, 19);
}
const SUB_SCREENS = { settings: drawSettings, shop: drawShop, achievements: drawAchievements, scores: drawScores, help: drawHelp,
                      modes: drawModes, chars: drawChars, cloud: drawCloud };


// ---------- Naam / code likhne ka box ----------
let textOpen = false, textCb = null;
const nameBox = document.getElementById('namebox'), nameInput = document.getElementById('nb-input');
function openTextBox(title, value, maxLen, cb) {
  if (!nameBox) { cb(null); return; }
  textOpen = true; textCb = cb;
  document.getElementById('nb-title').textContent = title;
  document.getElementById('nb-ok').textContent = t('nameOk');
  document.getElementById('nb-skip').textContent = t('nameSkip');
  nameInput.maxLength = maxLen; nameInput.value = value || '';
  nameBox.classList.add('show');
  setTimeout(() => { try { nameInput.focus(); } catch (e) {} }, 60);
}
function closeTextBox(keep) {
  if (!textOpen) return;
  textOpen = false; nameBox.classList.remove('show'); nameInput.blur();
  for (const k in keys) keys[k] = false;
  const cb = textCb; textCb = null;
  if (cb) cb(keep ? (nameInput.value || '').replace(/\s+/g, ' ').trim() : null);
}
if (nameBox) {
  document.getElementById('nb-ok').addEventListener('click', () => closeTextBox(true));
  document.getElementById('nb-skip').addEventListener('click', () => closeTextBox(false));
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); closeTextBox(true); }
    else if (e.key === 'Escape') closeTextBox(false);
  });
}
// game khatam: local top 10 + online leaderboard (naam pehli baar hi poochte hain)
function endRun(board, won) {
  saveHighScore(); persist();
  if (score <= 0) return;
  const list = save.tops[board] || (save.tops[board] = []);
  const info = board === 'adv' ? (won ? 0 : levelIndex + 1) : board === 'daily' ? todayKey() : 0;
  const qualifies = list.length < 10 || score > list[list.length - 1].s;
  if (!qualifies && !online()) return;
  const sc = score;
  const submit = name => {
    if (qualifies) { list.push({ n: name, s: sc, w: info, d: save.set.diff, c: save.char }); list.sort((a, b) => b.s - a.s); list.splice(10); toast(t('savedTop'), '#ffe082'); }
    save.lastName = name; persist();
    if (online()) fbSubmit(board, name, sc, String(info)).then(ok => { if (ok) { toast(t('sentOnline'), '#a5d6a7'); onlineCache[board] = null; } }).catch(() => {});
  };
  if (save.lastName) submit(save.lastName);
  else openTextBox(t('nameTitle'), '', 12, v => submit((v || '').slice(0, 12) || charName()));
}


// ---------- Score share (WhatsApp / phone ka share menu) ----------
function shareScore() {
  const url = location.href.split('#')[0].split('?')[0], msg = t('shareMsg', score);
  track('share', 'Score share kiya');
  const wa = () => window.open('https://wa.me/?text=' + encodeURIComponent(msg + ' ' + url), '_blank');
  if (navigator.share) navigator.share({ title: GAME_TITLE, text: msg, url }).catch(e => { if (!e || e.name !== 'AbortError') wa(); });
  else wa();
}

// ---------- App install (PWA) ----------
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', () => { installEvt = null; track('installed', 'App install hua'); });
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
function canInstall() { return !isStandalone() && (!!installEvt || (isIOS && window.top === window.self)); }
function doInstall() {
  if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(() => { installEvt = null; }).catch(() => {}); }
  else if (isIOS) toast(t('installIOS'), '#b3e5fc');
}

// ---------- Game controller (Xbox / PlayStation / Bluetooth gamepad) - 2 controller = 2 player ----------
const PAD_KEYS = ['G0L', 'G0R', 'G0J', 'G0Run', 'G0F', 'G1L', 'G1R', 'G1J', 'G1Run', 'G1F'];
let padHeld = new Set();
function pollPad() {
  if (!navigator.getGamepads) return;
  let pads; try { pads = navigator.getGamepads(); } catch (e) { return; }
  const now = new Set(), duoPlay = gameMode === 'duo' && !isMenuState();
  let slot = 0;
  for (const gp of pads || []) {
    if (!gp) continue;
    const b = i => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const L = b(14) || ax < -0.45, R = b(15) || ax > 0.45, J = b(0), Run = b(1) || b(6) || b(7), F = b(2) || b(3);
    const tag = 'G' + Math.min(slot, 1);
    if (L) now.add(tag + 'L'); if (R) now.add(tag + 'R'); if (J) now.add(tag + 'J'); if (Run) now.add(tag + 'Run'); if (F) now.add(tag + 'F');
    if (!duoPlay) { if (L) now.add('ArrowLeft'); if (R) now.add('ArrowRight'); if (J) now.add('Space'); if (Run) now.add('ShiftLeft'); if (F) now.add('KeyF'); }
    if (b(9)) now.add('PadStart');
    if (b(8) || b(1)) now.add('PadBack');
    if (b(12) || ay < -0.6) now.add('PadUp');
    if (b(13) || ay > 0.6) now.add('PadDown');
    slot++;
  }
  for (const k of now) if (!padHeld.has(k)) { keys[k] = true; pressed.add(k); }
  for (const k of padHeld) if (!now.has(k)) keys[k] = false;
  if (now.size && touchMode) setTouchMode(false);
  padHeld = now;
}

// menu mein touch buttons chhupao
let lastInMenu = null;
function syncBodyClass() {
  const m = !(state === 'playing' && !paused) && state !== 'ready' && state !== 'dying' && state !== 'clear';
  if (m !== lastInMenu) { lastInMenu = m; document.body.classList.toggle('inmenu', m); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

// ---------- Naye drawing helpers ----------
function drawStar(cx, cy, r, col, rot = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  if (col === '#ffd54f' || col === '#ffeb3b') { ctx.strokeStyle = '#e65100'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke(); }
  ctx.restore();
}
function drawMagnet(cx, cy, r) {
  ctx.save(); ctx.lineWidth = r * 0.75; ctx.strokeStyle = '#e53935';
  ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx - r, cy); ctx.arc(cx, cy, r, Math.PI, 0, true); ctx.lineTo(cx + r, cy - r); ctx.stroke();
  ctx.fillStyle = '#eceff1'; ctx.fillRect(cx - r - r * 0.38, cy - r - r * 0.5, r * 0.76, r * 0.55); ctx.fillRect(cx + r - r * 0.38, cy - r - r * 0.5, r * 0.76, r * 0.55);
  ctx.restore();
}
function drawWing(cx, cy, r, rot = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  for (let i = 2; i >= 0; i--) {
    ctx.save(); ctx.rotate(i * 0.32);
    ctx.fillStyle = i === 0 ? '#ffffff' : i === 1 ? '#f1f8ff' : '#dfeefb';
    ctx.beginPath(); ctx.ellipse(r * 0.6, 0, r * (0.8 - i * 0.12), r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
function drawCrystal(cx, cy, r) {
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 3);
  g.addColorStop(0, 'rgba(255,236,130,0.7)'); g.addColorStop(1, 'rgba(255,236,130,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(frame * 0.01); ctx.fillStyle = 'rgba(255,245,180,0.25)';
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.3, -r * 2.6); ctx.lineTo(r * 0.3, -r * 2.6); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#ffb300';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 1.3); ctx.lineTo(cx + r * 0.8, cy - r * 0.2); ctx.lineTo(cx, cy + r * 1.1); ctx.lineTo(cx - r * 0.8, cy - r * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe082';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 1.3); ctx.lineTo(cx + r * 0.35, cy - r * 0.2); ctx.lineTo(cx - r * 0.35, cy - r * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff8e1'; ctx.fillRect(cx - r * 0.25, cy - r * 0.7, r * 0.15, r * 0.4);
}
function drawMedal(cx, cy, ok) {
  ctx.fillStyle = ok ? '#e53935' : '#455a64';
  ctx.beginPath(); ctx.moveTo(cx - 9, cy - 18); ctx.lineTo(cx - 3, cy - 6); ctx.lineTo(cx + 3, cy - 6); ctx.lineTo(cx + 9, cy - 18); ctx.fill();
  ctx.fillStyle = ok ? '#ffca28' : '#616161'; ctx.beginPath(); ctx.arc(cx, cy + 2, 12, 0, Math.PI * 2); ctx.fill();
  if (ok) drawStar(cx, cy + 2, 7, '#fff59d'); else text('?', cx, cy + 3, 14, '#bdbdbd');
}
function drawLock(cx, cy) {
  ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy - 3, 6, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#e0e0e0'; rr(cx - 9, cy - 3, 18, 13, 3); ctx.fill();
  ctx.fillStyle = '#616161'; ctx.fillRect(cx - 1.5, cy + 1, 3, 5);
}
function drawHelpIcon(k, x, y) {
  ctx.save();
  if (k === 'keys') { ctx.fillStyle = '#eceff1'; rr(x - 13, y - 9, 26, 18, 4); ctx.fill(); text('⌨', x, y + 1, 14, '#37474f'); }
  else if (k === 'touch') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke(); text('▲', x, y + 1, 11, '#fff'); }
  else if (k === 'pad') { ctx.fillStyle = '#90a4ae'; rr(x - 15, y - 8, 30, 16, 8); ctx.fill(); ctx.fillStyle = '#37474f'; ctx.fillRect(x - 10, y - 1.5, 7, 3); ctx.fillRect(x - 8, y - 3.5, 3, 7); ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(x + 8, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
  else if (k === 'slime') { ctx.fillStyle = '#9c5cf0'; ctx.beginPath(); ctx.moveTo(x - 12, y + 9); ctx.quadraticCurveTo(x - 12, y - 9, x, y - 9); ctx.quadraticCurveTo(x + 12, y - 9, x + 12, y + 9); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 2, 3, 3); ctx.fillRect(x + 3, y - 2, 3, 3); }
  else if (k === 'hedge') { ctx.fillStyle = '#5d4037'; for (let i = 0; i < 7; i++) { const a = Math.PI + i * 0.5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a - 0.2) * 7, y + Math.sin(a - 0.2) * 7); ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.lineTo(x + Math.cos(a + 0.2) * 7, y + Math.sin(a + 0.2) * 7); ctx.fill(); } ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); }
  else if (k === 'leaf') drawLeafShape(x, y, 10, 0);
  else if (k === 'fire') drawFlame(x, y + 2, 9);
  else if (k === 'wing') drawWing(x - 8, y + 4, 12, -0.5);
  else if (k === 'star' || k === 'stars') drawStar(x, y, 11, '#ffd54f');
  else if (k === 'magnet') drawMagnet(x, y + 3, 8);
  else if (k === 'water') { ctx.fillStyle = '#29b6f6'; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + 11, y + 2, x, y + 11); ctx.quadraticCurveTo(x - 11, y + 2, x, y - 12); ctx.fill(); }
  else if (k === 'secret') { ctx.translate(x - 12, y - 12); ctx.scale(0.75, 0.75); drawStone(0, 0, 7); }
  ctx.restore();
}

function drawStone(x, y, hsh) {
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
}

function drawPlats() {
  for (const pl of plats) {
    if (pl.gone || pl.x > cam.x + W + 10 || pl.x + pl.w < cam.x - 10) continue;
    const sx = pl.type === 'd' && pl.shakeT > 0 && !pl.falling ? Math.sin(pl.shakeT * 1.6) * 1.8 : 0;
    const x = pl.x + sx, y = pl.y;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 4, y + pl.h, pl.w - 8, 3);
    if (pl.type === 'd') {
      ctx.fillStyle = '#9c7b5b'; rr(x, y, pl.w, pl.h, 4); ctx.fill();
      ctx.fillStyle = '#c4a07a'; ctx.fillRect(x + 3, y + 2, pl.w - 6, 3);
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + 18, y + 2); ctx.lineTo(x + 22, y + 8); ctx.lineTo(x + 19, y + 13);
      ctx.moveTo(x + 44, y + 1); ctx.lineTo(x + 40, y + 7); ctx.lineTo(x + 46, y + 12); ctx.stroke();
    } else {
      ctx.fillStyle = '#5c6bc0'; rr(x, y, pl.w, pl.h, 5); ctx.fill();
      ctx.fillStyle = '#9fa8da'; ctx.fillRect(x + 4, y + 2, pl.w - 8, 3);
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(x + 7, y + 8, 2.5, 0, Math.PI * 2); ctx.arc(x + pl.w - 7, y + 8, 2.5, 0, Math.PI * 2); ctx.fill();
      const mx = x + pl.w / 2, my = y + 8;
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath();
      if (pl.type === 'h') { ctx.moveTo(mx - 14, my); ctx.lineTo(mx - 8, my - 4); ctx.lineTo(mx - 8, my + 4); ctx.moveTo(mx + 14, my); ctx.lineTo(mx + 8, my - 4); ctx.lineTo(mx + 8, my + 4); }
      else { ctx.moveTo(mx - 9, my + 3); ctx.lineTo(mx - 5, my - 4); ctx.lineTo(mx - 1, my + 3); ctx.moveTo(mx + 1, my - 3); ctx.lineTo(mx + 5, my + 4); ctx.lineTo(mx + 9, my - 3); }
      ctx.fill();
    }
  }
}

function drawHazards() {
  for (const hz of hazards) {
    if (hz.type === 'bar') {
      for (let i = 1; i <= hz.n; i++) {
        const bx = hz.cx + Math.cos(hz.a) * i * 15, by = hz.cy + Math.sin(hz.a) * i * 15;
        ctx.fillStyle = 'rgba(255,152,0,0.3)'; ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff5722'; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (hz.type === 'rock') {
      if (hz.ice && hz.st !== 'fall') { // neeche parchhai: yahan girega!
        const gy = groundBelow({ x: hz.x, y: hz.y, w: hz.w, h: hz.h }, 16);
        if (gy !== null) { ctx.fillStyle = `rgba(30,60,120,${0.2 + 0.2 * Math.sin(frame * 0.3)})`; ctx.beginPath(); ctx.ellipse(hz.x + hz.w / 2, gy, 14, 4, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      const sx = hz.st === 'shake' ? Math.sin(hz.t * 1.8) * 2 : 0, x = hz.x + sx;
      ctx.fillStyle = hz.ice ? '#b3e5fc' : '#6d5f74';
      ctx.beginPath(); ctx.moveTo(x, hz.y); ctx.lineTo(x + hz.w, hz.y); ctx.lineTo(x + hz.w / 2, hz.y + hz.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hz.ice ? '#e1f5fe' : '#8a7b92';
      ctx.beginPath(); ctx.moveTo(x + 3, hz.y); ctx.lineTo(x + hz.w / 2, hz.y); ctx.lineTo(x + hz.w / 2, hz.y + hz.h - 2); ctx.closePath(); ctx.fill();
    }
  }
}
function drawThorns() {
  ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2;
  for (const tn of thorns) {
    const d = Math.sign(tn.vx);
    ctx.beginPath(); ctx.moveTo(tn.x + (d > 0 ? 0 : tn.w), tn.y + 3); ctx.lineTo(tn.x + (d > 0 ? tn.w : 0), tn.y + 3); ctx.stroke();
    ctx.fillStyle = '#c5e1a5'; ctx.beginPath();
    const tip = tn.x + (d > 0 ? tn.w : 0);
    ctx.moveTo(tip + d * 4, tn.y + 3); ctx.lineTo(tip - d * 2, tn.y); ctx.lineTo(tip - d * 2, tn.y + 6); ctx.fill();
  }
}
function drawSecrets() {
  for (const s of level.secrets) {
    if (s.a <= 0) continue;
    ctx.save(); ctx.globalAlpha = s.a;
    for (let ty = s.y1; ty <= s.y2; ty++) for (let tx = s.x1; tx <= s.x2; tx++) {
      if (tx * TILE > cam.x + W || (tx + 1) * TILE < cam.x) continue;
      drawStone(tx * TILE, ty * TILE, hash2(tx, ty));
    }
    ctx.restore();
  }
}
function drawWater() {
  if (!level.water) return;
  for (const r of level.water) {
    const x = r.x1 * TILE, y = r.y1 * TILE, w = (r.x2 - r.x1 + 1) * TILE, h = (r.y2 - r.y1 + 1) * TILE;
    const x0 = Math.max(x, cam.x - 40), x1 = Math.min(x + w, cam.x + W + 40);
    if (x1 <= x0) continue;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(79,195,247,0.28)'); g.addColorStop(1, 'rgba(13,71,161,0.5)');
    ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; // roshni ki kirnein
    for (let i = Math.floor(x0 / 160); i * 160 < x1; i++) {
      const rx = i * 160 + Math.sin(frame * 0.01 + i) * 20;
      ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx + 40, y); ctx.lineTo(rx + 100, y + h); ctx.lineTo(rx + 40, y + h); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; // lehrein
    for (let sx = Math.floor(x0 / 16) * 16; sx < x1; sx += 16) ctx.fillRect(sx, y - 2 + Math.sin(frame * 0.07 + sx * 0.04) * 2, 16, 3);
  }
}

function drawToasts() {
  let y = H - 64;
  for (const ts of toasts) {
    ctx.globalAlpha = Math.min(1, ts.t / 25);
    if (ts.ach) {
      ctx.fillStyle = 'rgba(20,16,40,0.92)'; rr(W / 2 - 220, y - 26, 440, 52, 14); ctx.fill();
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2; rr(W / 2 - 219, y - 25, 438, 50, 13); ctx.stroke();
      drawMedal(W / 2 - 190, y, true);
      text(t('achGot'), W / 2 - 160, y - 10, 14, '#ffd54f', 'left');
      text(ts.ach.name[lang], W / 2 - 160, y + 11, 19, '#fff', 'left');
    } else {
      ctx.font = 'bold 18px "Trebuchet MS", system-ui, sans-serif';
      const w = Math.min(W - 40, ctx.measureText(ts.msg).width + 44);
      ctx.fillStyle = 'rgba(20,16,40,0.9)'; rr(W / 2 - w / 2, y - 22, w, 44, 12); ctx.fill();
      text(ts.msg, W / 2, y, 18, ts.col);
    }
    ctx.globalAlpha = 1;
    y -= 60;
  }
}

// =====================================================
//  MODES, KIRDAAR, LEVEL EDITOR, ONLINE LEADERBOARD, CLOUD SAVE
// =====================================================
Object.assign(STR.hi, {
  mModes: 'MODES', mChars: 'KIRDAAR',
  modeEndless: 'ENDLESS RUN', modeTrial: 'TIME TRIAL', modeRush: 'BOSS RUSH', modeDaily: 'AAJ KA CHALLENGE',
  modeDuo: '2 PLAYER', modeEditor: 'LEVEL EDITOR',
  dEndless: b => `Jitna door ja sako! Ek jaan, raasta kabhi khatam nahi hota.   Best: ${b} m`,
  dTrial: 'Level jaldi se jaldi paar karo - apni pichhli parchhai (ghost) se race',
  dRush: 'Frosto aur Magmo, ek ke baad ek - bina ruke!',
  dDaily: (s, b) => `Har din naya level, sabke liye same.   Streak: ${s}   Aaj ka best: ${b}`,
  dDuo: 'P1: W A D + Shift + F      P2: Arrows + Right Shift + Enter      (ya 2 controller)',
  dEditor: 'Apna level banao, khelo aur doston ko link bhejo',
  duoTouch: '2 Player ke liye keyboard ya 2 controller chahiye', rushLocked: 'Pehle kahani mein Frost Fort tak pahuncho!',
  endlessOver: 'ENDLESS KHATAM', distance: 'Doori', newBest: 'NAYA RECORD!', time: 'Time', newRecord: 'NAYA RECORD!',
  rushWin: 'BOSS RUSH PAAR!', dailyWin: 'CHALLENGE PAAR!', streak: 'Streak (lagatar din)', dailyRetry: 'Dobara koshish karo!',
  trialTip: 'Jitna jaldi ho sake portal tak pahuncho!', myLevel: 'MERA LEVEL', dailyName: 'AAJ KA CHALLENGE',
  charDesc: { fox: 'Sab kuch barabar - shuruaat ke liye best', bunny: 'Sabse ooncha koodta hai',
              panda: 'Kaante wale dushmano pe bhi kood sakta hai', owl: 'Jump dabaye rakho to hamesha glide' },
  select: 'CHUNO', selected: 'CHUNA HUA ✓', newFriend: n => `${n} ab tumhara dost hai!`,
  sVib: 'Vibration', on: 'ON', off: 'OFF', sName: 'Tumhara naam', sCloud: 'CLOUD SAVE', noName: '(nahi)',
  cloudTitle: 'CLOUD SAVE', cloudInfo1: 'Progress online save karo, doosre phone pe code daal ke wapas lao',
  cloudUp: 'UPLOAD KARO (code banao)', cloudDown: 'DOWNLOAD KARO (code daalo)', cloudCode: c => `Tumhara code: ${c}`,
  cloudNoCode: 'Abhi koi code nahi bana', cloudOk: 'Save upload ho gaya!', cloudLoaded: 'Save wapas aa gaya!',
  cloudFail: 'Nahi hua - internet ya code check karo', cloudAsk: 'Cloud save ka code daalo:',
  offline: 'Online abhi chalu nahi hua (Firebase setup baaki hai)', working: 'Ho raha hai...',
  boards: { adv: 'KAHANI', endless: 'ENDLESS', rush: 'BOSS RUSH', daily: 'AAJ KA' },
  srcLocal: 'IS PHONE KE SCORES', srcOnline: 'DUNIYA KE SCORES (ONLINE)', loading: 'Load ho raha hai...',
  loadFail: 'Online scores nahi mile', sentOnline: 'Score online bhej diya!',
  edEdit: 'EDIT KARO', edTest: 'KHELO ▶', edShare: 'SHARE', edClear: 'SAAF', edClearAsk: 'Sab mitana hai? Dobara SAAF dabao',
  edNeed: '@ (start) aur F (portal) dono lagao!', edShared: 'Level ka link taiyaar!', edLoaded: 'Dost ka banaya level!',
  edCopied: 'Link copy ho gaya - kahin bhi paste karo', shareLvlMsg: 'Maine TIKKU RUN mein apna level banaya hai - khel ke dekho!',
  edTools: { '#': 'Zameen', B: 'Patthar', I: 'Barf', '=': 'Lakdi', '^': 'Kaante', J: 'Spring', C: 'Gem crate', P: 'Patta crate',
             R: 'Aag crate', T: 'Taara crate', M: 'Magnet crate', W: 'Pankh crate', G: 'Gem', S: 'Slime', H: 'Hedgehog',
             V: 'Chamgaadad', Y: 'Cactus', O: 'Aag chakkar', r: 'Girta patthar', h: 'Chalti platform ↔', v: 'Chalti platform ↕',
             d: 'Girti platform', K: 'Checkpoint', '@': 'Start', F: 'Portal (end)', '.': 'Mitao' },
});
Object.assign(STR.en, {
  mModes: 'MODES', mChars: 'CHARACTERS',
  modeEndless: 'ENDLESS RUN', modeTrial: 'TIME TRIAL', modeRush: 'BOSS RUSH', modeDaily: 'DAILY CHALLENGE',
  modeDuo: '2 PLAYER', modeEditor: 'LEVEL EDITOR',
  dEndless: b => `Go as far as you can! One life, the road never ends.   Best: ${b} m`,
  dTrial: 'Clear levels as fast as possible - race your own ghost',
  dRush: 'Frosto and Magmo, back to back - no breaks!',
  dDaily: (s, b) => `A new level every day, same for everyone.   Streak: ${s}   Today's best: ${b}`,
  dDuo: 'P1: W A D + Shift + F      P2: Arrows + Right Shift + Enter      (or 2 controllers)',
  dEditor: 'Build your own level, play it and send the link to friends',
  duoTouch: '2 Player needs a keyboard or 2 controllers', rushLocked: 'Reach Frost Fort in the story first!',
  endlessOver: 'RUN OVER', distance: 'Distance', newBest: 'NEW RECORD!', time: 'Time', newRecord: 'NEW RECORD!',
  rushWin: 'BOSS RUSH CLEARED!', dailyWin: 'CHALLENGE CLEARED!', streak: 'Streak (days in a row)', dailyRetry: 'Try again!',
  trialTip: 'Reach the portal as fast as you can!', myLevel: 'MY LEVEL', dailyName: 'DAILY CHALLENGE',
  charDesc: { fox: 'Well balanced - best to start with', bunny: 'Jumps the highest',
              panda: 'Can stomp even spiky enemies', owl: 'Hold jump to glide any time' },
  select: 'SELECT', selected: 'SELECTED ✓', newFriend: n => `${n} joined your team!`,
  sVib: 'Vibration', on: 'ON', off: 'OFF', sName: 'Your name', sCloud: 'CLOUD SAVE', noName: '(none)',
  cloudTitle: 'CLOUD SAVE', cloudInfo1: 'Save your progress online and restore it on another phone with a code',
  cloudUp: 'UPLOAD (make a code)', cloudDown: 'DOWNLOAD (enter a code)', cloudCode: c => `Your code: ${c}`,
  cloudNoCode: 'No code yet', cloudOk: 'Save uploaded!', cloudLoaded: 'Save restored!',
  cloudFail: 'Failed - check internet or the code', cloudAsk: 'Enter your cloud save code:',
  offline: 'Online is not set up yet (Firebase setup pending)', working: 'Working...',
  boards: { adv: 'STORY', endless: 'ENDLESS', rush: 'BOSS RUSH', daily: 'TODAY' },
  srcLocal: 'SCORES ON THIS DEVICE', srcOnline: 'WORLD SCORES (ONLINE)', loading: 'Loading...',
  loadFail: 'Could not load online scores', sentOnline: 'Score sent online!',
  edEdit: 'EDIT', edTest: 'PLAY ▶', edShare: 'SHARE', edClear: 'CLEAR', edClearAsk: 'Erase everything? Press CLEAR again',
  edNeed: 'Place both @ (start) and F (portal)!', edShared: 'Level link ready!', edLoaded: 'A level made by a friend!',
  edCopied: 'Link copied - paste it anywhere', shareLvlMsg: 'I built my own level in TIKKU RUN - try it!',
  edTools: { '#': 'Ground', B: 'Stone', I: 'Ice', '=': 'Wood', '^': 'Spikes', J: 'Spring', C: 'Gem crate', P: 'Leaf crate',
             R: 'Fire crate', T: 'Star crate', M: 'Magnet crate', W: 'Wings crate', G: 'Gem', S: 'Slime', H: 'Hedgehog',
             V: 'Bat', Y: 'Cactus', O: 'Fire bar', r: 'Falling rock', h: 'Moving platform ↔', v: 'Moving platform ↕',
             d: 'Falling platform', K: 'Checkpoint', '@': 'Start', F: 'Portal (end)', '.': 'Erase' },
});
ACH.push(
  { id: 'endless500', name: { hi: 'Lambi Daud', en: 'Marathon' }, desc: { hi: 'Endless mein 500 m', en: '500 m in Endless Run' } },
  { id: 'daily', name: { hi: 'Roz ka Khiladi', en: 'Daily Player' }, desc: { hi: 'Aaj ka challenge paar karo', en: 'Clear a daily challenge' } },
  { id: 'rush', name: { hi: 'Boss ka Baap', en: 'Boss Slayer' }, desc: { hi: 'Boss Rush paar karo', en: 'Clear Boss Rush' } },
  { id: 'duo', name: { hi: 'Dosti Zindabad', en: 'Better Together' }, desc: { hi: '2 Player mein level paar karo', en: 'Clear a level in 2 Player' } },
  { id: 'creator', name: { hi: 'Level Designer', en: 'Level Designer' }, desc: { hi: 'Apna banaya level paar karo', en: 'Clear a level you built' } },
  { id: 'friend', name: { hi: 'Naya Dost', en: 'New Friend' }, desc: { hi: 'Naya kirdaar kholo', en: 'Unlock a new character' } },
);

// ---------- Online leaderboard + cloud save (Firebase Firestore) ----------
// index.html mein FIREBASE_CONFIG bharna hoga - tab tak ye sab chupchaap band rehta hai
const FB = window.FIREBASE_CONFIG || null;
const online = () => !!(FB && FB.projectId && FB.apiKey && !/APNA|APNI/.test(FB.projectId + FB.apiKey));
const fbBase = () => `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
const boardColl = b => b === 'daily' ? 'daily_' + todayKey() : 'scores_' + b;
let onlineCache = {};
async function fbSubmit(board, name, sc, info) {
  if (!online() || sc <= 0) return false;
  const body = { fields: { name: { stringValue: String(name).slice(0, 12) }, score: { integerValue: String(Math.floor(sc)) },
    char: { stringValue: save.char }, info: { stringValue: String(info || '').slice(0, 20) }, ts: { timestampValue: new Date().toISOString() } } };
  const r = await fetch(`${fbBase()}/${boardColl(board)}?key=${FB.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok;
}
async function fbTop(board) {
  const q = { structuredQuery: { from: [{ collectionId: boardColl(board) }], orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }], limit: 10 } };
  const r = await fetch(`${fbBase()}:runQuery?key=${FB.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  if (!r.ok) throw new Error('fb ' + r.status);
  const rows = await r.json();
  return rows.filter(x => x.document).map(x => {
    const f = x.document.fields;
    return { n: f.name ? f.name.stringValue : '?', s: f.score ? +f.score.integerValue : 0, w: f.info ? f.info.stringValue : '' };
  });
}
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', v = new Uint32Array(10);
  (window.crypto || window.msCrypto).getRandomValues(v);
  return Array.from(v, n => A[n % A.length]).join('');
}
function cloudUpload() {
  if (!online()) { toast(t('offline'), '#ffcc80'); return; }
  if (!save.cloud) { save.cloud = newCode(); persist(); }
  toast(t('working'));
  const data = JSON.stringify(save);
  fetch(`${fbBase()}/saves/${save.cloud}?key=${FB.apiKey}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { data: { stringValue: data }, ts: { timestampValue: new Date().toISOString() } } }) })
    .then(r => { if (!r.ok) throw new Error(r.status); toast(t('cloudOk'), '#a5d6a7'); track('cloud-up', 'Cloud save upload'); })
    .catch(() => toast(t('cloudFail'), '#ff8a80'));
}
function cloudDownload() {
  if (!online()) { toast(t('offline'), '#ffcc80'); return; }
  openTextBox(t('cloudAsk'), '', 12, code => {
    if (!code) return;
    code = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 10) { toast(t('cloudFail'), '#ff8a80'); return; }
    toast(t('working'));
    fetch(`${fbBase()}/saves/${code}?key=${FB.apiKey}`).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(doc => {
      const s = JSON.parse(doc.fields.data.stringValue);
      for (const k in save) if (k in s && s[k] !== null) {
        const d = save[k];
        if (d && typeof d === 'object' && !Array.isArray(d)) Object.assign(d, s[k]); else save[k] = s[k];
      }
      save.cloud = code; persist();
      toast(t('cloudLoaded'), '#a5d6a7'); track('cloud-down', 'Cloud save download');
    }).catch(() => toast(t('cloudFail'), '#ff8a80'));
  });
}

// ---------- LEVEL EDITOR ----------
const ED_TOOLS = ['#', 'B', 'I', '=', '^', 'J', 'C', 'P', 'R', 'T', 'M', 'W', 'G', 'S', 'H', 'V', 'Y', 'O', 'r', 'h', 'v', 'd', 'K', '@', 'F', '.'];
const ED_THEMES = ['day', 'sunset', 'night', 'snow', 'cave', 'sky', 'desert', 'temple', 'city', 'lava'];
const ED_W = 120, ED_S = 0.8;
let ed = null;
function edNew() {
  const g = [];
  for (let r = 0; r < ROWS; r++) g.push(new Array(ED_W).fill('.'));
  for (let x = 0; x < ED_W; x++) { g[15][x] = '#'; g[16][x] = '#'; }
  g[14][3] = '@'; g[13][114] = 'F';
  return { grid: g, theme: 'day', tool: 0, camX: 0, paint: false, clearArm: 0 };
}
function edEncode(e) {
  let s = ED_THEMES.indexOf(e.theme) + ';' + e.grid[0].length + ';';
  for (const row of e.grid) {
    let i = 0;
    while (i < row.length) { let j = i; while (j < row.length && row[j] === row[i]) j++; s += row[i] + (j - i > 1 ? j - i : ''); i = j; }
    s += '|';
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function edDecode(code) {
  try {
    const s = atob(String(code).replace(/-/g, '+').replace(/_/g, '/'));
    const parts = s.split(';'), th = ED_THEMES[+parts[0]] || 'day', w = Math.min(400, +parts[1] || ED_W);
    const rows = parts.slice(2).join(';').split('|').slice(0, ROWS), ok = new Set(ED_TOOLS);
    const g = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      const re = /([^\d])(\d*)/g; let m;
      while ((m = re.exec(rows[r] || '')) && row.length < w) { const c = ok.has(m[1]) ? m[1] : '.'; for (let k = 0; k < (+m[2] || 1) && row.length < w; k++) row.push(c); }
      while (row.length < w) row.push('.');
      g.push(row);
    }
    return { grid: g, theme: th, tool: 0, camX: 0, paint: false, clearArm: 0 };
  } catch (e) { return null; }
}
function edSaveLocal() { if (ed) { save.custom = edEncode(ed); persist(); } }
function openEditor() { if (!ed) ed = (save.custom && edDecode(save.custom)) || edNew(); ed.paint = false; goState('editor'); }
function edDef(e = ed, mine = true) {
  const code = edEncode(e), g = e.grid;
  return { name: t('myLevel'), theme: e.theme, w: g[0].length, mine, code,
    build(L) { for (let y = 0; y < ROWS; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] !== '.') L.set(x, y, g[y][x]); } };
}
function edTest() {
  const has = c => ed.grid.some(r => r.includes(c));
  if (!has('@') || !has('F')) { toast(t('edNeed'), '#ff8a80'); SFX.bump(); return; }
  edSaveLocal(); track('level-test', 'Apna level khela'); startCustom(edDef());
}
function edShare() {
  edSaveLocal();
  const url = location.origin + location.pathname + '?lvl=' + edEncode(ed), msg = t('shareLvlMsg');
  track('level-share', 'Level share kiya');
  const copy = () => { try { navigator.clipboard.writeText(msg + ' ' + url).then(() => toast(t('edCopied'), '#a5d6a7')).catch(() => window.open('https://wa.me/?text=' + encodeURIComponent(msg + ' ' + url), '_blank')); } catch (e) { window.open('https://wa.me/?text=' + encodeURIComponent(msg + ' ' + url), '_blank'); } };
  if (navigator.share) navigator.share({ title: GAME_TITLE, text: msg, url }).catch(e => { if (!e || e.name !== 'AbortError') copy(); });
  else copy();
}
function edPaint(x, y) {
  const tx = Math.floor((x / ED_S + ed.camX) / TILE), ty = Math.floor(y / ED_S / TILE);
  if (ty < 0 || ty >= ROWS || tx < 0 || tx >= ed.grid[0].length) return;
  const c = ED_TOOLS[ed.tool];
  if (ed.grid[ty][tx] === c) return;
  if (c === '@' || c === 'F') for (const row of ed.grid) for (let i = 0; i < row.length; i++) if (row[i] === c) row[i] = '.';
  ed.grid[ty][tx] = c;
  beep(c === '.' ? 300 : 520, c === '.' ? 200 : 620, 0.04, 'square', 0.025);
}
function edPointer(x, y) { if (y < ROWS * TILE * ED_S) { ed.paint = true; edPaint(x, y); } }
const canvasXY = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
canvas.addEventListener('pointermove', e => { if (state === 'editor' && ed && ed.paint) { const [x, y] = canvasXY(e); edPaint(x, y); } });
window.addEventListener('pointerup', () => { if (ed && ed.paint) { ed.paint = false; edSaveLocal(); } });
canvas.addEventListener('wheel', e => { if (state === 'editor' && ed) { e.preventDefault(); edScroll((e.deltaY + e.deltaX) * 0.6); } }, { passive: false });
function edScroll(d) { ed.camX = Math.max(0, Math.min(ed.camX + d, ed.grid[0].length * TILE - W / ED_S)); }
function updateEditor() {
  if (down('ArrowLeft', 'KeyA')) edScroll(-9);
  if (down('ArrowRight', 'KeyD')) edScroll(9);
  if (hit('KeyQ', 'BracketLeft')) ed.tool = cyc(ed.tool, -1, ED_TOOLS.length);
  if (hit('KeyE', 'BracketRight')) ed.tool = cyc(ed.tool, 1, ED_TOOLS.length);
  if (ed.clearArm > 0) ed.clearArm--;
  if (hit('Enter')) edTest();
  if (hit('Escape', 'PadBack')) { edSaveLocal(); goState('modes'); }
}
function drawEditor() {
  const th = THEMES[ed.theme], saved = level, savedCam = cam.x;
  viewScale = ED_S;
  level = { w: ed.grid[0].length, grid: ed.grid, theme: th, themeName: ed.theme, secrets: [], water: null };
  cam.x = ed.camX;
  drawBackground(th, cam.x * ED_S);
  ctx.save(); ctx.scale(ED_S, ED_S); ctx.translate(-Math.round(cam.x), 0);
  drawTiles(th);
  const x0 = Math.floor(cam.x / TILE), x1 = Math.min(level.w - 1, x0 + Math.ceil(W / ED_S / TILE) + 1);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = ed.grid[ty][tx];
    if ('GSHVYOrhvdK@F'.includes(c)) drawEdIcon(c, tx * TILE + 16, ty * TILE + 16, 26, true);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let tx = x0; tx <= x1 + 1; tx++) { ctx.moveTo(tx * TILE, 0); ctx.lineTo(tx * TILE, ROWS * TILE); }
  for (let ty = 0; ty <= ROWS; ty++) { ctx.moveTo(x0 * TILE, ty * TILE); ctx.lineTo((x1 + 1) * TILE, ty * TILE); }
  ctx.stroke();
  ctx.restore();
  level = saved; cam.x = savedCam; viewScale = 1;
  // neeche toolbar
  const top = ROWS * TILE * ED_S;
  ctx.fillStyle = 'rgba(12,14,30,0.94)'; ctx.fillRect(0, top, W, H - top);
  ED_TOOLS.forEach((c, i) => {
    const x = 8 + (i % 13) * 36, y = top + 6 + Math.floor(i / 13) * 38, sel = i === ed.tool;
    ctx.fillStyle = sel ? '#ffcc4d' : 'rgba(255,255,255,0.12)'; rr(x, y, 34, 34, 7); ctx.fill();
    drawEdIcon(c, x + 17, y + 17, 26, false);
    ui.push({ x, y, w: 34, h: 34, act: () => { ed.tool = i; SFX.tick(); } });
  });
  text('▸ ' + (t('edTools')[ED_TOOLS[ed.tool]] || ''), 12, top + 95, 13, '#ffe082', 'left');
  drawButton('◀', 482, top + 6, 44, 36, false, () => edScroll(-W * 0.6), 18);
  drawButton('▶', 530, top + 6, 44, 36, false, () => edScroll(W * 0.6), 18);
  drawButton(`${t('edTheme')}: ${ed.theme}`, 580, top + 6, 180, 36, false, () => { ed.theme = ED_THEMES[cyc(ED_THEMES.indexOf(ed.theme), 1, ED_THEMES.length)]; edSaveLocal(); }, 15);
  drawButton(t('edTest'), 766, top + 6, 186, 36, true, edTest, 18);
  drawButton(t('edShare'), 580, top + 48, 120, 34, false, edShare, 15);
  drawButton(t('edClear'), 706, top + 48, 110, 34, false, () => {
    if (ed.clearArm > 0) { ed = edNew(); edSaveLocal(); ed.clearArm = 0; } else { ed.clearArm = 180; toast(t('edClearAsk'), '#ffcc80'); }
  }, 15);
  drawButton(t('back'), 822, top + 48, 130, 34, false, () => { edSaveLocal(); goState('modes'); }, 15);
  // mini map: poore level mein kahan ho
  const mw = 470, mx = 482, my = top + 104;
  if (my + 4 < H) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(mx, my - 6, mw, 4);
    const vw = (W / ED_S) / (ed.grid[0].length * TILE) * mw;
    ctx.fillStyle = '#ffcc4d'; ctx.fillRect(mx + ed.camX / (ed.grid[0].length * TILE) * mw, my - 7, vw, 6);
  }
}
// editor ke chhote icons (palette aur level dono mein)
function drawEdIcon(c, cx, cy, s, inLevel) {
  const h = s / 2;
  ctx.save();
  if (!inLevel && '#BI=^JCPRTMWX'.includes(c)) { // tile ka chhota roop
    if (c === '#') { ctx.fillStyle = '#a0643a'; ctx.fillRect(cx - h, cy - h, s, s); ctx.fillStyle = '#4caf50'; ctx.fillRect(cx - h, cy - h, s, 7); }
    else if (c === 'B') { ctx.translate(cx - h, cy - h); ctx.scale(s / TILE, s / TILE); drawStone(0, 0, 4); }
    else if (c === 'I') { ctx.fillStyle = '#b9e6ff'; ctx.fillRect(cx - h, cy - h, s, s); ctx.fillStyle = '#fff'; ctx.fillRect(cx - h, cy - h, s, 4); }
    else if (c === '=') { ctx.fillStyle = '#a0703c'; ctx.fillRect(cx - h, cy - h, s, 10); ctx.fillStyle = '#d9a35e'; ctx.fillRect(cx - h, cy - h, s, 3); }
    else if (c === '^') { ctx.fillStyle = '#cfd8dc'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - h + i * s / 3, cy + h); ctx.lineTo(cx - h + i * s / 3 + s / 6, cy - 2); ctx.lineTo(cx - h + (i + 1) * s / 3, cy + h); ctx.fill(); } }
    else if (c === 'J') { ctx.fillStyle = '#546e7a'; ctx.fillRect(cx - h, cy, s, h); ctx.fillStyle = '#e53935'; ctx.fillRect(cx - h, cy - h + 4, s, 6); }
    else {
      ctx.fillStyle = '#c98b4a'; ctx.fillRect(cx - h, cy - h, s, s); ctx.strokeStyle = '#8d5a2b'; ctx.lineWidth = 3; ctx.strokeRect(cx - h + 1.5, cy - h + 1.5, s - 3, s - 3);
      if (c === 'C') drawGemShape(cx, cy, 7); else if (c === 'P') drawLeafShape(cx, cy, 7, 0); else if (c === 'R') drawFlame(cx, cy + 2, 6);
      else if (c === 'T') drawStar(cx, cy, 7, '#ffeb3b'); else if (c === 'M') drawMagnet(cx, cy + 2, 5); else if (c === 'W') drawWing(cx - 6, cy + 2, 8, -0.5);
    }
  } else if (c === 'G') drawGemShape(cx, cy, 8);
  else if (c === 'S' || c === 'H') drawHelpIcon(c === 'S' ? 'slime' : 'hedge', cx, cy + 2);
  else if (c === 'V') { ctx.fillStyle = '#4527a0'; ctx.beginPath(); ctx.moveTo(cx - 13, cy - 4); ctx.lineTo(cx, cy); ctx.lineTo(cx + 13, cy - 4); ctx.lineTo(cx, cy + 6); ctx.fill(); ctx.fillStyle = '#5e35b1'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill(); }
  else if (c === 'Y') { ctx.fillStyle = '#7cb342'; rr(cx - 4, cy - 11, 8, 22, 4); ctx.fill(); rr(cx - 10, cy - 5, 5, 9, 2); ctx.fill(); rr(cx + 5, cy - 8, 5, 9, 2); ctx.fill(); }
  else if (c === 'O') { ctx.fillStyle = '#8f96a3'; ctx.fillRect(cx - 7, cy - 7, 14, 14); drawFlame(cx + 9, cy - 5, 5); drawFlame(cx - 9, cy + 6, 5); }
  else if (c === 'r') { ctx.fillStyle = '#6d5f74'; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 12); ctx.lineTo(cx + 9, cy - 12); ctx.lineTo(cx, cy + 12); ctx.fill(); }
  else if (c === 'h' || c === 'v' || c === 'd') {
    const w = inLevel ? (c === 'd' ? 64 : 96) : s, x = inLevel ? cx - 16 : cx - h;
    ctx.fillStyle = c === 'd' ? '#9c7b5b' : '#5c6bc0'; rr(x, cy - 6, w, 12, 4); ctx.fill();
    ctx.fillStyle = '#fff'; text(c === 'h' ? '↔' : c === 'v' ? '↕' : '↓', x + w / 2, cy, 12, '#fff');
  }
  else if (c === 'K') { ctx.fillStyle = '#d7ccc8'; ctx.fillRect(cx - 6, cy - 12, 3, 24); ctx.fillStyle = '#2e9d5b'; ctx.fillRect(cx - 3, cy - 12, 12, 8); }
  else if (c === '@') { ctx.translate(cx, cy + h); ctx.scale(0.75, 0.75); drawHero(0, 0, 1, 0, { kind: save.char, scarf: scarfCol() }); }
  else if (c === 'F') {
    const ph = inLevel ? 64 : s, py = inLevel ? cy - 16 + 32 : cy;
    ctx.strokeStyle = '#e040fb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, py, inLevel ? 12 : 7, ph / 2 - 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#40c4ff'; ctx.beginPath(); ctx.ellipse(cx, py, inLevel ? 7 : 4, ph / 2 - 8, 0, 0, Math.PI * 2); ctx.stroke();
  }
  else if (c === '.') { ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8); ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8); ctx.stroke(); }
  ctx.restore();
}
Object.assign(STR.hi, { edTheme: 'Theme' }); Object.assign(STR.en, { edTheme: 'Theme' });

// dost ka bheja hua level (?lvl=...) seedha khulta hai
setTimeout(() => {
  try {
    const code = new URLSearchParams(location.search).get('lvl');
    if (!code) return;
    const e = edDecode(code);
    if (!e || !e.grid.some(r => r.includes('@')) || !e.grid.some(r => r.includes('F'))) return;
    toast(t('edLoaded'), '#a5d6a7'); track('level-open', 'Dost ka level khola');
    startCustom(edDef(e, false));
  } catch (err) {}
}, 50);

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
