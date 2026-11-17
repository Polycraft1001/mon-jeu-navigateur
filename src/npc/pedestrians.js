// =====================================================
//  PIÉTONS (PNJ) avec physique "ragdoll"
//  Chaque piéton = squelette de 15 points reliés par des bâtons
//  (physique de Verlet). Ils marchent autour des pâtés de maisons,
//  traversent, s'enfuient quand on klaxonne ou qu'on tire, tombent
//  quand on les percute ou les touche... puis se relèvent !
//  (pas de sang, personne ne meurt)
//
//  const peds = createPedestrians({...})
//    peds.update(dt, cars)     -> nb de piétons renversés par le joueur
//    peds.scare(x, z, r)       -> les piétons proches s'enfuient
//    peds.obstacles()          -> piétons sur la route (pour la circulation)
//    peds.raycast(o, d, maxT)  -> { p, t } : piéton touché par un rayon
//    peds.shoot(p, dir, force) -> le piéton touché tombe
//    peds.blast(x, y, z, r, f) -> souffle d'explosion
//    peds.launch(p, vx, vy, vz)-> projette un piéton
//    peds.center(p, out)       -> centre du corps (Vector3)
//    peds.list                 -> tous les piétons
//  Format d'une voiture dans "cars" :
//    { player, soft, x, z, y, h, vx, vz, speed, W, L, top }
//    (soft = obstacle qui pousse sans renverser, ex. le héros à pied)
// =====================================================
import * as THREE from 'three';

const HEAD = 0, NECK = 1, LSH = 2, RSH = 3, LEL = 4, LHA = 5, REL = 6, RHA = 7;
const PEL = 8, LHI = 9, RHI = 10, LKN = 11, LFO = 12, RKN = 13, RFO = 14, NP = 15;
const LOWER = new Set([PEL, LHI, RHI, LKN, LFO, RKN, RFO]);

// Liens du squelette (le torse est rigide, les bras et jambes sont souples)
const LINKS = [
  [HEAD, NECK], [HEAD, LSH], [HEAD, RSH], [NECK, LSH], [NECK, RSH], [LSH, RSH],
  [LSH, LHI], [RSH, RHI], [LSH, RHI], [RSH, LHI], [LHI, RHI], [PEL, LHI], [PEL, RHI], [NECK, PEL],
  [LSH, LEL], [LEL, LHA], [RSH, REL], [REL, RHA],
  [LHI, LKN], [LKN, LFO], [RHI, RKN], [RKN, RFO],
];
// Morceaux dessinés : [point A, point B, épaisseur, couleur (0 haut, 1 avant-bras, 2 pantalon)]
const SEGS = [
  [LSH, LEL, 0.065, 0], [LEL, LHA, 0.055, 1], [RSH, REL, 0.065, 0], [REL, RHA, 0.055, 1],
  [LHI, LKN, 0.085, 2], [LKN, LFO, 0.075, 2], [RHI, RKN, 0.085, 2], [RKN, RFO, 0.075, 2],
];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#5c3a21'];
const SHIRT = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#ffffff', '#222222', '#8338ec', '#ffb703', '#06d6a0', '#ef476f', '#3a86ff'];
const PANTS = ['#1d3557', '#222222', '#4a4e69', '#6b705c', '#3d405b', '#a68a64', '#264653'];
const HAIR = ['#1a1a1a', '#3b2314', '#6b4423', '#d8b46a', '#b5502c', '#9e9e9e'];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const STEP = 1 / 120, GRAV = -20;
const UP = new THREE.Vector3(0, 1, 0);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Pose de marche (ph = phase du pas, amp = 0 immobile ... 1.5 course)
function pose(P, x, gy, z, h, ph, amp) {
  const fx = -Math.sin(h), fz = -Math.cos(h), rx = -fz, rz = fx;
  const set = (i, f, r, y) => { P[i * 3] = x + fx * f + rx * r; P[i * 3 + 1] = gy + y; P[i * 3 + 2] = z + fz * f + rz * r; };
  const s = Math.sin(ph), c = Math.cos(ph);
  const bob = Math.abs(c) * 0.035 * amp, lean = 0.06 * amp, hy = 0.94 + bob, sy = 1.42 + bob;
  set(PEL, 0, 0, hy + 0.04); set(LHI, 0, -0.11, hy); set(RHI, 0, 0.11, hy);
  set(NECK, lean, 0, 1.47 + bob); set(LSH, lean, -0.2, sy); set(RSH, lean, 0.2, sy);
  set(HEAD, lean + 0.03, 0, 1.68 + bob);
  const leg = (kn, fo, r, a, bend) => {
    const kf = 0.46 * Math.sin(a), ky = hy - 0.46 * Math.cos(a);
    set(kn, kf, r, ky);
    set(fo, kf + 0.46 * Math.sin(a - bend), r, Math.max(0.06, ky - 0.46 * Math.cos(a - bend)));
  };
  leg(LKN, LFO, -0.11, s * 0.5 * amp, Math.max(0, c) * 0.9 * amp);
  leg(RKN, RFO, 0.11, -s * 0.5 * amp, Math.max(0, -c) * 0.9 * amp);
  const arm = (el, ha, r, a, bend) => {
    const ef = lean + 0.29 * Math.sin(a), ey = sy - 0.29 * Math.cos(a);
    set(el, ef, r, ey);
    set(ha, ef + 0.28 * Math.sin(a + bend), r, ey - 0.28 * Math.cos(a + bend));
  };
  arm(LEL, LHA, -0.23, -s * 0.45 * amp, 0.2 + 0.5 * amp);
  arm(REL, RHA, 0.23, s * 0.45 * amp, 0.2 + 0.5 * amp);
}

export function createPedestrians({ scene, N, BLOCK, CELL, blockCenter, colliders, count, shadows }) {
  const PATH = BLOCK / 2 - 2; // les piétons marchent à 2 m du bord du trottoir
  const first = blockCenter(0) - BLOCK / 2;
  const inB = (v) => { const t = v - first; return t >= 0 && t <= N * CELL - (CELL - BLOCK) && (t % CELL) <= BLOCK; };
  const groundY = (x, z) => (inB(x) && inB(z) ? 0.24 : 0);

  // ----- Maillages instanciés (4 objets pour tous les piétons = rapide) -----
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const mk = (geo, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    m.castShadow = shadows;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    return m;
  };
  const limbs = mk(new THREE.CylinderGeometry(1, 1, 1, 7), count * 8);
  const torsos = mk(new THREE.BoxGeometry(1, 1, 1), count);
  const heads = mk(new THREE.SphereGeometry(1, 12, 10), count);
  const hairs = mk(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), count);

  const cornerPos = (bi, bj, k) => ({ x: blockCenter(bi) + CORNERS[k][0] * PATH, z: blockCenter(bj) + CORNERS[k][1] * PATH });
  const setT = (p) => { const c = cornerPos(p.bi, p.bj, p.k); p.tx = c.x; p.tz = c.z; };

  const peds = [];
  const col = new THREE.Color();
  for (let n = 0; n < count; n++) {
    const p = {
      P: new Float32Array(NP * 3), Q: new Float32Array(NP * 3), S: new Float32Array(NP * 3), T: new Float32Array(NP * 3),
      rest: null, near: [], mode: 'walk', x: 0, z: 0, h: 0, tx: 0, tz: 0, bi: 0, bj: 0, k: 0, dir: 1, crossing: false,
      phase: Math.random() * 6, base: 1.1 + Math.random() * 0.5, run: 0, dodge: 0, dvx: 0, dvz: 0, cd: 0, t: 0, still: 0, acc: 0,
    };
    p.bi = Math.floor(Math.random() * N); p.bj = Math.floor(Math.random() * N);
    p.dir = Math.random() < 0.5 ? 1 : -1;
    const k0 = Math.floor(Math.random() * 4);
    p.k = (k0 + p.dir + 4) % 4;
    const a = cornerPos(p.bi, p.bj, k0); setT(p);
    const t = Math.random();
    p.x = a.x + (p.tx - a.x) * t; p.z = a.z + (p.tz - a.z) * t;
    p.h = Math.atan2(-(p.tx - a.x), -(p.tz - a.z));
    pose(p.P, p.x, groundY(p.x, p.z), p.z, p.h, p.phase, 0.9);
    const skin = pick(SKIN), shirt = pick(SHIRT), pants = pick(PANTS), shortSleeve = Math.random() < 0.5;
    for (let s = 0; s < 8; s++) {
      const kind = SEGS[s][3];
      limbs.setColorAt(n * 8 + s, col.set(kind === 2 ? pants : (kind === 1 && shortSleeve) ? skin : shirt));
    }
    torsos.setColorAt(n, col.set(shirt));
    heads.setColorAt(n, col.set(skin));
    hairs.setColorAt(n, col.set(pick(HAIR)));
    peds.push(p);
  }

  // Arrivé à un coin : on continue autour du pâté ou on traverse la route
  function arrive(p) {
    if (p.crossing) p.crossing = false;
    else if (Math.random() < 0.3) {
      const c = CORNERS[p.k], opts = [];
      if (p.bi + c[0] >= 0 && p.bi + c[0] < N) opts.push([p.bi + c[0], p.bj, CORNERS.findIndex((q) => q[0] === -c[0] && q[1] === c[1])]);
      if (p.bj + c[1] >= 0 && p.bj + c[1] < N) opts.push([p.bi, p.bj + c[1], CORNERS.findIndex((q) => q[0] === c[0] && q[1] === -c[1])]);
      if (opts.length) {
        const o = pick(opts);
        p.bi = o[0]; p.bj = o[1]; p.k = o[2]; p.crossing = true;
        setT(p);
        return;
      }
    }
    if (Math.random() < 0.15) p.dir = -p.dir;
    p.k = (p.k + p.dir + 4) % 4;
    setT(p);
  }

  // obstacles solides proches (les arbres / lampadaires cassés ont h <= 0)
  const solidNear = (x, z, r) => colliders.filter((b) => b.h > 0 && b.maxX > x - r && b.minX < x + r && b.maxZ > z - r && b.minZ < z + r);

  // Passage en mode ragdoll (le corps devient "mou")
  function toRag(p) {
    const P = p.P;
    if (p.mode !== 'rag') {
      p.mode = 'rag'; p.t = 0; p.still = 0; p.acc = 0; p.crossing = false; p.dodge = 0;
      p.rest = LINKS.map(([a, b]) => Math.hypot(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]));
      p.Q.set(P); // vitesse nulle au départ
    }
    p.near = solidNear(P[PEL * 3], P[PEL * 3 + 2], 30);
  }

  // Percuté par une voiture
  function knock(p, c) {
    toRag(p);
    const P = p.P, Q = p.Q;
    const sp = Math.hypot(c.vx, c.vz);
    for (let i = 0; i < NP; i++) {
      const low = LOWER.has(i);
      const k = low ? 1.1 : 0.55;
      const up = (low ? 1.5 + sp * 0.05 : 2.5 + sp * 0.13) * (0.8 + Math.random() * 0.4);
      const vx = c.vx * k + (Math.random() - 0.5) * 1.5, vz = c.vz * k + (Math.random() - 0.5) * 1.5;
      Q[i * 3] = P[i * 3] - vx * STEP;
      Q[i * 3 + 1] = P[i * 3 + 1] - up * STEP;
      Q[i * 3 + 2] = P[i * 3 + 2] - vz * STEP;
    }
  }

  // Projette un piéton (ajoute une vitesse). low = part donnée aux jambes
  function launch(p, vx, vy, vz, low = 0.6) {
    toRag(p);
    p.t = Math.min(p.t, 1); p.still = 0;
    const Q = p.Q;
    for (let i = 0; i < NP; i++) {
      const k = LOWER.has(i) ? low : 1, j = i * 3;
      Q[j] -= (vx * k + (Math.random() - 0.5) * 0.8) * STEP;
      Q[j + 1] -= vy * k * STEP;
      Q[j + 2] -= (vz * k + (Math.random() - 0.5) * 0.8) * STEP;
    }
  }

  // Touché par un tir ou un coup de poing : il tombe à la renverse
  function shoot(p, dir, force = 5) {
    const l = Math.hypot(dir.x, dir.z) || 1;
    launch(p, dir.x / l * force, 1 + force * 0.15, dir.z / l * force, 0.3);
  }

  function walk(p, dt, cars) {
    if (p.run > 0) p.run -= dt;
    if (p.cd > 0) p.cd -= dt;
    const sp = p.run > 0 ? 4.6 : p.base;
    let dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.4) { arrive(p); dx = p.tx - p.x; dz = p.tz - p.z; d = Math.hypot(dx, dz); }
    if (d > 0.001) { const st = Math.min(d, sp * dt); p.x += dx / d * st; p.z += dz / d * st; }
    if (p.dodge > 0) { p.dodge -= dt; p.x += p.dvx * dt; p.z += p.dvz * dt; }
    p.h += angleDiff(p.h, Math.atan2(-dx, -dz)) * Math.min(1, dt * 8);
    p.phase += dt * sp * 4;
    pose(p.P, p.x, groundY(p.x, p.z), p.z, p.h, p.phase, Math.min(1.5, 0.6 + sp * 0.2));

    let hitByPlayer = false;
    for (const c of cars) {
      const ox = p.x - c.x, oz = p.z - c.z;
      if (ox * ox + oz * oz > 900) continue;
      const cs = Math.cos(c.h), sn = Math.sin(c.h);
      const lx = ox * cs - oz * sn, lz = ox * sn + oz * cs;
      const csp = Math.hypot(c.vx, c.vz);
      // le piéton voit la voiture arriver et plonge sur le côté
      if (c.player && !c.soft && csp > 8 && p.cd <= 0 && p.dodge <= 0) {
        const ahead = c.speed >= 0 ? -lz : lz;
        if (ahead > 2 && ahead < 6 + csp * 0.5 && Math.abs(lx) < c.W / 2 + 1) {
          p.cd = 2.5;
          if (Math.random() < 0.6) {
            const s = lx >= 0 ? 1 : -1;
            p.dvx = cs * s * 5.5; p.dvz = -sn * s * 5.5; p.dodge = 0.5; p.run = 4;
          }
        }
      }
      if (Math.abs(lx) < c.W / 2 + 0.3 && Math.abs(lz) < c.L / 2 + 0.3 && c.y < 1.2) {
        if (csp > 2.5 && !c.soft) { knock(p, c); if (c.player) hitByPlayer = true; break; }
        const s = lx >= 0 ? 1 : -1, push = c.W / 2 + 0.3 - Math.abs(lx);
        p.x += cs * s * push; p.z -= sn * s * push;
      }
    }
    return hitByPlayer;
  }

  function stepRag(p, near) {
    const P = p.P, Q = p.Q;
    for (let j = 0; j < NP * 3; j += 3) {
      const vx = (P[j] - Q[j]) * 0.996, vy = (P[j + 1] - Q[j + 1]) * 0.996, vz = (P[j + 2] - Q[j + 2]) * 0.996;
      Q[j] = P[j]; Q[j + 1] = P[j + 1]; Q[j + 2] = P[j + 2];
      P[j] += vx; P[j + 1] += vy + GRAV * STEP * STEP; P[j + 2] += vz;
    }
    for (let it = 0; it < 4; it++) {
      for (let l = 0; l < LINKS.length; l++) {
        const a = LINKS[l][0] * 3, b = LINKS[l][1] * 3;
        const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;
        const f = (d - p.rest[l]) / d * 0.5;
        P[a] += dx * f; P[a + 1] += dy * f; P[a + 2] += dz * f;
        P[b] -= dx * f; P[b + 1] -= dy * f; P[b + 2] -= dz * f;
      }
      for (let i = 0; i < NP; i++) {
        const j = i * 3, gy = groundY(P[j], P[j + 2]) + (i === HEAD ? 0.13 : 0.07);
        if (P[j + 1] < gy) P[j + 1] = gy;
      }
    }
    for (let i = 0; i < NP; i++) {
      const j = i * 3;
      // sol : frottement + petit rebond
      const gy = groundY(P[j], P[j + 2]) + (i === HEAD ? 0.13 : 0.07);
      if (P[j + 1] <= gy + 0.002) {
        Q[j] = P[j] - (P[j] - Q[j]) * 0.8;
        Q[j + 2] = P[j + 2] - (P[j + 2] - Q[j + 2]) * 0.8;
        const vy = P[j + 1] - Q[j + 1];
        if (vy < 0) Q[j + 1] = P[j + 1] + vy * 0.3;
      }
      // voitures : le corps roule sur le capot ou est poussé
      for (const c of near) {
        const y = P[j + 1];
        if (y < c.y - 0.1 || y > c.y + c.top) continue;
        const dx = P[j] - c.x, dz = P[j + 2] - c.z, cs = Math.cos(c.h), sn = Math.sin(c.h);
        const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs, hw = c.W / 2 + 0.05, hl = c.L / 2 + 0.05;
        if (Math.abs(lx) > hw || Math.abs(lz) > hl) continue;
        const px = hw - Math.abs(lx), pz = hl - Math.abs(lz), py = c.y + c.top - y;
        if (py < px && py < pz) {
          P[j + 1] = c.y + c.top;
          Q[j + 1] = Math.min(Q[j + 1], P[j + 1]);
          Q[j] = P[j] - c.vx * STEP * 0.5; Q[j + 2] = P[j + 2] - c.vz * STEP * 0.5;
        } else {
          let nlx = lx, nlz = lz;
          if (px < pz) nlx = (lx >= 0 ? 1 : -1) * hw; else nlz = (lz >= 0 ? 1 : -1) * hl;
          P[j] = c.x + nlx * cs + nlz * sn; P[j + 2] = c.z - nlx * sn + nlz * cs;
          Q[j] = P[j] - c.vx * STEP; Q[j + 2] = P[j + 2] - c.vz * STEP;
        }
      }
      // murs, maisons, arbres (ceux qui sont encore debout)
      for (const b of p.near) {
        if (b.h <= 0 || P[j + 1] > b.h) continue;
        const x = P[j], z = P[j + 2];
        if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
        const l = x - b.minX, r = b.maxX - x, t = z - b.minZ, bo = b.maxZ - z, m = Math.min(l, r, t, bo);
        if (m === l) P[j] = b.minX - 0.01; else if (m === r) P[j] = b.maxX + 0.01;
        else if (m === t) P[j + 2] = b.minZ - 0.01; else P[j + 2] = b.maxZ + 0.01;
        Q[j] = P[j]; Q[j + 2] = P[j + 2];
      }
    }
  }

  function ragdoll(p, dt, cars) {
    const P = p.P, Q = p.Q;
    const px = P[PEL * 3], pz = P[PEL * 3 + 2];
    const near = cars.filter((c) => !c.soft && Math.abs(c.x - px) < 10 && Math.abs(c.z - pz) < 10);
    p.acc = Math.min(p.acc + dt, STEP * 10);
    while (p.acc >= STEP) { p.acc -= STEP; stepRag(p, near); }
    p.t += dt;
    let mv = 0;
    for (let j = 0; j < NP * 3; j += 3) mv = Math.max(mv, Math.abs(P[j] - Q[j]) + Math.abs(P[j + 1] - Q[j + 1]) + Math.abs(P[j + 2] - Q[j + 2]));
    if (mv / STEP < 0.6) p.still += dt; else p.still = 0;
    if ((p.still > 1.5 && p.t > 2) || p.t > 9) {
      // il se relève et retourne sur le trottoir le plus proche (en courant !)
      p.mode = 'getup'; p.t = 0;
      p.S.set(P);
      p.x = px; p.z = pz;
      p.bi = Math.max(0, Math.min(N - 1, Math.round((px - blockCenter(0)) / CELL)));
      p.bj = Math.max(0, Math.min(N - 1, Math.round((pz - blockCenter(0)) / CELL)));
      let best = 0, bd = Infinity;
      for (let k = 0; k < 4; k++) { const c = cornerPos(p.bi, p.bj, k), d = Math.hypot(c.x - px, c.z - pz); if (d < bd) { bd = d; best = k; } }
      p.k = best; p.dir = Math.random() < 0.5 ? 1 : -1; setT(p);
      p.h = Math.atan2(-(p.tx - px), -(p.tz - pz));
    }
  }

  function getUp(p, dt) {
    p.t += dt;
    const t = Math.min(1, p.t / 1.1), e = t * t * (3 - 2 * t);
    pose(p.T, p.x, groundY(p.x, p.z), p.z, p.h, 0, 0);
    for (let j = 0; j < NP * 3; j++) p.P[j] = p.S[j] + (p.T[j] - p.S[j]) * e;
    if (t >= 1) { p.mode = 'walk'; p.cd = 1; p.run = 3; }
  }

  // ----- Dessin -----
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3();
  const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _c = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const vp = (out, P, i) => out.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  function draw(p, n) {
    const P = p.P;
    for (let s = 0; s < 8; s++) {
      const [a, b, r] = SEGS[s];
      vp(_a, P, a); vp(_b, P, b); _d.subVectors(_b, _a);
      const len = _d.length() || 0.001;
      _d.divideScalar(len);
      _q.setFromUnitVectors(UP, _d);
      _a.add(_b).multiplyScalar(0.5);
      _m.compose(_a, _q, _s.set(r, len + r, r));
      limbs.setMatrixAt(n * 8 + s, _m);
    }
    vp(_a, P, LSH); vp(_b, P, RSH); _x.subVectors(_b, _a);
    _a.add(_b).multiplyScalar(0.5);
    vp(_b, P, LHI); vp(_d, P, RHI); _b.add(_d).multiplyScalar(0.5);
    _y.subVectors(_a, _b);
    const tl = _y.length() || 0.001;
    _y.divideScalar(tl);
    _x.addScaledVector(_y, -_x.dot(_y)).normalize();
    _z.crossVectors(_x, _y);
    _d.addVectors(_a, _b).multiplyScalar(0.5);
    _m.makeBasis(_x, _y, _z); _m.scale(_s.set(0.38, tl + 0.14, 0.22)); _m.setPosition(_d);
    torsos.setMatrixAt(n, _m);
    vp(_d, P, HEAD);
    _m.makeBasis(_x, _y, _z); _m.scale(_s.set(0.13, 0.14, 0.13)); _m.setPosition(_d);
    heads.setMatrixAt(n, _m);
    _d.addScaledVector(_y, 0.015);
    _m.makeBasis(_x, _y, _z); _m.scale(_s.set(0.14, 0.15, 0.14)); _m.setPosition(_d);
    hairs.setMatrixAt(n, _m);
  }

  function update(dt, cars) {
    let hits = 0;
    for (let n = 0; n < peds.length; n++) {
      const p = peds[n];
      if (p.mode === 'walk') { if (walk(p, dt, cars)) hits++; }
      else if (p.mode === 'rag') ragdoll(p, dt, cars);
      else getUp(p, dt);
      draw(p, n);
    }
    limbs.instanceMatrix.needsUpdate = torsos.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = hairs.instanceMatrix.needsUpdate = true;
    return hits;
  }

  // Klaxon / coups de feu : les piétons proches s'enfuient en courant
  function scare(x, z, r) {
    for (const p of peds) {
      if (p.mode !== 'walk') continue;
      const dx = p.x - x, dz = p.z - z;
      if (dx * dx + dz * dz > r * r) continue;
      p.run = 5;
      if (!p.crossing && (p.tx - p.x) * (x - p.x) + (p.tz - p.z) * (z - p.z) > 0) {
        p.k = (p.k - p.dir + 4) % 4; p.dir = -p.dir; setT(p);
      }
    }
  }

  // Centre du corps (milieu entre le bassin et le cou)
  function center(p, out = new THREE.Vector3()) {
    const P = p.P;
    return out.set((P[PEL * 3] + P[NECK * 3]) / 2, (P[PEL * 3 + 1] + P[NECK * 3 + 1]) / 2, (P[PEL * 3 + 2] + P[NECK * 3 + 2]) / 2);
  }

  // Rayon (origine o, direction d normalisée) contre les piétons.
  // Debout = ellipsoïde haute, par terre = ellipsoïde aplatie.
  function raycast(o, d, maxT, standingOnly = false) {
    let best = maxT, hit = null;
    for (const p of peds) {
      if (standingOnly && p.mode !== 'walk') continue;
      let cx, cy, cz, rx, ry;
      if (p.mode === 'walk') { cx = p.x; cy = groundY(p.x, p.z) + 0.9; cz = p.z; rx = 0.38; ry = 0.92; }
      else { center(p, _c); cx = _c.x; cy = _c.y; cz = _c.z; rx = 0.6; ry = 0.45; }
      const qx = o.x - cx, qz = o.z - cz;
      if (qx * qx + qz * qz > (maxT + 2) * (maxT + 2)) continue;
      const ox = qx / rx, oy = (o.y - cy) / ry, oz = qz / rx;
      const dx = d.x / rx, dy = d.y / ry, dz = d.z / rx;
      const a = dx * dx + dy * dy + dz * dz, b = ox * dx + oy * dy + oz * dz, c = ox * ox + oy * oy + oz * oz - 1;
      const disc = b * b - a * c;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / a;
      if (t > 0 && t < best) { best = t; hit = p; }
    }
    return hit ? { p: hit, t: best } : null;
  }

  // Souffle d'explosion : tout le monde vole (et se relève plus tard)
  function blast(x, y, z, r, force) {
    let n = 0;
    for (const p of peds) {
      center(p, _c);
      const dx = _c.x - x, dz = _c.z - z, d = Math.hypot(dx, _c.y - y, dz);
      if (d > r) continue;
      const f = force * (1 - d / r) + 2, h = Math.hypot(dx, dz) || 1;
      launch(p, dx / h * f, f * 0.7 + 3, dz / h * f, 0.8);
      n++;
    }
    return n;
  }

  // Piétons sur la route (les voitures s'arrêtent pour eux)
  const obs = [];
  function obstacles() {
    obs.length = 0;
    for (const p of peds) {
      const x = p.mode === 'walk' ? p.x : p.P[PEL * 3], z = p.mode === 'walk' ? p.z : p.P[PEL * 3 + 2];
      if (groundY(x, z) === 0) obs.push({ x, z });
    }
    return obs;
  }

  peds.forEach(draw);
  return { update, scare, obstacles, raycast, shoot, launch, blast, center, list: peds };
}
