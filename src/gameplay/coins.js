// =====================================================
//  PIÈCES 🪙 : à ramasser en voiture ou à pied
// =====================================================
import { G } from '../core/ctx.js';
import { save, persist } from '../core/save.js';
import { coins } from '../world/city.js';
import { burst } from '../fx/particles.js';
import { whereAmI } from './where.js';
import { showMessage, refreshStats } from '../ui/hud.js';
import { sfx } from '../ui/audio.js';

G.coinsTaken = 0;

export function resetCoins() {
  G.coinsTaken = 0;
  for (const c of coins) { c.taken = false; c.mesh.visible = true; }
  refreshStats();
}

export function updateCoins(dt, t) {
  const me = G.state === 'play' ? whereAmI() : null;
  const r2 = G.mode === 'foot' ? 4 : 10; // distance pour l'attraper (au carré)
  for (const c of coins) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 3;
    c.mesh.position.y = c.y + Math.sin(t * 3 + c.x) * 0.25;
    if (!me) continue;
    const dx = me.x - c.x, dz = me.z - c.z, dy = me.y + 1 - c.mesh.position.y;
    if (dx * dx + dz * dz > r2 || Math.abs(dy) > 3) continue;
    c.taken = true; c.mesh.visible = false; G.coinsTaken++;
    save.money += 100;
    burst(c.x, c.mesh.position.y, c.z, '#ffd23a', 16, 8);
    sfx('coin', 0.8);
    if (G.coinsTaken >= coins.length) {
      save.money += 2000;
      showMessage('TOUTES LES PIÈCES ! +2000 $', '#ffd23a', 3);
      setTimeout(resetCoins, 3000);
    } else showMessage('+100 $', '#ffd23a', 0.7);
    persist(); refreshStats();
  }
}
