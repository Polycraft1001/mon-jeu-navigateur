// =====================================================
//  FENÊTRES PAR-DESSUS LE JEU (grande carte, boutiques)
//  Quand une fenêtre est ouverte, le jeu est en pause
//  (G.state = 'overlay') et n'entend plus le clavier.
//  Échap = fermer
// =====================================================
import { G } from '../core/ctx.js';

let cur = null, prev = 'play';
export const overlayOpen = () => !!cur;

export function openOverlay(el, onClose) {
  if (cur) closeOverlay();
  prev = G.state;
  G.state = 'overlay';
  cur = { el, onClose };
  el.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock(); // on rend la souris
}

export function closeOverlay() {
  if (!cur) return;
  const c = cur;
  cur = null;
  c.el.style.display = 'none';
  G.state = prev === 'overlay' ? 'play' : prev;
  if (G.clock) G.clock.getDelta(); // pas de « saut » dans le temps
  if (c.onClose) c.onClose();
}

// Pendant qu'une fenêtre est ouverte, le jeu n'entend pas les touches
document.addEventListener('keydown', (e) => {
  if (!cur) return;
  e.stopPropagation();
  const mapKey = e.code === 'KeyM' && cur.el.dataset.map;
  if (e.code === 'Escape' || e.code === 'Backspace' || mapKey) { e.preventDefault(); closeOverlay(); }
}, true);
