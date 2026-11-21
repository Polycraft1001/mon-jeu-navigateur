// =====================================================
//  HUD : argent, vitesse, drift, vie, arme, messages
//  (aucun emoji : les icônes viennent de Font Awesome)
// =====================================================
import { $, clamp, isMobile } from '../core/utils.js';
import { G } from '../core/ctx.js';
import { save } from '../core/save.js';
import { ASSIST, LEVEL_COLORS, LEVEL_NAMES } from '../core/config.js';
import { coins } from '../world/city.js';
import { player, D, drive } from '../vehicles/driving.js';
import { hero, enterHint } from '../gameplay/onfoot.js';
import { currentWeapon } from '../gameplay/weapons.js';

const cache = {};
const get = (id) => cache[id] || (cache[id] = $(id));
let msgTimer = 0, hintTimer = 0, driftBtn = null, lastWeapon = null;

// petit utilitaire : un texte sûr à mettre dans innerHTML
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// une icône Font Awesome, ex. icon('fa-gun')
// (fonction déclarée : utilisable même avec des imports circulaires)
export function icon(fa) {
  return fa ? '<i class="fa-solid ' + fa + '"></i>' : '';
}

// Grand message au milieu de l'écran
export function showMessage(text, color = '#fff', time = 1.6) {
  const m = get('message');
  if (!m) return;
  m.textContent = text; m.style.color = color;
  m.classList.add('show');
  msgTimer = time;
}
// Bandeau d'aide (en bas)
export function showHint(html, time = 9) {
  const h = get('hint');
  if (!h) return;
  h.innerHTML = html; h.style.opacity = 1;
  hintTimer = time;
}
// Argent, pièces, record
export function refreshStats() {
  const m = get('money');
  if (!m) return;
  m.textContent = save.money.toLocaleString('fr-FR') + ' $';
  get('coins').textContent = (G.coinsTaken || 0) + '/' + coins.length;
  get('bestDrift').textContent = save.bestDrift.toLocaleString('fr-FR');
}

const hpColor = (k) => (k > 0.5 ? '#3dff7a' : k > 0.25 ? '#ffd23a' : '#ff4040');
function bar(id, k) {
  const el = get(id);
  if (!el) return;
  el.style.width = (k * 100).toFixed(1) + '%';
  el.style.background = hpColor(k);
}

// arme en main : icône + nom (avec une petite animation quand on change)
function updateWeapon() {
  const w = currentWeapon();
  const box = get('weaponBox');
  if (!w || !box || w === lastWeapon) return;
  lastWeapon = w;
  get('weaponIcon').innerHTML = icon(w.fa || 'fa-hand-fist');
  get('weaponName').textContent = w.name;
  box.classList.remove('pop');
  void box.offsetWidth; // relance l'animation
  box.classList.add('pop');
}

// ce que fait la touche F (monter / voler)
function updateActionHint(inCar) {
  const ah = get('actionHint');
  if (!ah) return;
  const txt = inCar ? null : enterHint();
  ah.classList.toggle('hidden', !txt);
  if (!txt || ah.dataset.t === txt) return;
  ah.dataset.t = txt;
  const m = /^F\s*:\s*/.exec(txt);
  const rest = m ? txt.slice(m[0].length) : txt;
  if (isMobile) ah.innerHTML = icon('fa-door-open') + ' ' + esc(rest);
  else ah.innerHTML = (m ? '<kbd>F</kbd> ' : '') + esc(rest);
}

export function updateHUD(dt) {
  const inCar = G.mode === 'car';
  document.body.classList.toggle('onfoot', !inCar);
  get('speed').textContent = Math.round(Math.abs(inCar ? player.speed : hero.speed) * 3.6);

  // barre de turbo
  const A = ASSIST[save.assist] || ASSIST.normal;
  const fill = get('turboFill');
  if (inCar && drive.turboTime > 0) { fill.style.width = (drive.turboTime / drive.turboMax * 100) + '%'; fill.style.background = LEVEL_COLORS[drive.turboLevel]; fill.style.color = LEVEL_COLORS[drive.turboLevel]; }
  else if (inCar && D.drifting) { fill.style.width = Math.min(100, D.time / A.th[2] * 100) + '%'; fill.style.background = LEVEL_COLORS[Math.max(1, D.level)]; fill.style.color = LEVEL_COLORS[Math.max(1, D.level)]; }
  else fill.style.width = '0%';

  // compteur de drift
  const box = get('driftBox');
  if (D.drifting || D.show > 0) {
    box.classList.remove('hidden');
    get('driftLevel').textContent = D.drifting ? LEVEL_NAMES[D.level] : 'BIEN JOUÉ !';
    get('driftLevel').style.color = LEVEL_COLORS[D.level];
    get('driftPoints').textContent = (D.drifting ? '' : '+') + Math.round(D.points).toLocaleString('fr-FR');
    get('driftPoints').style.color = D.drifting ? '#fff' : '#7dff9a';
    get('driftMult').textContent = D.mult > 1 ? 'COMBO x' + D.mult : '';
  } else box.classList.add('hidden');

  // vie du héros et de la voiture
  const hk = clamp(hero.hp / hero.maxHp, 0, 1);
  bar('heroFill', hk);
  const carMax = (player.def && player.def.hp) || 100;
  bar('carFill', G.car && !player.wrecked ? clamp(player.hp / carMax, 0, 1) : 0);

  updateWeapon();
  updateActionHint(inCar);

  // écran rouge quand on est blessé
  const hf = get('hurtFlash');
  if (hf) {
    let o = clamp(hero.hurtT / 0.35, 0, 1) * 0.6;
    if (!inCar && hk < 0.3 && hero.state !== 'ko') o = Math.max(o, 0.18 + Math.sin(G.elapsed * 6) * 0.08);
    hf.style.opacity = o.toFixed(2);
  }

  // bouton tactile : DRIFT en voiture, SAUT à pied
  driftBtn = driftBtn || document.querySelector('#pedals .tdrift');
  if (driftBtn) {
    const label = inCar ? 'DRIFT' : 'SAUT';
    if (driftBtn.textContent !== label) driftBtn.textContent = label;
  }

  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) get('message').classList.remove('show'); }
  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) get('hint').style.opacity = 0; }
}
