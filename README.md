# 🏎️ TURBO CITY 3D

Un jeu de voiture en monde ouvert qui tourne directement dans le navigateur (ordinateur **et** téléphone), fait avec [three.js](https://threejs.org).

👉 **Jouer : https://polycraft1001.github.io/mon-jeu-navigateur/**

---

## ✨ Ce que tu peux faire

- 🚗 **Conduire** 5 voitures (dont une vraie **Ferrari 3D**), drifter, déclencher le turbo, sauter sur les tremplins des skateparks.
- 🚪 **Sortir de ta voiture** et te balader à pied : marcher, courir, sauter.
- 🔑 **Voler n'importe quelle voiture** de la circulation (ou reprendre la tienne).
- 🔫 **5 armes** avec visée automatique : poings, pistolet, mitraillette, fusil à pompe, lance-roquettes.
- 💥 **Tout se démolit** : les voitures abîmées fument, prennent feu puis explosent (parfois en chaîne), les arbres et lampadaires tombent, il reste des débris et des traces noires. Les piétons sont projetés… puis se relèvent.
- ❤️ **Une barre de vie** pour le héros : si elle tombe à zéro, K.O. et réveil à l'hôpital.
- ⭐ Missions, 🪙 pièces à ramasser, 💰 argent, 🏆 records (sauvegardés dans le navigateur).
- 🌇 Jour, soir ou nuit, avec une circulation réglable.

## 🎮 Commandes

| Action | Clavier | Téléphone |
|---|---|---|
| Conduire / marcher | Flèches ou ZQSD / WASD | Joystick + ▲ ▼ |
| Drift (en voiture) / Saut (à pied) | Espace | DRIFT / SAUT |
| Sortir, monter, voler une voiture | F ou Entrée | 🚪 |
| Courir (à pied) | Maj | — |
| Tirer | Clic ou X | 🔫 |
| Changer d'arme | 1 à 5, molette, E ou Tab | 🔄 |
| Replacer la voiture / l'appeler (à pied) | R | ↺ |
| Klaxon | H | 📯 |
| Caméra | C ou V | 🎥 |
| Pause | Échap ou P | ❚❚ |

## 📁 Organisation du code

```
mon-jeu-navigateur/
├── index.html          ← la page : HUD, menus, boutons tactiles
├── style.css           ← tout le look de l'interface
├── .nojekyll           ← dit à GitHub Pages de servir les fichiers tels quels
├── docs/
│   └── ARCHITECTURE.md ← comment le code fonctionne (à lire avant de modifier)
└── src/
    ├── main.js         ← POINT D'ENTRÉE : démarrage + boucle du jeu
    ├── assets.js       ← chargement des textures / modèles HD en ligne
    ├── core/           ← config.js (voitures, armes…), ctx.js (état partagé G), save.js, utils.js
    ├── render/         ← engine.js (rendu, lumières, ciel), camera.js
    ├── world/          ← city.js (la ville), textures.js, time.js (jour / soir / nuit)
    ├── vehicles/       ← models.js (modèles 3D), driving.js (conduite), traffic.js (circulation)
    ├── npc/            ← pedestrians.js (piétons)
    ├── gameplay/       ← onfoot.js (héros à pied), weapons.js, coins.js, mission.js, where.js
    ├── fx/             ← particles.js (fumée, flammes), destruction.js (explosions, débris)
    └── ui/             ← input.js (touches), hud.js, menu.js, minimap.js, audio.js
```

## 🛠️ Où modifier quoi ?

| Je veux… | Fichier |
|---|---|
| Changer la vitesse d'une voiture ou en ajouter une | `src/core/config.js` (liste `CARS`) |
| Changer les dégâts / la cadence d'une arme | `src/core/config.js` (liste `WEAPONS`) |
| Changer la forme d'une voiture, la Ferrari | `src/vehicles/models.js` |
| Régler la conduite, le drift, le turbo, les sauts | `src/vehicles/driving.js` |
| La circulation, les voitures qui brûlent et explosent | `src/vehicles/traffic.js` |
| Les explosions, débris, arbres et lampadaires qui tombent | `src/fx/destruction.js` |
| La fumée, les flammes, les étincelles | `src/fx/particles.js` |
| Le héros (marche, vie, K.O., voler une voiture) | `src/gameplay/onfoot.js` |
| Les tirs, la visée automatique, les roquettes | `src/gameplay/weapons.js` |
| Les piétons | `src/npc/pedestrians.js` |
| La ville (rues, immeubles, parcs, skateparks) | `src/world/city.js` |
| Les couleurs du jour / soir / nuit | `src/core/config.js` (`TIME_SET`) et `src/world/time.js` |
| Les missions / les pièces | `src/gameplay/mission.js` / `src/gameplay/coins.js` |
| Les touches du clavier et du téléphone | `src/ui/input.js` |
| L'affichage à l'écran (HUD) | `index.html`, `style.css`, `src/ui/hud.js` |
| La caméra | `src/render/camera.js` |
| Les sons | `src/ui/audio.js` |

Plus de détails (ordre de la boucle, règles, « recettes » pour ajouter une arme ou une voiture) : **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## 💻 Tester sur ton ordinateur

Le jeu utilise des modules JavaScript : il faut un petit serveur (ouvrir `index.html` en double-cliquant ne marche pas).

```bash
# dans le dossier du jeu
python -m http.server 8000
```

Puis ouvre **http://localhost:8000** dans ton navigateur. Après une modification, fais **Ctrl + F5** pour recharger sans le cache.

En cas de souci : les erreurs s'affichent sous le bouton **JOUER**, et en détail dans la console (**F12 → Console**).

## 🧹 Anciens fichiers

`game.js`, `assets.js` et `pnj.js` à la racine sont les anciennes versions du jeu. Ils ne servent plus (tout est dans `src/`) : tu peux les supprimer sur GitHub (ouvre le fichier → **⋯** → **Delete file**).

## 🙏 Crédits

- Moteur 3D : [three.js](https://threejs.org) (licence MIT)
- Textures (herbe, eau) et modèle 3D de la Ferrari : exemples officiels de three.js
- Ciels HDR : [Poly Haven](https://polyhaven.com) (CC0)
- Tout le reste (ville, voitures, héros, piétons, effets, sons) est fabriqué par le code
