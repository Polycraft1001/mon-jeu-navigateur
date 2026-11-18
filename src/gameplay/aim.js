// =====================================================
//  VISER À LA SOURIS (à pied, sur ordinateur) 🖱️
//  Clic dans le jeu = la souris est « capturée » :
//   - bouger la souris = tourner le héros et viser haut / bas
//   - le viseur au centre de l'écran montre où partent les tirs
//   - Échap = libérer la souris
//  En voiture et en avion : on garde la visée automatique.
// =====================================================
import { G } from '../core/ctx.js';
import { clamp, isMobile } from '../core/utils.js';
import { hero } from './onfoot.js';
import { showMessage } from '../ui/hud.js';

const SENS = 0.0023;    // sensibilité gauche / droite
const SENS_Y = 0.0017;  // sensibilité haut / bas
export const aim = { pitch: 0 };
let locked = false;

// est-ce qu'on vise à la souris en ce moment ?
export const mouseLook = () => locked && G.mode === 'foot' && G.state === 'play';

if (!isMobile) {
  document.addEventListener('pointerlockchange', () => {
    locked = !!document.pointerLockElement;
    if (!locked) aim.pitch = 0;
  });
  // un clic dans le jeu (à pied) capture la souris
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || locked || G.state !== 'play' || G.mode !== 'foot') return;
    if (!e.target || e.target.tagName !== 'CANVAS') return;
    const c = document.querySelector('#game canvas');
    if (!c || !c.requestPointerLock) return;
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* rien */ }
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseLook()) return;
    const mx = clamp(e.movementX || 0, -120, 120), my = clamp(e.movementY || 0, -120, 120);
    if (hero.state === 'ok') hero.h -= mx * SENS;
    aim.pitch = clamp(aim.pitch - my * SENS_Y, -0.5, 0.65);
  });
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyP' && locked) document.exitPointerLock(); });

  // on rend la souris en voiture, en avion, en pause, dans le menu...
  // et on rappelle comment viser quand on vient de descendre
  let lastMode = G.mode, footT = 0;
  setInterval(() => {
    if (locked && !mouseLook()) document.exitPointerLock();
    if (G.mode === 'foot' && lastMode !== 'foot') footT = performance.now();
    lastMode = G.mode;
    if (footT && G.state === 'play' && G.mode === 'foot' && !locked && performance.now() - footT > 2200) {
      footT = 0;
      showMessage('🖱️ Clique dans le jeu pour viser à la souris (Échap = libérer)', '#7df9ff', 2.8);
    }
  }, 250);
}
