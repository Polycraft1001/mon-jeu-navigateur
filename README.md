# 🏎️ Turbo City 3D

Un jeu de voiture en 3D dans une grande ville ouverte, qui marche directement dans le navigateur (avec [three.js](https://threejs.org)).

👉 **Jouer :** https://polycraft1001.github.io/mon-jeu-navigateur/

## ✨ Ce qu'il y a dans le jeu

- 🌆 Une ville de 8 × 8 pâtés de maisons : centre-ville avec gratte-ciel, quartiers, banlieue, parcs avec lacs et skateparks avec tremplins.
- 🚗 5 voitures dont une **Ferrari 3D** (un vrai modèle 3D chargé en ligne), 10 couleurs.
- 💨 Drift avec turbo (🔵 → 🟠 → 🟣 SUPER DRIFT), combos et record.
- ⭐ Missions chronométrées, 🪙 pièces à ramasser, sauts sur les tremplins.
- 🚦 Circulation : les voitures suivent les routes, tournent aux carrefours et s'arrêtent pour les piétons.
- 🚶 **Piétons (PNJ)** : ils marchent sur les trottoirs, traversent aux passages piétons et plongent sur le côté quand une voiture fonce sur eux. S'ils se font percuter, ils passent en mode **ragdoll** (corps physique qui vole, roule sur le capot et tombe), puis se relèvent.
- 📯 Klaxon : les piétons proches s'écartent en courant.
- ☀️ Jour, 🌇 soir et 🌙 nuit (fenêtres allumées, néons, lampadaires, phares).
- 📱 Jouable sur **téléphone** : joystick, pédales, boutons, plein écran en mode paysage.

## 🎨 Graphismes HD (assets en ligne)

Au démarrage, le jeu télécharge des fichiers libres de la bibliothèque d'exemples officielle de three.js :

- des **ciels HDR** (Poly Haven) pour des reflets réalistes sur les voitures, les vitres et l'eau ;
- une **texture d'herbe** photo-réaliste et une texture de **vagues** pour l'eau ;
- le **modèle 3D de la Ferrari** (exemple « webgl_materials_car » de three.js).

Si ces fichiers ne se chargent pas (pas d'internet, serveur bloqué…), le jeu garde ses graphismes de base et reste jouable. L'état du chargement s'affiche en bas du menu.

## 🎮 Commandes

| Action | Clavier | Téléphone |
|---|---|---|
| Accélérer / freiner | ↑ ↓ ou W S (Z S) | ▲ / ▼ |
| Tourner | ← → ou A D (Q D) | joystick à gauche |
| Drift | Espace (en tournant) | DRIFT |
| Klaxon | H | 📯 |
| Caméra | V | 🎥 |
| Replacer la voiture | R | ↺ |
| Changer de couleur | C | (menu) |
| Pause | Échap ou P | ❚❚ |

## 📁 Fichiers

- `index.html` : la page (HUD, menus, boutons tactiles)
- `style.css` : l'apparence (ordinateur et téléphone)
- `game.js` : le jeu (ville, voitures, drift, missions, caméra…)
- `assets.js` : chargement des textures, ciels HDR et modèles 3D en ligne
- `pnj.js` : les piétons et leur physique ragdoll
