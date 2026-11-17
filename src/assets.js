// =====================================================
//  ASSETS EN LIGNE
//  Textures, ciels HDR et modèle 3D libres de la bibliothèque
//  officielle three.js (dossier examples). Si un fichier ne se
//  charge pas, le jeu garde ses graphismes de base.
// =====================================================
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// On essaie plusieurs serveurs, l'un après l'autre
const BASES = [
  'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/',
  'https://threejs.org/examples/',
];

function tryLoad(loader, path) {
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= BASES.length) { console.warn('Asset introuvable :', path); resolve(null); return; }
      loader.load(BASES[i++] + path, resolve, undefined, next);
    };
    next();
  });
}

const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');

export async function loadTexture(path, isColor = true) {
  const t = await tryLoad(texLoader, path);
  if (t) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (isColor) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  }
  return t;
}

const rgbe = new RGBELoader();
export async function loadHDR(path) {
  const t = await tryLoad(rgbe, path);
  if (t) t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);
export async function loadModel(path) {
  const g = await tryLoad(gltfLoader, path);
  return g ? g.scene : null;
}
