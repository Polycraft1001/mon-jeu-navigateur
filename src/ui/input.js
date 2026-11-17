// =====================================================
//  COMMANDES : clavier, souris, écran tactile
//  ➜ Nouvelle touche : ajoute un "case" dans onKeyDown()
// =====================================================
import { $, clamp, isMobile } from '../core/utils.js';
import { G } from '../core/ctx.js';
import { WEAPONS } from '../core/config.js';
import { player, resetPlayer } from '../vehicles/driving.js';
import { toggleCar, callCar } from '../gameplay/onfoot.js';
import { selectWeapon, nextWeapon, setTrigger } from '../gameplay/weapons.js';
import { showMessage } from './hud.js';
import { sfx } from './audio.js';
import { togglePause } from './menu.js';

const keys = {};
const touch = { up: false, down: false, drift: false, steer: 0 };
const fire = { mouse: false, key: false, touch: false };
const inp = { up: false, down: false, steer: 0, drift: false, sprint: false, jump: false };

// Commandes du moment (pour la voiture ET pour le héros)
export function readInput() {
  const ks = ((keys.ArrowLeft || keys.KeyA) ? 1 : 0) - ((keys.ArrowRight || keys.KeyD) ? 1 : 0);
  const shift = !!(keys.ShiftLeft || keys.ShiftRight);
  inp.up = !!(keys.ArrowUp || keys.KeyW || touch.up);
  inp.down = !!(keys.ArrowDown || keys.KeyS || touch.down);
  inp.steer = ks !== 0 ? ks : touch.steer; // +1 = gauche, -1 = droite
  inp.drift = !!(keys.Space || shift || touch.drift);
  inp.sprint = shift || isMobile; // sur téléphone, le héros court toujours
  inp.jump = !!(keys.Space || touch.drift);
  return inp;
}

function updateTrigger() { setTrigger(G.state === 'play' && (fire.mouse || fire.key || fire.touch)); }

export function clearInput() {
  for (const k in keys) keys[k] = false;
  touch.up = touch.down = touch.drift = false; touch.steer = 0;
  fire.mouse = fire.key = fire.touch = false;
  updateTrigger();
}

// ----- Actions -----
let lastHorn = 0;
export function horn() {
  if (G.state !== 'play' || G.mode !== 'car') return;
  const now = performance.now();
  if (now - lastHorn < 500) return;
  lastHorn = now;
  sfx('horn');
  if (G.peds) G.peds.scare(player.pos.x, player.pos.z, 30); // les piétons s'écartent
}
function resetAction() {
  if (G.state !== 'play') return;
  if (G.mode === 'foot') callCar();
  else { resetPlayer(false); showMessage('Voiture replacée', '#ffffff', 0.8); }
}
const cycleCam = () => { G.camMode = (G.camMode + 1) % 3; };
function pickWeapon(i) { if (i < WEAPONS.length) selectWeapon(i); }

// ----- Clavier -----
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (G.state !== 'play') return;
  switch (e.code) {
    case 'KeyF': case 'Enter': case 'NumpadEnter': toggleCar(); break; // sortir / monter / voler
    case 'KeyR': resetAction(); break;
    case 'KeyH': horn(); break;
    case 'KeyC': case 'KeyV': cycleCam(); break;
    case 'KeyE': case 'Tab': nextWeapon(1); break;
    case 'KeyX': fire.key = true; updateTrigger(); break;
    default: {
      const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
      if (m) pickWeapon(Number(m[2]) - 1);
    }
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyX') { fire.key = false; updateTrigger(); }
});
window.addEventListener('blur', () => {
  clearInput();
  if (G.state === 'play') togglePause();
});

// ----- Souris : clic gauche = tirer, molette = changer d'arme -----
if (!isMobile) {
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || G.state !== 'play' || !e.target || e.target.tagName !== 'CANVAS') return;
    fire.mouse = true; updateTrigger();
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) { fire.mouse = false; updateTrigger(); } });
  let wheelT = 0;
  window.addEventListener('wheel', (e) => {
    if (G.state !== 'play') return;
    const now = performance.now();
    if (now - wheelT < 120) return;
    wheelT = now;
    nextWeapon(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });
}

// ----- Joystick (volant) : glisser le doigt à gauche / à droite -----
const joy = $('joy'), knob = $('joyKnob');
let joyId = null, joyX = 0;
function joyMove(e) {
  const R = Math.max(10, (joy.clientWidth - knob.offsetWidth) / 2);
  const dx = clamp(e.clientX - joyX, -R, R);
  knob.style.transform = 'translateX(' + dx + 'px)';
  const s = clamp(-dx / (R * 0.85), -1, 1);
  const a = Math.abs(s);
  touch.steer = a < 0.12 ? 0 : Math.sign(s) * (a - 0.12) / 0.88; // petite zone morte au centre
}
function joyEnd(e) {
  if (e.pointerId !== joyId) return;
  joyId = null; touch.steer = 0;
  knob.style.transform = '';
  joy.classList.remove('active');
}
if (joy && knob) {
  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyId = e.pointerId;
    try { joy.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    const r = joy.getBoundingClientRect();
    joyX = r.left + r.width / 2;
    joy.classList.add('active');
    joyMove(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);
  joy.addEventListener('lostpointercapture', joyEnd);
}

// ----- Pédales (accélérer, freiner, drift / saut) -----
function holdButton(b, onDown, onUp) {
  const on = (e) => { e.preventDefault(); b.classList.add('active'); onDown(); };
  const off = (e) => { e.preventDefault(); b.classList.remove('active'); onUp(); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off);
  b.addEventListener('pointercancel', off);
}
document.querySelectorAll('#touch button[data-k]').forEach((b) => {
  const k = b.dataset.k;
  holdButton(b, () => { touch[k] = true; }, () => { touch[k] = false; });
});
// ----- Bouton de tir 🔫 (on garde appuyé pour la mitraillette) -----
const fireBtn = $('fireBtn');
if (fireBtn) holdButton(fireBtn, () => { fire.touch = true; updateTrigger(); }, () => { fire.touch = false; updateTrigger(); });

// ----- Boutons outils -----
document.querySelectorAll('#tools button[data-a]').forEach((b) => {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('active');
    setTimeout(() => b.classList.remove('active'), 150);
    if (G.state !== 'play') return;
    const a = b.dataset.a;
    if (a === 'horn') horn();
    else if (a === 'cam') cycleCam();
    else if (a === 'reset') resetAction();
    else if (a === 'car') toggleCar();
    else if (a === 'weapon') nextWeapon(1);
  });
});
if (isMobile) window.addEventListener('contextmenu', (e) => e.preventDefault());
