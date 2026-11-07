// 3D-движок пиццы Азима: тесто, соус, моцарелла и все топпинги — процедурная геометрия Three.js
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';

export const TOP = 0.17; // высота верхней поверхности теста

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
export function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const wob = (a) => 1 + 0.022 * Math.sin(3 * a + 0.7) + 0.014 * Math.sin(5 * a + 2.1) + 0.007 * Math.sin(11 * a + 0.3);
const easeOutBounce = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

function makeCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texFrom(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function blob(ctx, x, y, r, inner, outer = 'rgba(0,0,0,0)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/* ---------- Текстуры ---------- */
function drawDough(ctx, S, baked, r) {
  ctx.fillStyle = baked ? '#d39a58' : '#e8d4ad';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = baked ? `rgba(140,80,30,${r() * 0.12})` : `rgba(205,185,150,${r() * 0.14})`;
    ctx.fillRect(r() * S, r() * S, 2, 2);
  }
  // мука на сыром тесте
  if (!baked) for (let i = 0; i < 90; i++) blob(ctx, r() * S, r() * S, 6 + r() * 20, 'rgba(255,255,255,0.35)');
  if (baked) {
    for (let i = 0; i < 160; i++) blob(ctx, r() * S, S * (0.18 + r() * 0.62), 10 + r() * 40, `rgba(160,80,25,${0.25 + r() * 0.3})`);
    // «леопардовые» подпалины на бортике и снизу
    for (let i = 0; i < 520; i++) {
      const y = r() < 0.78 ? S * (0.22 + r() * 0.5) : S * (0.84 + r() * 0.16);
      blob(ctx, r() * S, y, 3 + r() * 11, `rgba(30,14,6,${0.6 + r() * 0.4})`);
    }
  }
}
function sauceTexture() {
  const S = 512, c = makeCanvas(S), ctx = c.getContext('2d'), r = rng(42);
  ctx.fillStyle = '#9e1d12'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) blob(ctx, r() * S, r() * S, 10 + r() * 50, r() < 0.5 ? 'rgba(220,70,40,0.35)' : 'rgba(120,20,12,0.35)');
  for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(60,70,25,${0.4 + r() * 0.5})`; ctx.fillRect(r() * S, r() * S, 2 + r() * 3, 1 + r() * 2); } // орегано
  for (let i = 0; i < 90; i++) blob(ctx, r() * S, r() * S, 2 + r() * 3, 'rgba(255,230,190,0.6)'); // чеснок
  return texFrom(c);
}
function pepperoniTexture() {
  const S = 128, c = makeCanvas(S), ctx = c.getContext('2d'), r = rng(9);
  ctx.fillStyle = '#a92a22'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) blob(ctx, r() * S, r() * S, 3 + r() * 6, 'rgba(240,170,150,0.8)');
  for (let i = 0; i < 30; i++) blob(ctx, r() * S, r() * S, 2 + r() * 4, 'rgba(70,10,8,0.7)');
  return texFrom(c);
}

/* ---------- Кеш геометрии и материалов ---------- */
const G = {}; const geo = (k, fn) => (G[k] ||= fn());
const M = {}; const mat = (k, p) => (M[k] ||= new THREE.MeshStandardMaterial(p));

function doughGeometry() {
  const prof = [[0, 0], [2.55, 0], [2.85, 0.03], [3.0, 0.1], [3.1, 0.21], [3.08, 0.33], [2.98, 0.43], [2.83, 0.47], [2.68, 0.42], [2.56, 0.31], [2.48, 0.21], [2.38, 0.17], [1.4, 0.165], [0, 0.165]];
  const curve = new THREE.CatmullRomCurve3(prof.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const pts = curve.getPoints(90).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, 160);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rr = Math.hypot(x, z); if (rr < 1e-5) continue;
    const a = Math.atan2(z, x);
    const rim = smooth(2.35, 2.95, rr);
    const bump = 0.05 * (Math.sin(a * 9 + 1.3) * 0.5 + Math.sin(a * 17 + 0.4) * 0.3 + Math.sin(a * 4 + 3) * 0.45);
    const k = wob(a) * (1 + rim * bump * 0.35);
    pos.setXYZ(i, x * k, y > 0.2 ? y + rim * bump * 0.9 : y, z * k);
  }
  g.computeVertexNormals();
  return g;
}
function sauceGeometry() {
  const g = new THREE.CylinderGeometry(2.42, 2.42, 0.045, 128, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x);
    const k = wob(a) * (1 + 0.012 * Math.sin(a * 23));
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  g.computeVertexNormals();
  g.translate(0, TOP + 0.005, 0);
  return g;
}

/* ---------- Топпинги ---------- */
function hamGeometry(seed) {
  const r = rng(seed), s = new THREE.Shape(), n = 22;
  const w = 0.42 + r() * 0.16, h = 0.34 + r() * 0.1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * 0.1;
    let x = Math.cos(a) * w * k, y = Math.sin(a) * h * k;
    if (y < 0) y *= 0.3;
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.016, bevelSegments: 2, curveSegments: 3 });
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, pos.getZ(i) + 0.09 * (x * x + y * y) + 0.03 * Math.sin(x * 6)); }
  g.computeVertexNormals();
  g.rotateX(-Math.PI / 2);
  return g;
}
function mushroomGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.07, -0.2); s.lineTo(-0.08, 0.02);
  s.absellipse(0, 0.02, 0.24, 0.2, Math.PI, 0, true);
  s.lineTo(0.08, 0.02); s.lineTo(0.07, -0.2); s.lineTo(-0.07, -0.2);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 1, curveSegments: 12 });
  g.rotateX(-Math.PI / 2);
  return g;
}
function basilGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.26); s.quadraticCurveTo(0.2, -0.02, 0, 0.26); s.quadraticCurveTo(-0.2, -0.02, 0, -0.26);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 10 });
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, pos.getZ(i) + 0.25 * x * x); }
  g.computeVertexNormals();
  g.rotateX(-Math.PI / 2);
  return g;
}

const MAKERS = {
  ham(r) {
    const v = Math.floor(r() * 5);
    const m = new THREE.Mesh(geo('ham' + v, () => hamGeometry(100 + v)), mat('ham', { color: '#f0b3a8', roughness: 0.45 }));
    m.rotation.y = r() * Math.PI * 2; m.position.y = TOP + 0.05 + r() * 0.05;
    return m;
  },
  mozz(r, ctx) { return cheeseCube(r, ctx, 0.04); },
  redonion(r) {
    const v = Math.floor(r() * 6);
    const g = geo('ro' + v, () => new THREE.TorusGeometry(0.2 + v * 0.045, 0.022, 6, 36, Math.PI * (0.55 + (v % 3) * 0.4)));
    const m = new THREE.Mesh(g, mat('redonion', { color: '#9c3f7b', roughness: 0.3 }));
    m.rotation.set(Math.PI / 2, 0, r() * Math.PI * 2); m.position.y = TOP + 0.07 + r() * 0.05;
    return m;
  },
  'olive-black'(r) {
    const m = new THREE.Mesh(geo('olb', () => new THREE.TorusGeometry(0.12, 0.055, 10, 24)), mat('olb', { color: '#1a1617', roughness: 0.22, metalness: 0.1 }));
    m.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.3, 0, 0); m.scale.set(1, 1, 0.75); m.position.y = TOP + 0.08 + r() * 0.03;
    return m;
  },
  'olive-green'(r) {
    const m = new THREE.Mesh(geo('olg', () => new THREE.TorusGeometry(0.13, 0.06, 10, 24)), mat('olg', { color: '#a9a73d', roughness: 0.3 }));
    m.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.3, 0, 0); m.scale.set(1, 1, 0.75); m.position.y = TOP + 0.08 + r() * 0.03;
    return m;
  },
  jalapeno(r) {
    const ring = r() < 0.3;
    const g = ring ? geo('jr', () => new THREE.TorusGeometry(0.075, 0.028, 6, 14)) : geo('jb', () => new THREE.DodecahedronGeometry(0.075, 0));
    const m = new THREE.Mesh(g, mat('jal', { color: '#62821d', roughness: 0.28 }));
    if (ring) m.rotation.x = Math.PI / 2; else { m.scale.set(1, 0.45, 0.8); m.rotation.y = r() * 6; }
    m.position.y = TOP + 0.09 + r() * 0.04;
    return m;
  },
  onion(r) {
    const v = Math.floor(r() * 3);
    const m = new THREE.Mesh(geo('on' + v, () => new THREE.BoxGeometry(0.16 + v * 0.07, 0.02, 0.05)), mat('onion', { color: '#f2efdc', roughness: 0.25, transparent: true, opacity: 0.88 }));
    m.rotation.y = r() * Math.PI; m.position.y = TOP + 0.08 + r() * 0.04;
    return m;
  },
  pepperoni(r) {
    const m = new THREE.Mesh(geo('pep', () => {
      const g = new THREE.CylinderGeometry(0.3, 0.29, 0.045, 32);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + 0.25 * (x * x + z * z)); }
      g.computeVertexNormals(); return g;
    }), M.pepTex ||= new THREE.MeshStandardMaterial({ map: pepperoniTexture(), roughness: 0.35 }));
    m.rotation.set((r() - 0.5) * 0.12, r() * 6, (r() - 0.5) * 0.12); m.position.y = TOP + 0.08 + r() * 0.04;
    return m;
  },
  mushroom(r) {
    const m = new THREE.Mesh(geo('mush', mushroomGeometry), [mat('mushFace', { color: '#eee1c6', roughness: 0.6 }), mat('mushSide', { color: '#8d6a48', roughness: 0.7 })]);
    m.rotation.y = r() * Math.PI * 2; m.position.y = TOP + 0.07 + r() * 0.04;
    return m;
  },
  pepper(r) {
    const cols = ['#d8321f', '#f0b21c', '#3f8f2a'];
    const ci = Math.floor(r() * 3);
    const m = new THREE.Mesh(geo('pp', () => new THREE.TorusGeometry(0.38, 0.03, 5, 14, 0.75)), mat('pp' + ci, { color: cols[ci], roughness: 0.25 }));
    m.scale.set(1, 1, 1.8); m.rotation.set(Math.PI / 2, 0, r() * 6); m.position.y = TOP + 0.08 + r() * 0.04;
    return m;
  },
  corn(r) {
    const m = new THREE.Mesh(geo('corn', () => new THREE.SphereGeometry(0.055, 10, 8)), mat('corn', { color: '#f3c214', roughness: 0.3 }));
    m.scale.set(1, 0.75, 1.15); m.rotation.y = r() * 6; m.position.y = TOP + 0.08 + r() * 0.04;
    return m;
  },
  basil(r) {
    const m = new THREE.Mesh(geo('basil', basilGeometry), mat('basil', { color: '#2f7a31', roughness: 0.4, side: THREE.DoubleSide }));
    m.rotation.y = r() * 6; m.position.y = TOP + 0.13 + r() * 0.04;
    return m;
  },
};

export const TOPPING_SHAPES = {
  ham: { count: 9, minD: 0.62 },
  mozz: { count: 26 },
  redonion: { count: 16 },
  'olive-black': { count: 12, minD: 0.22 },
  'olive-green': { count: 10, minD: 0.22 },
  jalapeno: { count: 34 },
  onion: { count: 30 },
  pepperoni: { count: 11, minD: 0.6 },
  mushroom: { count: 12, minD: 0.3 },
  pepper: { count: 13 },
  corn: { count: 45 },
  basil: { count: 8, minD: 0.4 },
};

function cheeseCube(r, ctx, lift = 0) {
  const m = new THREE.Mesh(geo('cube', () => new RoundedBoxGeometry(0.24, 0.2, 0.24, 2, 0.05)), ctx.cheeseMat);
  const s = 0.75 + r() * 0.5;
  m.scale.setScalar(s);
  m.rotation.y = r() * Math.PI;
  m.userData.melt = { s, lift };
  m.position.y = TOP + 0.1 * s + lift;
  ctx.melt.push(m);
  return m;
}

function scatter(n, radius, r, minD = 0) {
  const pts = []; let tries = 0;
  while (pts.length < n && tries < n * 80) {
    tries++;
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (minD && pts.some((p) => Math.hypot(p[0] - x, p[1] - z) < minD)) continue;
    pts.push([x, z]);
  }
  return pts;
}

/** Группа кусочков одного ингредиента */
export function makeToppingGroup(id, { qty = 1, radius = 2.2, count, seed, cheeseMat } = {}) {
  const def = TOPPING_SHAPES[id];
  const r = rng(seed ?? hash(id) + qty * 77);
  const n = count ?? Math.round(def.count * (qty > 1 ? 1.75 : 1));
  const group = new THREE.Group();
  const ctx = { cheeseMat: cheeseMat || defaultCheese(), melt: [] };
  const minD = def.minD ? def.minD * (qty > 1 ? 0.75 : 1) * Math.min(1, radius / 2.2 + 0.4) : 0;
  for (const [x, z] of scatter(n, radius, r, minD)) {
    const m = MAKERS[id](r, ctx);
    m.position.x = x; m.position.z = z;
    m.castShadow = true;
    group.add(m);
  }
  group.userData.melt = ctx.melt;
  group.name = id;
  return group;
}
let _cheese;
function defaultCheese() { return (_cheese ||= new THREE.MeshStandardMaterial({ color: '#f5edd3', roughness: 0.5 })); }

/* ---------- Пицца целиком ---------- */
const CHEESE_RAW = new THREE.Color('#eadfbf');
const CHEESE_BAKED = new THREE.Color('#f2cf86');
const SAUCE_BAKED = new THREE.Color('#d9b8ad');
const WHITE = new THREE.Color('#ffffff');

export function createPizza({ seed = 7 } = {}) {
  const root = new THREE.Group();
  const layers = new Map();
  const r = rng(seed);

  // тесто: сырая/запечённая текстура смешиваются по степени выпекания
  const S = 1024;
  const raw = makeCanvas(S), baked = makeCanvas(S), comp = makeCanvas(S);
  drawDough(raw.getContext('2d'), S, false, rng(seed + 1));
  drawDough(baked.getContext('2d'), S, true, rng(seed + 2));
  const doughTex = texFrom(comp);
  const cctx = comp.getContext('2d');
  const doughMat = new THREE.MeshStandardMaterial({ map: doughTex, roughness: 0.85, side: THREE.DoubleSide });
  const dough = new THREE.Mesh(geo('dough', doughGeometry), doughMat);
  dough.castShadow = true; dough.receiveShadow = true;
  const doughG = new THREE.Group(); doughG.add(dough); doughG.name = 'dough';

  const sauceMat = new THREE.MeshStandardMaterial({ map: (M.sauceTex ||= sauceTexture()), roughness: 0.55 });
  const sauce = new THREE.Mesh(geo('sauce', sauceGeometry), sauceMat);
  sauce.receiveShadow = true; sauce.castShadow = true;
  const sauceG = new THREE.Group(); sauceG.add(sauce); sauceG.name = 'sauce';

  const cheeseMat = new THREE.MeshStandardMaterial({ color: CHEESE_RAW.clone(), roughness: 0.5 });
  const cheeseG = new THREE.Group(); cheeseG.name = 'cheese';
  const cctxCheese = { cheeseMat, melt: [] };
  for (const [x, z] of scatter(42, 2.15, r, 0.26)) {
    const m = cheeseCube(r, cctxCheese); m.position.x = x; m.position.z = z; m.castShadow = true; m.receiveShadow = true; cheeseG.add(m);
  }
  cheeseG.userData.melt = cctxCheese.melt;

  for (const g of [doughG, sauceG, cheeseG]) { g.userData.qty = 1; root.add(g); layers.set(g.name, g); }

  const state = { bake: -1, explode: 0, gap: 0.72, lift: 0.6, order: null };
  const leaving = new Set();

  function setBake(b) {
    b = clamp01(b);
    if (Math.abs(b - state.bake) < 0.002) return;
    state.bake = b;
    cctx.globalAlpha = 1; cctx.drawImage(raw, 0, 0);
    cctx.globalAlpha = b; cctx.drawImage(baked, 0, 0);
    doughTex.needsUpdate = true;
    sauceMat.color.copy(WHITE).lerp(SAUCE_BAKED, b * 0.6);
    cheeseMat.color.copy(CHEESE_RAW).lerp(CHEESE_BAKED, b);
    cheeseMat.roughness = 0.5 - b * 0.22;
    for (const g of layers.values()) for (const m of g.userData.melt || []) applyMelt(m, b);
  }
  function applyMelt(m, b) {
    const { s, lift } = m.userData.melt;
    const e = smooth(0, 1, b);
    m.scale.set(s * (1 + 1.5 * e), s * (1 - 0.7 * e), s * (1 + 1.5 * e));
    m.position.y = TOP + 0.1 * s * (1 - 0.7 * e) + lift * (1 - e * 0.5);
  }

  function toppingIds() { return [...layers.keys()].filter((k) => !['dough', 'sauce', 'cheese'].includes(k) && !leaving.has(layers.get(k))); }

  function setToppings(map, { animate = true } = {}) {
    for (const [id, g] of [...layers]) {
      if (['dough', 'sauce', 'cheese'].includes(id)) continue;
      const q = map[id] || 0;
      if (q !== g.userData.qty) {
        layers.delete(id);
        if (animate) { g.userData.anim = { type: 'out', t: 0 }; leaving.add(g); } else root.remove(g);
      }
    }
    for (const [id, q] of Object.entries(map)) {
      if (!q || layers.has(id) || !TOPPING_SHAPES[id]) continue;
      const g = makeToppingGroup(id, { qty: q, cheeseMat });
      g.userData.qty = q;
      if (animate) g.userData.anim = { type: 'in', t: 0 };
      root.add(g); layers.set(id, g);
      for (const m of g.userData.melt) applyMelt(m, Math.max(0, state.bake));
    }
  }

  function layerOrder() { return state.order ? state.order.filter((k) => layers.has(k)) : ['dough', 'sauce', 'cheese', ...toppingIds()]; }
  function explodeY(id) {
    const order = layerOrder(); const i = order.indexOf(id); if (i < 0) return 0;
    return ((i - (order.length - 1) / 2) * state.gap + state.lift);
  }

  function update(dt) {
    const order = layerOrder();
    order.forEach((id, i) => {
      const g = layers.get(id);
      let y = explodeY(id) * state.explode;
      const an = g.userData.anim;
      if (an && an.type === 'in') {
        an.t = Math.min(1, an.t + dt * 1.25);
        y += (1 - easeOutBounce(an.t)) * 3.2;
        g.scale.setScalar(0.7 + 0.3 * Math.min(1, an.t * 3));
        if (an.t >= 1) { g.userData.anim = null; g.scale.setScalar(1); }
      }
      g.position.y = y;
      g.rotation.y = state.explode * i * 0.22;
    });
    for (const g of leaving) {
      const an = g.userData.anim; an.t += dt * 3.5;
      g.scale.setScalar(Math.max(0.001, 1 - an.t));
      g.position.y += dt * 2;
      if (an.t >= 1) { root.remove(g); leaving.delete(g); }
    }
  }

  setBake(0);
  return {
    root, layers, state, setBake, setToppings, update, explodeY, layerOrder,
    get bake() { return state.bake; },
  };
}

/* ---------- Пар над горячей пиццей ---------- */
export function createSteam(count = 26) {
  const c = makeCanvas(64), ctx = c.getContext('2d');
  blob(ctx, 32, 32, 32, 'rgba(255,255,255,0.9)');
  const tex = new THREE.CanvasTexture(c);
  const group = new THREE.Group();
  const parts = [];
  const r = rng(5);
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    s.userData = { life: r(), speed: 0.35 + r() * 0.4, x: (r() - 0.5) * 3.6, z: (r() - 0.5) * 3.6, drift: (r() - 0.5) * 0.4 };
    group.add(s); parts.push(s);
  }
  return {
    group,
    update(dt, intensity) {
      for (const s of parts) {
        const u = s.userData;
        u.life += dt * u.speed * 0.35;
        if (u.life > 1) { u.life = 0; }
        s.position.set(u.x + Math.sin(u.life * 6) * u.drift, 0.4 + u.life * 3, u.z);
        const sc = 0.4 + u.life * 1.2; s.scale.set(sc, sc, sc);
        s.material.opacity = intensity * 0.1 * Math.sin(u.life * Math.PI);
      }
    },
  };
}

/* ---------- Сцена ---------- */
export function createStage(canvas, { controls = false, groundY = 0, shadowRange = 6, exposure = 0.92 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 6.5, 8);

  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3b2a22, 0.45));
  const key = new THREE.DirectionalLight(0xffe0bc, 1.7);
  key.position.set(5, 10, 4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -shadowRange, right: shadowRange, top: shadowRange, bottom: -shadowRange, near: 1, far: 30 });
  key.shadow.radius = 4; key.shadow.bias = -0.0006;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff8040, 1.3); rim.position.set(-6, 3, -5); scene.add(rim);
  const ember = new THREE.PointLight(0xff5a1a, 0, 14, 1.6); ember.position.set(0, 1.2, 0); scene.add(ember);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.38 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = groundY; ground.receiveShadow = true;
  scene.add(ground);

  let orbit = null;
  if (controls) {
    orbit = new OrbitControls(camera, canvas);
    Object.assign(orbit, { enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08, minPolarAngle: 0.15, maxPolarAngle: 1.3, autoRotate: true, autoRotateSpeed: 0.7 });
  }

  const frames = new Set();
  let visible = true, last = performance.now();
  const size = { w: 1, h: 1 };
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    if (w === size.w && h === size.h) return;
    size.w = w; size.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    stage.onResize?.(w, h);
  }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }).observe(canvas);

  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    resize();
    for (const f of frames) f(dt, now / 1000);
    orbit?.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  const stage = { renderer, scene, camera, orbit, ground, ember, key, size, onFrame: (f) => frames.add(f), onResize: null };
  return stage;
}

/* ---------- Превью-рендеры (меню, иконки ингредиентов) ---------- */
export async function renderThumbnails(jobs, { width = 480, height = 400 } = {}) {
  const canvas = makeCanvas(width, height);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const out = [];
  for (const job of jobs) {
    const scene = new THREE.Scene(); scene.environment = env;
    scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3b2a22, 0.6));
    const key = new THREE.DirectionalLight(0xffe0bc, 1.8); key.position.set(4, 9, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8040, 1.2); rim.position.set(-6, 3, -5); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.35 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
    if (job.type === 'pizza') {
      const p = createPizza({ seed: job.seed || 7 });
      p.setToppings(job.toppings || {}, { animate: false });
      p.setBake(job.bake ?? 1); p.update(0);
      p.root.rotation.y = job.rot ?? 0.4;
      scene.add(p.root);
      camera.position.set(0, 7.4, 8.6); camera.lookAt(0, -0.3, 0);
    } else {
      const g = makeToppingGroup(job.id, { count: job.count || 6, radius: job.radius || 0.42, seed: 3 });
      if (job.id === 'mozz') for (const m of g.userData.melt) { m.position.y = TOP + 0.1 * m.userData.melt.s; }
      g.position.y = -TOP; scene.add(g);
      camera.position.set(0, 1.25, 1.45); camera.lookAt(0, 0.0, 0);
      ground.material.opacity = 0.25;
    }
    renderer.render(scene, camera);
    out.push(canvas.toDataURL('image/png'));
    await new Promise((res) => setTimeout(res, 0));
  }
  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
