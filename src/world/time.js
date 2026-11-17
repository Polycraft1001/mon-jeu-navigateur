// =====================================================
//  MOMENT DE LA JOURNÉE (jour / soir / nuit)
// =====================================================
import { TIME_SET } from '../core/config.js';
import { G } from '../core/ctx.js';
import { renderer, scene, bloom, hemi, sun, sunOffset, skyUniforms, stars, clouds, cloudMat, mountainMat, envMats, refreshEnv } from '../render/engine.js';
import { windowMats, neonMats, lampHeadMat, antennaMat, poolMat, pools } from './city.js';
import { tHead, tTail } from '../vehicles/models.js';
import { updateCarLights } from '../vehicles/driving.js';

export function applyTime(id) {
  const T = TIME_SET[id] || TIME_SET.day;
  G.time = T;
  skyUniforms.top.value.set(T.skyTop);
  skyUniforms.bottom.value.set(T.skyBot);
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
  updateCarLights();
  return refreshEnv(TIME_SET[id] ? id : 'day'); // vrai ciel HDR pour les reflets
}
