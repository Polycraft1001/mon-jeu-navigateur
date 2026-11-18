// =====================================================
//  LES AUTRES VILLES 🗺️ — chacune a son style « bonbon »
//  🍭 SUCREVILLE (à l'est)    : maisons en pain d'épices, cupcakes,
//                                glaces géantes, sucettes, sucres d'orge
//  🌵 CACTUS CITY (à l'ouest) : Far-West, saloons, cactus, château d'eau
//  ❄️ NEIGEVILLE (au nord)    : chalets, sapins, bonshommes de neige
//  Pour y aller : suis la grande route du milieu qui sort
//  de la ville par l'est, l'ouest ou le nord.
//  ➜ Positions et taille : TOWNS dans world/terrain.js
// =====================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOWNS, terrainHeight, inFlatZone } from './terrain.js';
import { roundBox, candyMat, stripeTex, swirlTex, labelTex } from '../core/shapes.js';

let H = null, G = null;   // outils de la grande ville + groupe 3D des villes
let winMat = null, glowMat = null;
const D = new THREE.Object3D(), C = new THREE.Color();
const rr = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const plain = (color, rough = 0.4) => new THREE.MeshStandardMaterial({ color, roughness: rough });

const GEO = {
  ball: new THREE.SphereGeometry(1, 18, 12),
  hemi: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20).translate(0, 0.5, 0),
  cup: new THREE.CylinderGeometry(1, 0.82, 1, 24).translate(0, 0.5, 0),
  cone: new THREE.ConeGeometry(1, 1, 20).translate(0, 0.5, 0),
  disc: new THREE.CylinderGeometry(1, 1, 0.25, 28).rotateX(Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.4, 14, 32),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  prism: (() => { // toit en triangle (le faîte suit l'axe z)
    const s = new THREE.Shape();
    s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  })(),
};

// ----- Petits outils -----
function add(geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, parent = G, shadow = true) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z); o.scale.set(sx, sy, sz);
  o.castShadow = shadow; o.receiveShadow = true;
  parent.add(o);
  return o;
}
const rb = (w, h, d, r, mat, x, y, z, parent = G) => add(roundBox(w, h, d, r), mat, x, y, z, 1, 1, 1, parent);
// un « terrain » de maison : groupe tourné pour que la façade (+z) regarde la rue
function lot(x, z, ry) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.add(g); return g; }
// beaucoup de copies d'un même objet en un seul dessin (rapide !)
// list = [[x, y, z, sx, sy, sz, ry], ...] · colors = couleurs au hasard
function many(geo, mat, list, colors) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((p, k) => {
    const s = p[3] ?? 1;
    D.position.set(p[0], p[1], p[2]); D.scale.set(s, p[4] ?? s, p[5] ?? s); D.rotation.set(0, p[6] || 0, 0);
    D.updateMatrix();
    im.setMatrixAt(k, D.matrix);
    if (colors) im.setColorAt(k, C.set(pick(colors)));
  });
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  G.add(im);
  return im;
}
// bandes plates au sol (routes, pointillés) : [x, z, largeur, longueur]
function strips(list, color, y) {
  const im = many(GEO.plane, plain(color, 0.9), list.map(([x, z, w, d]) => [x, y, z, w, 1, d]));
  if (im) im.castShadow = false;
}
const signCache = {};
function signMat(text, bg, fg) {
  const k = text + bg;
  if (!signCache[k]) signCache[k] = new THREE.MeshStandardMaterial({ map: labelTex(text, bg, fg), roughness: 0.6 });
  return signCache[k];
}
function sign(parent, text, bg, w, h, x, y, z) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMat(text, bg));
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

// ----- Emplacements -----
const LOTS = [-72, -34, 34, 72];
// 16 terrains de maisons autour des 2 rues en croix
function eachLot(t, fn) {
  for (const gx of LOTS) for (const gz of LOTS) {
    // la façade regarde la rue la plus proche
    const fx = Math.abs(gx) <= Math.abs(gz) ? -Math.sign(gx) : 0, fz = fx ? 0 : -Math.sign(gz);
    fn(t.x + gx, t.z + gz, Math.atan2(fx, fz));
  }
}
// places libres dans la ville (pas sur les rues ni les maisons)
function decorSpots(t, n) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 30) {
    const x = rr(-t.hw + 8, t.hw - 8), z = rr(-t.hw + 8, t.hw - 8);
    if (Math.abs(x) < 13 || Math.abs(z) < 13 || Math.hypot(x, z) < 28) continue;
    if (LOTS.some((a) => Math.abs(x - a) < 16) && LOTS.some((b) => Math.abs(z - b) < 16)) continue;
    out.push([t.x + x, t.z + z]);
  }
  return out;
}
// places dans la nature autour de la ville (sur les collines)
function wildSpots(t, n) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 30) {
    const x = t.x + rr(-t.hw - 420, t.hw + 420), z = t.z + rr(-t.hw - 420, t.hw + 420);
    if (Math.max(Math.abs(x), Math.abs(z)) < H.half + 30) continue;     // pas dans la grande ville
    if (Math.max(Math.abs(x), Math.abs(z)) > H.limit - 20) continue;    // pas au bord du monde
    if (inFlatZone(x, z, 6)) continue;                                  // pas sur les routes / villes
    const y = terrainHeight(x, z);
    if (y > 75) continue;
    out.push([x, y, z]);
  }
  return out;
}
// le long de la route qui vient de la grande ville
function roadside(t, step = 40) {
  const rd = t.road, out = [], sg = rd.alongX ? Math.sign(rd.x) : Math.sign(rd.z);
  for (let d = rd.from + 25; d < rd.to - 10; d += step) for (const o of [-12, 12]) {
    const x = rd.alongX ? sg * d : rd.x + o, z = rd.alongX ? rd.z + o : sg * d;
    out.push([x, terrainHeight(x, z), z]);
  }
  return out;
}

// ----- Ce qui est pareil dans toutes les villes : sol, rues, lampadaires, arche, pièces -----
function frame(t) {
  const S = t.hw, st = t.style, a = S + 15, r = 40;
  // sol aux coins arrondis
  const sh = new THREE.Shape();
  sh.moveTo(-a + r, -a); sh.lineTo(a - r, -a); sh.quadraticCurveTo(a, -a, a, -a + r);
  sh.lineTo(a, a - r); sh.quadraticCurveTo(a, a, a - r, a);
  sh.lineTo(-a + r, a); sh.quadraticCurveTo(-a, a, -a, a - r);
  sh.lineTo(-a, -a + r); sh.quadraticCurveTo(-a, -a, -a + r, -a);
  const gg = new THREE.ShapeGeometry(sh, 8); gg.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gg, plain(st.ground, 0.95));
  ground.position.set(t.x, 0.03, t.z); ground.receiveShadow = true;
  G.add(ground);

  // rues en croix + route vers la grande ville
  const rd = t.road, len = rd.to - rd.from;
  const roads = [[t.x, t.z, 2 * a, 14], [t.x, t.z, 14, 2 * a]], lines = [];
  roads.push(rd.alongX ? [rd.x, rd.z, len + 4, 14] : [rd.x, rd.z, 14, len + 4]);
  for (let s = -S + 6; s < S - 6; s += 9) {
    if (Math.abs(s) < 12) continue;
    lines.push([t.x + s, t.z, 3.5, 0.45], [t.x, t.z + s, 0.45, 3.5]);
  }
  for (let s = -len / 2 + 3; s < len / 2 - 3; s += 9) lines.push(rd.alongX ? [rd.x + s, rd.z, 3.5, 0.45] : [rd.x, rd.z + s, 0.45, 3.5]);
  strips(roads, st.road, 0.06);
  strips(lines, st.line, 0.075);

  // matériau des poteaux (rayé ou uni)
  let post = candyMat(st.post);
  if (st.stripe) {
    const tex = stripeTex(st.stripe[0], st.stripe[1], 4); tex.repeat.set(1, 4);
    post = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 });
  }

  // lampadaires le long des rues
  const lp = [];
  for (let s = -S + 14; s <= S - 14; s += 28) {
    if (Math.abs(s) < 14) continue;
    for (const o of [-9, 9]) lp.push([t.x + s, 0, t.z + o], [t.x + o, 0, t.z + s]);
  }
  many(new THREE.CylinderGeometry(0.15, 0.2, 6, 8).translate(0, 3, 0), post, lp);
  many(new THREE.SphereGeometry(0.6, 14, 10).translate(0, 6.4, 0), glowMat, lp);
  for (const [x, , z] of lp) H.addCollider(x, z, 0.5, 0.5, 6.5);

  // grande arche d'entrée avec le nom de la ville
  const sx = Math.sign(t.x), sz = Math.sign(t.z);
  const ex = rd.alongX ? t.x - sx * S : t.x, ez = rd.alongX ? t.z : t.z - sz * S;
  const g = lot(ex, ez, rd.alongX ? Math.PI / 2 : 0);
  for (const s of [-1, 1]) {
    rb(2.2, 11, 2.2, 0.9, post, s * 10, 5.5, 0, g);
    add(GEO.ball, candyMat(st.top), s * 10, 12, 0, 1.7, 1.7, 1.7, g);
    H.addCollider(ex + (rd.alongX ? 0 : s * 10), ez + (rd.alongX ? s * 10 : 0), 2.4, 2.4, 13);
  }
  rb(22, 3.8, 1.2, 0.5, candyMat(st.top), 0, 10.2, 0, g);
  const label = new THREE.MeshStandardMaterial({ map: labelTex(t.name, st.sign), emissive: 0xffffff, roughness: 0.5 });
  label.emissiveMap = label.map;
  H.neonMats.push(label); // s'allume la nuit
  for (const f of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(19, 3.3), label);
    p.position.set(0, 10.2, f * 0.62); p.rotation.y = f > 0 ? 0 : Math.PI;
    g.add(p);
  }

  // pièces dans les rues et sur la route
  for (let i = 0; i < 7; i++) {
    const s = (rr(24, S - 15)) * (Math.random() < 0.5 ? -1 : 1), alongX = Math.random() < 0.5;
    H.addCoin(alongX ? t.x + s : t.x + 3.8, 1.6, alongX ? t.z + 3.8 : t.z + s);
  }
  for (let i = 0; i < 3; i++) {
    const s = rr(-len / 2 + 25, len / 2 - 25);
    H.addCoin(rd.alongX ? rd.x + s : rd.x - 3.8, 1.6, rd.alongX ? rd.z - 3.8 : rd.z + s);
  }
}

// fenêtre qui s'allume la nuit (avec un cadre)
function windowAt(g, frameMat, x, y, z, w = 2.2, h = 2.2) {
  rb(w + 0.5, h + 0.5, 0.3, 0.2, frameMat, x, y, z, g);
  rb(w, h, 0.3, 0.15, winMat, x, y, z + 0.08, g);
}

// ======================= 🍭 SUCREVILLE =======================
function buildCandy(t) {
  const M = {
    ginger: candyMat('#c27a44'), icing: candyMat('#fffafc'), cherry: candyMat('#e8203f'),
    wrapper: new THREE.MeshStandardMaterial({ map: stripeTex('#ff9cc6', '#ffffff', 6), roughness: 0.5 }),
    waffle: new THREE.MeshStandardMaterial({ map: stripeTex('#eab06b', '#c98a45', 8), roughness: 0.7 }),
    cane: new THREE.MeshStandardMaterial({ map: stripeTex('#ffffff', '#ff4f7b', 4), roughness: 0.35 }),
  };
  const POP = ['#ff7eb6', '#7fe0c4', '#b79bff', '#ffd84d', '#6fc3ff', '#ff9f6e'];

  // maison en pain d'épices
  const ginger = (x, z, ry) => {
    const g = lot(x, z, ry), w = rr(15, 20), d = rr(14, 18), h = rr(8, 11);
    rb(w, h, d, 2, M.ginger, 0, h / 2, 0, g);
    rb(w + 0.7, 1.1, d + 0.7, 0.5, M.icing, 0, h - 0.2, 0, g);                 // glaçage
    add(GEO.hemi, candyMat(pick(POP)), 0, h + 0.2, 0, w * 0.55, h * 0.6, d * 0.55, g); // toit en guimauve
    add(GEO.ball, candyMat(pick(POP)), 0, h + 0.2 + h * 0.6, 0, 1.3, 1.3, 1.3, g);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(GEO.ball, candyMat(pick(POP)), a * w / 2, h + 0.5, b * d / 2, 0.9, 0.9, 0.9, g);
    rb(3, 5, 0.6, 0.6, candyMat('#ff6f91'), 0, 2.5, d / 2, g);                 // porte
    for (const s of [-1, 1]) {
      add(GEO.disc, M.icing, s * w * 0.28, h * 0.55, d / 2 + 0.05, 1.8, 1.8, 1, g);
      add(GEO.disc, winMat, s * w * 0.28, h * 0.55, d / 2 + 0.15, 1.3, 1.3, 1, g);
    }
    const c = Math.max(w, d) + 1;
    H.addCollider(x, z, c, c, h + 4);
  };
  // immeuble cupcake
  const cupcake = (x, z) => {
    const r = rr(7, 9), h = rr(9, 13), cream = candyMat(pick(['#fff3f8', '#ffc2dc', '#d9ccff', '#c8f3e2']));
    add(GEO.cup, M.wrapper, x, 0, z, r, h, r);
    add(GEO.ball, cream, x, h + r * 0.1, z, r * 1.1, r * 0.55, r * 1.1);
    add(GEO.ball, cream, x, h + r * 0.6, z, r * 0.75, r * 0.42, r * 0.75);
    add(GEO.ball, cream, x, h + r * 0.95, z, r * 0.42, r * 0.3, r * 0.42);
    add(GEO.ball, M.cherry, x, h + r * 1.3, z, r * 0.22);
    H.addCollider(x, z, r * 2, r * 2, h + r * 1.5);
  };
  // tour en cornet de glace
  const iceCream = (x, z) => {
    const r = rr(5, 6.5), h = rr(14, 18);
    add(GEO.cone, M.waffle, x, h, z, r, -h, r); // cornet la pointe en bas
    rb(r * 1.4, 1.2, r * 1.4, 0.5, candyMat('#ffc2dc'), x, 0.6, z);
    add(GEO.ball, candyMat(pick(POP)), x, h + r * 0.55, z, r * 1.05);
    add(GEO.ball, candyMat(pick(POP)), x, h + r * 1.55, z, r * 0.85);
    add(GEO.ball, M.cherry, x, h + r * 2.45, z, r * 0.22);
    H.addCollider(x, z, r * 2, r * 2, h + r * 2.5);
  };
  eachLot(t, (x, z, ry) => { const k = Math.random(); if (k < 0.5) ginger(x, z, ry); else if (k < 0.78) cupcake(x, z); else iceCream(x, z); });

  // au centre : fontaine avec un donut géant 🍩
  add(GEO.cyl, candyMat('#ffb3d1'), t.x, 0, t.z, 15, 1.2, 15);
  add(GEO.cyl, new THREE.MeshStandardMaterial({ color: '#7fd8ff', roughness: 0.08, metalness: 0.2 }), t.x, 0, t.z, 13.6, 1.3, 13.6, G, false);
  rb(3, 4, 3, 0.8, candyMat('#ffffff'), t.x, 2, t.z);
  add(GEO.torus, candyMat('#e3a15a'), t.x, 10, t.z, 6, 6, 6);
  for (const f of [-1, 1]) add(GEO.torus, candyMat('#ff7eb6'), t.x, 10, t.z + f * 0.9, 6.05, 6.05, 4);
  H.addCollider(t.x, t.z, 30, 30, 6);

  // sucettes géantes et bonbons gélifiés
  const sticks = [], pops = [], gums = [];
  decorSpots(t, 70).forEach(([x, z], i) => {
    if (i % 3 === 2) { gums.push([x, 0, z, rr(1.2, 2.2)]); return; }
    const s = rr(0.8, 1.3);
    sticks.push([x, 0, z, s]); pops.push([x, 6.2 * s, z, s, s, s, rr(0, Math.PI)]);
    H.addCollider(x, z, 0.8, 0.8, 8 * s);
  });
  many(new THREE.CylinderGeometry(0.16, 0.16, 6, 8).translate(0, 3, 0), plain('#ffffff'), sticks);
  many(new THREE.CylinderGeometry(2, 2, 0.4, 32).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: swirlTex('#ffffff', '#ff4f8b'), roughness: 0.3 }), pops,
    ['#ffffff', '#ffd1e8', '#c9f0ff', '#fff3b0', '#e6dbff']);
  many(GEO.hemi, plain('#ffffff', 0.25), gums, POP);

  // sucres d'orge le long de la route
  const caneGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.22, 0.22, 6, 10).translate(0, 3, 0),
    new THREE.TorusGeometry(1, 0.22, 8, 16, Math.PI).translate(1, 6, 0),
    new THREE.CylinderGeometry(0.22, 0.22, 1, 10).translate(2, 5.5, 0),
  ]);
  const canes = roadside(t, 36).map(([x, y, z]) => [x, y, z, 1.2, 1.2, 1.2, rr(0, 6)]);
  many(caneGeo, M.cane, canes);
  // arbres-bonbons sur les collines autour
  const wild = wildSpots(t, 120);
  many(new THREE.CylinderGeometry(0.2, 0.2, 7, 8).translate(0, 3.5, 0), plain('#ffffff'), wild.map(([x, y, z]) => [x, y, z, 1]));
  many(new THREE.SphereGeometry(2.4, 16, 12).translate(0, 8, 0), plain('#ffffff', 0.3), wild.map(([x, y, z]) => [x, y, z, 1]), POP);
  for (const [x, y, z] of wild) H.addCollider(x, z, 1, 1, y + 10);
}

// ======================= 🌵 CACTUS CITY =======================
function buildWest(t) {
  const M = { wood: candyMat('#9a6235'), dark: candyMat('#5e3a20'), cream: candyMat('#fff3dc') };
  const WALLS = ['#e7a86b', '#d98c5f', '#9fd3c7', '#f2c46d', '#e58f8f', '#c9a0dc'];
  const SIGNS = ['SALOON', 'SHÉRIF', 'BANQUE', 'HÔTEL', 'BONBONS', 'ÉPICERIE', 'POSTE', 'FORGE'];

  // saloon / boutique avec fausse façade et auvent
  const saloon = (x, z, ry) => {
    const g = lot(x, z, ry), w = rr(14, 19), d = rr(12, 15), h = rr(7, 9.5), wall = candyMat(pick(WALLS));
    rb(w, h, d, 1, wall, 0, h / 2, 0, g);
    rb(w + 0.5, 0.6, d + 0.5, 0.25, M.wood, 0, h + 0.3, 0, g);
    rb(w, 4.2, 0.8, 0.4, wall, 0, h + 1.8, d / 2 - 0.4, g);                       // fausse façade
    sign(g, pick(SIGNS), '#7a3e1d', w * 0.72, 2, 0, h + 1.9, d / 2 + 0.05);
    rb(w, 0.35, 3.8, 0.15, M.wood, 0, h * 0.58, d / 2 + 1.9, g);                  // auvent
    for (const s of [-1, 1]) rb(0.4, h * 0.58, 0.4, 0.15, M.wood, s * (w / 2 - 0.4), h * 0.29, d / 2 + 3.5, g);
    rb(2.8, 3.8, 0.4, 0.2, M.dark, 0, 1.9, d / 2 + 0.05, g);                     // porte
    for (const s of [-1, 1]) windowAt(g, M.cream, s * w * 0.3, h * 0.42, d / 2);
    const c = Math.max(w, d + 7) + 1;
    H.addCollider(x, z, c, c, h + 6);
  };
  // maison ronde en terre (adobe)
  const adobe = (x, z, ry) => {
    const g = lot(x, z, ry), w = rr(13, 17), d = rr(12, 15), h = rr(6, 8), wall = candyMat(pick(['#eea47f', '#f3b98f', '#e9c08a', '#f0a3a3']));
    rb(w, h, d, 3, wall, 0, h / 2, 0, g);
    rb(w * 0.6, h * 0.7, d * 0.6, 2, wall, -w * 0.12, h + h * 0.3, -d * 0.1, g);
    rb(3, 4.2, 0.6, 1.2, M.dark, 0, 2.1, d / 2, g);
    for (const s of [-1, 1]) add(GEO.disc, winMat, s * w * 0.3, h * 0.55, d / 2 + 0.05, 1.1, 1.1, 1, g);
    const c = Math.max(w, d) + 1;
    H.addCollider(x, z, c, c, h * 1.8);
  };
  eachLot(t, (x, z, ry) => (Math.random() < 0.65 ? saloon : adobe)(x, z, ry));

  // au centre : le château d'eau
  for (const [a, b] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) add(GEO.cyl, M.wood, t.x + a, 0, t.z + b, 0.5, 12, 0.5);
  add(GEO.cyl, candyMat('#c98a52'), t.x, 12, t.z, 7, 7, 7);
  add(GEO.cone, candyMat('#e05a4f'), t.x, 19, t.z, 7.6, 4, 7.6);
  H.addCollider(t.x, t.z, 12, 12, 23);

  // cactus (avec une fleur rose sur certains)
  const cactusGeo = mergeGeometries([
    new THREE.CapsuleGeometry(0.9, 4.2, 6, 12).translate(0, 3, 0),
    new THREE.CapsuleGeometry(0.55, 1.8, 6, 10).translate(1.75, 4.2, 0),
    new THREE.CapsuleGeometry(0.45, 1.2, 6, 10).rotateZ(Math.PI / 2).translate(1.1, 3.1, 0),
    new THREE.CapsuleGeometry(0.5, 1.4, 6, 10).translate(-1.6, 3.6, 0),
    new THREE.CapsuleGeometry(0.42, 1.0, 6, 10).rotateZ(Math.PI / 2).translate(-1.0, 2.8, 0),
  ]);
  const town = decorSpots(t, 45).map(([x, z]) => [x, 0, z]);
  const all = town.concat(roadside(t, 45), wildSpots(t, 200));
  const cacti = all.map(([x, y, z]) => [x, y, z, rr(0.8, 1.5), undefined, undefined, rr(0, 6)]);
  many(cactusGeo, plain('#ffffff', 0.5), cacti, ['#5cc46a', '#4fb86a', '#7ad37a', '#3fae7a']);
  many(new THREE.SphereGeometry(0.55, 12, 8).translate(0, 6.2, 0), plain('#ff6fa8', 0.4),
    cacti.filter(() => Math.random() < 0.4).map((p) => [p[0], p[1], p[2], p[3]]));
  for (const [x, y, z, s] of cacti) H.addCollider(x, z, 1.8 * s, 1.8 * s, y + 6 * s);
  // gros rochers orange
  many(roundBox(1, 1, 1, 0.3), plain('#ffffff', 0.9),
    wildSpots(t, 60).map(([x, y, z]) => [x, y + 1, z, rr(4, 11), rr(3, 9), rr(4, 11), rr(0, 6)]),
    ['#e8915c', '#d9764a', '#f0a86e', '#e58f8f']);
}

// ======================= ❄️ NEIGEVILLE =======================
function buildSnow(t) {
  const M = { snow: candyMat('#ffffff'), wood: candyMat('#8a5a3a'), cream: candyMat('#fff8ee'), dark: candyMat('#3a2a2a') };
  const WALLS = ['#b9774a', '#9c5f3a', '#ff9aa2', '#8fd3f0', '#ffd27a', '#b7e4a8'];
  const ROOFS = ['#d64545', '#3f6fd6', '#2f9e6a', '#7a4a2a', '#b05cd6'];

  // chalet au toit enneigé
  const chalet = (x, z, ry) => {
    const g = lot(x, z, ry), w = rr(12, 16), d = rr(11, 14), h = rr(6, 8), rh = rr(4.5, 6);
    rb(w, h, d, 1.2, candyMat(pick(WALLS)), 0, h / 2, 0, g);
    add(GEO.prism, candyMat(pick(ROOFS)), 0, h, 0, w / 2 + 1.3, rh, d + 1.6, g);
    add(GEO.prism, M.snow, 0, h + 0.55, 0, w / 2 + 0.9, rh, d + 1.7, g);     // neige sur le toit
    rb(1.5, 4, 1.5, 0.4, candyMat('#c0604a'), w * 0.25, h + rh * 0.55, d * 0.2, g);
    rb(1.8, 0.6, 1.8, 0.3, M.snow, w * 0.25, h + rh * 0.55 + 2.1, d * 0.2, g);
    rb(2.6, 3.8, 0.5, 0.3, M.wood, 0, 1.9, d / 2, g);
    for (const s of [-1, 1]) {
      windowAt(g, M.cream, s * w * 0.3, h * 0.55, d / 2, 2, 2);
      for (const v of [-1, 1]) rb(0.7, 2.4, 0.25, 0.15, candyMat(pick(ROOFS)), s * w * 0.3 + v * 1.7, h * 0.55, d / 2 + 0.1, g); // volets
    }
    const c = Math.max(w, d) + 2;
    H.addCollider(x, z, c, c, h + rh);
  };
  eachLot(t, chalet);

  // sapins (avec de la neige au sommet)
  const pineGeo = mergeGeometries([
    new THREE.ConeGeometry(3.2, 4, 12).translate(0, 3.6, 0),
    new THREE.ConeGeometry(2.5, 3.6, 12).translate(0, 5.6, 0),
    new THREE.ConeGeometry(1.7, 3, 12).translate(0, 7.6, 0),
  ]);
  const capGeo = new THREE.ConeGeometry(0.95, 1.3, 12).translate(0, 8.6, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.45, 2, 8).translate(0, 1, 0);

  // au centre : patinoire + sapin de Noël géant 🎄
  add(GEO.cyl, new THREE.MeshStandardMaterial({ color: '#cdefff', roughness: 0.05, metalness: 0.2 }), t.x, 0, t.z, 22, 0.12, 22, G, false);
  add(trunkGeo, M.wood, t.x, 0, t.z, 2.8);
  add(pineGeo, candyMat('#2f9e5a'), t.x, 0, t.z, 2.8);
  add(capGeo, M.snow, t.x, 0, t.z, 2.8);
  const star = add(new THREE.OctahedronGeometry(1.8), glowMat, t.x, 27.5, t.z);
  star.scale.set(1, 1.3, 0.5);
  const balls = [];
  for (let i = 0; i < 36; i++) {
    const k = i % 3, y0 = [1.6, 3.8, 6.1][k] * 2.8, r0 = [3.2, 2.5, 1.7][k] * 2.8, hh = [4, 3.6, 3][k] * 2.8;
    const f = rr(0.05, 0.6), a = rr(0, Math.PI * 2), r = r0 * (1 - f) + 0.4;
    balls.push([t.x + Math.cos(a) * r, y0 + f * hh, t.z + Math.sin(a) * r, 0.7]);
  }
  many(new THREE.SphereGeometry(1, 12, 8), plain('#ffffff', 0.2), balls, ['#ff4f7b', '#ffd84d', '#6fc3ff', '#b79bff', '#ffffff']);
  H.addCollider(t.x, t.z, 14, 14, 30);

  // bonshommes de neige ⛄
  const spots = decorSpots(t, 60);
  for (const [x, z] of spots.splice(0, 8)) {
    const ry = rr(0, 6), g = lot(x, z, ry);
    add(GEO.ball, M.snow, 0, 1.4, 0, 1.6, 1.5, 1.6, g);
    add(GEO.ball, M.snow, 0, 3.4, 0, 1.1, 1.05, 1.1, g);
    add(GEO.ball, M.snow, 0, 4.9, 0, 0.75, 0.75, 0.75, g);
    const nose = add(GEO.cone, candyMat('#ff8a2a'), 0, 4.9, 0.6, 0.15, 0.8, 0.15, g);
    nose.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(GEO.ball, M.dark, s * 0.28, 5.15, 0.62, 0.1, 0.1, 0.1, g);
    add(GEO.cyl, M.dark, 0, 5.45, 0, 0.6, 0.9, 0.6, g);
    add(GEO.cyl, candyMat('#e8364f'), 0, 4.2, 0, 0.85, 0.3, 0.85, g); // écharpe
    H.addCollider(x, z, 3, 3, 6);
  }
  const pines = spots.map(([x, z]) => [x, 0, z]).concat(roadside(t, 32), wildSpots(t, 220))
    .map(([x, y, z]) => [x, y, z, rr(0.8, 1.5), undefined, undefined, rr(0, 6)]);
  many(trunkGeo, M.wood, pines);
  many(pineGeo, plain('#ffffff', 0.6), pines, ['#2f9e5a', '#3aae6a', '#25875a', '#4cbf7a']);
  many(capGeo, plain('#ffffff', 0.5), pines);
  for (const [x, y, z, s] of pines) H.addCollider(x, z, 1.2, 1.2, y + 9 * s);
}

const STYLES = {
  candy: { ground: '#ffe2ee', road: '#a58fc2', line: '#ffffff', stripe: ['#ffffff', '#ff4f7b'], top: '#ff7eb6', sign: '#ff5c9a', build: buildCandy },
  west: { ground: '#f2d39a', road: '#c99a62', line: '#fff3d6', post: '#9a6235', top: '#5cc46a', sign: '#e0743a', build: buildWest },
  snow: { ground: '#f4f9ff', road: '#a9bdd3', line: '#ffffff', stripe: ['#ffffff', '#3f8fe0'], top: '#ffffff', sign: '#3f8fe0', build: buildSnow },
};

// helpers = { group, addCollider, addTree, addCoin, windowMats, neonMats, half, limit }
export function buildTowns(helpers) {
  H = helpers;
  G = new THREE.Group();
  H.group.add(G);
  winMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffc35a', emissiveIntensity: 0, roughness: 0.3 });
  H.windowMats.push(winMat);      // les fenêtres s'allument le soir
  glowMat = new THREE.MeshStandardMaterial({ color: '#fff1c4', emissive: '#ffd27a', emissiveIntensity: 1 });
  H.neonMats.push(glowMat);
  for (const t of TOWNS) {
    try {
      t.style = STYLES[t.id];
      frame(t);
      t.style.build(t);
    } catch (e) { console.warn('Ville ' + t.name + ' :', e); }
  }
}
