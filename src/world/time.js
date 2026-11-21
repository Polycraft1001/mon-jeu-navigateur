// =====================================================
//  MOMENT DE LA JOURNÉE (jour / soir / nuit)
// =====================================================
import { TIME_SET } from '../core/config.js';
import { G } from '../core/ctx.js';
import { renderer, scene, bloom, grade, hemi, sun, sunOffset, skyUniforms, stars, clouds, cloudMat, mountainMat, envMats, refreshEnv } from '../render/engine.js';
import { windowMats, neonMats, lampHeadMat, antennaMat, poolMat, pools } from './city.js';
import { tHead, tTail } from '../vehicles/models.js';
import { updateCarLights } from '../vehicles/driving.js';

// Finitions visuelles de chaque moment :
// horizon = bande lumineuse au ras du sol, disc = couleur du soleil (ou de la lune),
// sunSize = taille du disque (plus proche de 1 = plus petit), glow = halo autour,
// sat / contrast / tint = étalonnage des couleurs (ordinateur seulement)
const LOOK = {
  day: { horizon: '#fff1f6', disc: '#fff6e0', sunSize: 0.9994, glow: 0.6, sat: 1.08, contrast: 1.04, tint: [1.0, 1.0, 1.0] },
  sunset: { horizon: '#ffc48a', disc: '#ffb070', sunSize: 0.999, glow: 1.4, sat: 1.12, contrast: 1.05, tint: [1.03, 0.99, 0.95] },
  night: { horizon: '#2a3466', disc: '#dfe6ff', sunSize: 0.99975, glow: 0.25, sat: 1.04, contrast: 1.06, tint: [0.95, 0.98, 1.06] },
};

export function applyTime(id) {
  const key = TIME_SET[id] ? id : 'day';
  const T = TIME_SET[key];
  const L = LOOK[key] || LOOK.day;
  G.time = T;

  // ciel
  skyUniforms.top.value.set(T.skyTop);
  skyUniforms.bottom.value.set(T.skyBot);
  skyUniforms.horizon.value.set(L.horizon);
  skyUniforms.sunDir.value.set(T.sunPos[0], T.sunPos[1], T.sunPos[2]).normalize();
  skyUniforms.sunColor.value.set(L.disc);
  skyUniforms.sunSize.value = L.sunSize;
  skyUniforms.glow.value = L.glow;

  if (scene.fog) { scene.fog.color.set(T.fog); scene.fog.near = T.fogNear; scene.fog.far = T.fogFar; }
  hemi.intensity = T.hemi; hemi.color.set(T.hemiSky); hemi.groundColor.set(T.hemiGround);
  sun.intensity = T.sun; sun.color.set(T.sunColor); sunOffset.set(T.sunPos[0], T.sunPos[1], T.sunPos[2]);
  for (const m of windowMats) m.emissiveIntensity = T.win;
  for (const m of neonMats) m.emissiveIntensity = T.neon;
  for (const m of envMats) m.envMapIntensity = T.env;
  lampHeadMat.emissiveIntensity = T.lamp;
  antennaMat.emissiveIntensity = T.lamp > 1 ? 3 : 0.6;
  poolMat.opacity = T.pool;
  if (pools) pools.visible = T.pool > 0;
  tHead.emissiveIntensity = T.head;
  tTail.emissiveIntensity = T === TIME_SET.day ? 0.4 : 1.2;
  stars.visible = T.stars;
  clouds.visible = T.clouds; cloudMat.color.set(T.cloud);
  mountainMat.color.set(T.mountain);
  renderer.toneMappingExposure = T.exposure;
  if (bloom) { bloom.strength = T.bloom[0]; bloom.radius = T.bloom[1]; bloom.threshold = T.bloom[2]; }
  if (grade) {
    grade.uniforms.saturation.value = L.sat;
    grade.uniforms.contrast.value = L.contrast;
    grade.uniforms.tint.value.set(L.tint[0], L.tint[1], L.tint[2]);
  }
  document.body.dataset.time = key; // l'interface (CSS) s'adapte aussi au moment
  updateCarLights();
  return refreshEnv(key); // vrai ciel HDR pour les reflets
}
