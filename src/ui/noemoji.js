// =====================================================
//  FILTRE ANTI-EMOJI : retire les emojis de TOUT le texte
//  affiché par le jeu (HTML + textes dessinés sur les canvas).
//  Les anciens fichiers (police, boutiques...) peuvent encore
//  contenir des emojis dans leur code : ils sont effacés à
//  l'affichage. On garde quand même quelques symboles utiles.
//  ➜ À importer EN PREMIER dans src/main.js
// =====================================================
const KEEP = new Set(['★', '☆', '✓', '✔', '©', '®', '™', '↔', '↕']);

let RE;
try {
  // navigateurs récents : vraie liste Unicode des emojis
  RE = new RegExp(String.raw`\p{Regional_Indicator}{2}|[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}][\u{FE0F}\u{20E3}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]*(?:\u{200D}\p{Extended_Pictographic}[\u{FE0F}\u{1F3FB}-\u{1F3FF}]*)*|[\u{FE0F}\u{20E3}\u{200D}]`, 'gu');
} catch (e) {
  // vieux navigateurs : plages Unicode principales
  RE = new RegExp(String.raw`(?:\uD83C[\uDDE6-\uDDFF]){2}|(?:[\u2600-\u27BF\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u231A\u231B\u23E9-\u23FA]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])[\uFE0F\u20E3]?|[\uFE0F\u20E3\u200D]`, 'g');
}

function repl(m) {
  const base = m.replace(/[\uFE0F\u200D]/g, '');
  return KEEP.has(base) ? base : '';
}

// « 🚨 Police ! » → « Police ! »
export function stripEmoji(s) {
  if (typeof s !== 'string' || !s) return s;
  RE.lastIndex = 0;
  if (!RE.test(s)) return s;
  RE.lastIndex = 0;
  let out = s.replace(RE, repl);
  if (out === s) return s;
  out = out.replace(/ {2,}/g, ' ');
  if (!/^\s/.test(s)) out = out.replace(/^\s+/, '');
  if (!/\s$/.test(s)) out = out.replace(/\s+$/, '');
  return out;
}

// ----- Texte de la page (HTML) -----
const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];

function cleanText(t) {
  const p = t.parentNode;
  if (p && SKIP[p.nodeName]) return;
  const v = t.nodeValue, c = stripEmoji(v);
  if (c !== v) t.nodeValue = c;
}
function cleanAttrs(el) {
  if (!el.getAttribute) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const c = stripEmoji(v);
    if (c !== v) el.setAttribute(a, c);
  }
}
function cleanTree(n) {
  if (n.nodeType === 3) { cleanText(n); return; }
  if (n.nodeType !== 1 || SKIP[n.nodeName]) return;
  cleanAttrs(n);
  const w = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let x;
  while ((x = w.nextNode())) {
    if (x.nodeType === 3) cleanText(x);
    else if (!SKIP[x.nodeName]) cleanAttrs(x);
  }
}

const mo = new MutationObserver((list) => {
  for (const m of list) {
    if (m.type === 'characterData') cleanText(m.target);
    else if (m.type === 'attributes') cleanAttrs(m.target);
    else for (const n of m.addedNodes) cleanTree(n);
  }
});
function start() {
  cleanTree(document.body);
  mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

// ----- Texte dessiné sur les canvas (minicarte, panneaux, pubs...) -----
function patchCtx(proto) {
  if (!proto || proto.__noEmoji) return;
  proto.__noEmoji = true;
  for (const k of ['fillText', 'strokeText', 'measureText']) {
    const f = proto[k];
    if (typeof f !== 'function') continue;
    proto[k] = function (text, ...rest) {
      return f.call(this, typeof text === 'string' ? stripEmoji(text) : text, ...rest);
    };
  }
}
if (typeof CanvasRenderingContext2D !== 'undefined') patchCtx(CanvasRenderingContext2D.prototype);
if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') patchCtx(OffscreenCanvasRenderingContext2D.prototype);
