// =====================================================
//  HUD : argent, vitesse, drift, vie, arme, messages
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
let msgTimer = 0, hintTimer = 0, driftBtn = null;

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

export function updateHUD(dt) {
  const inCar = G.mode === 'car';
  document.body.classList.toggle('onfoot', !inCar);
  get('speed').textContent = Math.round(Math.abs(inCar ? player.speed : hero.speed) * 3.6);

  // barre de turbo
  const A = ASSIST[save.assist] || ASSIST.normal;
  const fill = get('turboFill');
  if (inCar && drive.turboTime > 0) { fill.style.width = (drive.turboTime / drive.turboMax * 100) + '%'; fill.style.background = LEVEL_COLORS[drive.turboLevel]; }
  else if (inCar && D.drifting) { fill.style.width = Math.min(100, D.time / A.th[2] * 100) + '%'; fill.style.background = LEVEL_COLORS[Math.max(1, D.level)]; }
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

  // arme en main
  const w = currentWeapon();
  if (w && get('weaponIcon')) {
    get('weaponIcon').textContent = w.icon;
    get('weaponName').textContent = w.name;
  }

  // ce que fait la touche F (monter / voler)
  const ah = get('actionHint');
  if (ah) {
    let txt = inCar ? null : enterHint();
    if (txt && isMobile) txt = txt.replace('F :', '🚪');
    ah.classList.toggle('hidden', !txt);
    if (txt && ah.textContent !== txt) ah.textContent = txt;
  }

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
