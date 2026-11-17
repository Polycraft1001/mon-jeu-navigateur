// =====================================================
//  Où est le joueur ? Dans sa voiture ou à pied.
//  Renvoie toujours le même objet {x, y, z, h} (pas de déchets mémoire).
// =====================================================
import { G } from '../core/ctx.js';
import { player } from '../vehicles/driving.js';
import { hero } from './onfoot.js';

const me = { x: 0, y: 0, z: 0, h: 0 };
export function whereAmI() {
  if (G.mode === 'foot') { me.x = hero.pos.x; me.y = hero.pos.y; me.z = hero.pos.z; me.h = hero.h; }
  else { me.x = player.pos.x; me.y = player.y; me.z = player.pos.z; me.h = player.h; }
  return me;
}
