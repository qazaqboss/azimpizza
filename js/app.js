import * as THREE from 'three';
import { createStage, createPizza, createSteam, renderThumbnails, smooth } from './pizza3d.js';
import { SIZES, BASE, TOPPINGS, PRESETS, WHATSAPP_PHONE, calc, size, topping, toppingPrice, fmt, mmss } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const hhmm = (d) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const isNarrow = () => window.innerWidth < 760;

/* =====================================================================
   1. АНАТОМИЯ — пицца разобрана на слои, собирается скроллом и печётся
   ===================================================================== */
const HERO_TOPS = { ham: 1, redonion: 1, 'olive-green': 1, 'olive-black': 1, jalapeno: 1 };
const HERO_ORDER = ['dough', 'sauce', 'cheese', 'ham', 'redonion', 'olive-green', 'olive-black', 'jalapeno'];
const HERO_LABELS = {
  dough: ['Тесто', '24 часа ферментации', 3.05],
  sauce: ['Томатный соус', 'варится каждое утро', 2.4],
  cheese: ['Моцарелла', 'кубики, режем перед сборкой', 2.15],
  ham: ['Ветчина', 'тонкие лепестки', 2.2],
  redonion: ['Красный лук', 'кольцами, вручную', 2.2],
  'olive-green': ['Зелёные оливки', 'без косточки', 2.15],
  'olive-black': ['Маслины', 'без косточки', 2.15],
  jalapeno: ['Халапеньо', 'для огонька', 2.1],
};

function initHero() {
  const section = $('#anatomy');
  const canvas = $('#heroCanvas');
  const stage = createStage(canvas, { shadowRange: 7 });
  const pizza = createPizza({ seed: 7 });
  pizza.setToppings(HERO_TOPS, { animate: false });
  pizza.state.order = HERO_ORDER;
  pizza.state.gap = 0.78;
  pizza.state.lift = 0.9;
  stage.scene.add(pizza.root);
  const steam = createSteam();
  stage.scene.add(steam.group);

  // подписи-«выноски» как в анатомическом атласе
  const labelsEl = $('#labels'), svg = $('#leaders');
  const items = HERO_ORDER.map((id, i) => {
    const [title, sub, ar] = HERO_LABELS[id];
    const el = document.createElement('div');
    el.className = 'label';
    el.innerHTML = `<b><i>${String(i + 1).padStart(2, '0')}</i>${title}</b><span>${sub}</span>`;
    labelsEl.appendChild(el);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '3');
    svg.append(line, dot);
    return { id, el, line, dot, ar };
  });

  const steps = [...document.querySelectorAll('.step')];
  const bar = $('#heroBar'), timer = $('#heroTimer'), glow = $('#ovenGlow'), hint = $('#scrollHint');
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });

  const camA = new THREE.Vector3(), camB = new THREE.Vector3(), tgt = new THREE.Vector3(), v = new THREE.Vector3();
  let progress = 0, smoothP = 0, spin = 0;
  const readScroll = () => {
    const r = section.getBoundingClientRect();
    progress = clamp01(-r.top / (r.height - innerHeight));
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  stage.onResize = (w, h) => {
    if (isNarrow()) stage.camera.setViewOffset(w, h, 0, h * 0.17, w, h);
    else stage.camera.setViewOffset(w, h, -w * 0.14, 0, w, h);
  };

  stage.onFrame((dt) => {
    smoothP = lerp(smoothP, progress, 1 - Math.pow(0.001, dt));
    const p = smoothP;
    const e = 1 - smooth(0.1, 0.58, p);       // насколько разобрана
    const b = smooth(0.66, 0.94, p);          // насколько испечена
    const narrow = isNarrow();
    const s = narrow ? 0.66 : 1;

    pizza.state.explode = e;
    pizza.setBake(b);
    pizza.update(dt);
    pizza.root.scale.setScalar(s);
    spin += dt * (0.16 + e * 0.1);
    mouse.x = lerp(mouse.x, mouse.tx, 0.05); mouse.y = lerp(mouse.y, mouse.ty, 0.05);
    pizza.root.rotation.set(mouse.y * 0.12, spin, mouse.x * 0.06);
    stage.ground.position.y = -0.02 - 3.2 * e * s;

    // камера: сбоку для анатомии → сверху для готовой пиццы
    camA.set(0, 2.4, 15.5); camB.set(0, 8.6, 8.4);
    stage.camera.position.lerpVectors(camA, camB, 1 - e);
    if (narrow) stage.camera.position.multiplyScalar(1.05);
    tgt.set(0, lerp(0.15, -0.4, 1 - e), 0);
    stage.camera.lookAt(tgt);
    stage.camera.updateMatrixWorld();

    stage.ember.intensity = 22 * Math.sin(b * Math.PI);
    steam.update(dt, smooth(0.9, 1, p));
    glow.style.opacity = (Math.sin(b * Math.PI) * 0.9 + (b > 0.99 ? 0.15 : 0)).toFixed(3);

    // UI
    bar.style.width = (p * 100).toFixed(1) + '%';
    const si = p < 0.3 ? 0 : p < 0.64 ? 1 : 2;
    steps.forEach((el, i) => el.classList.toggle('active', i === si));
    timer.style.opacity = b > 0.01 ? 1 : 0;
    timer.querySelector('b').textContent = b >= 0.999 ? 'готово' : mmss(180 * b);
    hint.style.opacity = p > 0.03 ? 0 : 1;

    // выноски
    const W = stage.size.w, H = stage.size.h;
    const op = smooth(0.35, 0.92, e);
    labelsEl.style.opacity = op; svg.style.opacity = op;
    if (op < 0.01) return;
    const pts = items.map((it) => {
      const y = (pizza.layers.get(it.id)?.position.y || 0) + 0.25;
      v.set(it.ar * s, y * s, 0).project(stage.camera);
      const edge = new THREE.Vector3(3.15 * s, y * s, 0).project(stage.camera);
      return { it, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, ex: (edge.x + 1) / 2 * W };
    });
    const col = Math.min(W - (narrow ? 96 : 210), Math.max(...pts.map((q) => q.ex)) + (narrow ? 14 : 44));
    for (const q of pts) {
      q.it.el.style.transform = `translate(${col.toFixed(1)}px, ${(q.y - 16).toFixed(1)}px)`;
      q.it.line.setAttribute('x1', q.x); q.it.line.setAttribute('y1', q.y);
      q.it.line.setAttribute('x2', col - 6); q.it.line.setAttribute('y2', q.y);
      q.it.dot.setAttribute('cx', q.x); q.it.dot.setAttribute('cy', q.y);
    }
  });
}

/* =====================================================================
   2. СВЕЖЕСТЬ — живые часы и появление шагов
   ===================================================================== */
function initFresh() {
  const el = $('#liveClock');
  const tick = () => {
    const now = new Date();
    const mixed = new Date(now); mixed.setDate(now.getDate() - 1); mixed.setHours(18, 0, 0, 0);
    const mins = Math.floor((now - mixed) / 60000);
    el.textContent = `Сейчас ${hhmm(now)} · тесто на сегодня замешано вчера в 18:00 и созревает уже ${Math.floor(mins / 60)} ч ${mins % 60} мин`;
  };
  tick(); setInterval(tick, 30000);
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.2 });
  document.querySelectorAll('.tl-item').forEach((li) => io.observe(li));
}

/* =====================================================================
   3–4. МЕНЮ И КОНСТРУКТОР
   ===================================================================== */
const B = { size: 'm', tops: {}, preset: null, bake: 0, baking: false, bakedAt: null, explode: false };
let builder;

function sameTops(a, b) {
  const ka = Object.keys(a).filter((k) => a[k]), kb = Object.keys(b).filter((k) => b[k]);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}
function pizzaName() {
  const exact = PRESETS.find((p) => sameTops(p.toppings, B.tops));
  if (exact) return exact.name;
  if (B.preset) return `${PRESETS.find((p) => p.id === B.preset).name} по-своему`;
  return 'Своя пицца';
}
function describeTops(tops) {
  const list = Object.entries(tops).filter(([, q]) => q).map(([id, q]) => topping(id).name.toLowerCase() + (q > 1 ? ' ×2' : ''));
  return list.length ? list.join(', ') : 'только сыр и соус';
}

function initMenu() {
  const grid = $('#menuGrid');
  for (const p of PRESETS) {
    const c = calc(p.size, p.toppings);
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'menu-card'; card.dataset.id = p.id;
    card.innerHTML = `
      <div class="thumb"><div class="spinner"></div><span class="tag">${p.tag}</span></div>
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <div class="menu-meta"><span class="price">${fmt(c.price)}</span><span class="time">${size(p.size).name} · ≈ ${c.totalMin} мин</span></div>
      <span class="open">Открыть в 3D →</span>`;
    card.addEventListener('click', () => { loadPreset(p.id); $('#builder').scrollIntoView({ behavior: 'smooth' }); });
    grid.appendChild(card);
  }
}

function initBuilder() {
  const canvas = $('#builderCanvas');
  const stage = createStage(canvas, { controls: true, shadowRange: 6 });
  stage.camera.position.set(0, 8.6, 9.6);
  stage.orbit.target.set(0, 0, 0);
  const pizza = createPizza({ seed: 11 });
  stage.scene.add(pizza.root);
  const steam = createSteam();
  stage.scene.add(steam.group);
  builder = { stage, pizza, steam };

  // размеры
  const sizesEl = $('#sizes');
  for (const s of SIZES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'size-btn'; b.dataset.id = s.id;
    b.innerHTML = `<div class="disc" style="transform:scale(${s.scale})"></div><b>${s.name}</b><span>${s.label} · ${fmt(s.price)}</span>`;
    b.addEventListener('click', () => { B.size = s.id; resetBake(); refresh(); });
    sizesEl.appendChild(b);
  }
  // основа
  $('#baseList').innerHTML = BASE.map((x) => `<div class="base-item"><b>${x.name}</b><span>● ${x.fresh}</span></div>`).join('');
  // ингредиенты
  const topsEl = $('#toppings');
  for (const t of TOPPINGS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'top-btn'; b.dataset.id = t.id; b.title = t.fresh;
    b.innerHTML = `<span class="ico" data-ico="${t.id}"></span><span><b>${t.name}${t.hot ? ' 🌶' : ''}</b><small class="tp"></small><span class="hint">${t.fresh}</span></span><span class="qty"></span>`;
    b.addEventListener('click', () => {
      const q = B.tops[t.id] || 0;
      B.tops[t.id] = (q + 1) % 3;
      if (!B.tops[t.id]) delete B.tops[t.id];
      resetBake(); refresh();
    });
    topsEl.appendChild(b);
  }

  $('#explodeBtn').addEventListener('click', () => { B.explode = !B.explode; $('#explodeBtn').classList.toggle('on', B.explode); });
  $('#bakeBtn').addEventListener('click', startBake);
  $('#addCart').addEventListener('click', addToCart);

  // анимация
  const ringFg = $('#ringFg'), ovenTime = $('#ovenTime'), glow = $('#stageGlow'), chip = $('#bakeState');
  let bakeT = 0, explodeT = 0;
  stage.onFrame((dt) => {
    const c = calc(B.size, B.tops);
    if (B.baking) {
      B.bake = Math.min(1, B.bake + dt / 6); // реальные ~3 мин показываем за 6 секунд
      if (B.bake >= 1) { B.baking = false; B.bakedAt = new Date(); $('#bakeBtn').disabled = false; $('#bakeBtn').textContent = '↻ Испечь заново'; toast('Готово! Пицца из печи 🔥'); }
    }
    bakeT = lerp(bakeT, B.bake, B.baking ? 1 : 1 - Math.pow(0.0005, dt));
    pizza.setBake(bakeT);
    explodeT = lerp(explodeT, B.explode ? 1 : 0, 1 - Math.pow(0.02, dt));
    const n = pizza.layerOrder().length;
    pizza.state.gap = Math.min(0.62, 5 / Math.max(1, n - 1));
    pizza.state.lift = 0.6;
    pizza.state.explode = explodeT;
    pizza.update(dt);
    const sc = lerp(pizza.root.scale.x, size(B.size).scale, 1 - Math.pow(0.01, dt));
    pizza.root.scale.setScalar(sc);
    stage.ground.position.y = -0.02 - explodeT * (pizza.state.gap * (n - 1) / 2 - 0.6) * sc;
    stage.orbit.target.y = explodeT * 0.6;

    const heat = B.baking ? Math.sin(Math.min(1, B.bake * 1.2) * Math.PI * 0.5 + 0.0) : 0;
    stage.ember.intensity = lerp(stage.ember.intensity, heat * 20, 0.1);
    glow.style.opacity = (heat * 0.9).toFixed(2);
    const fresh = B.bakedAt ? clamp01(1 - (Date.now() - B.bakedAt) / (15 * 60000)) : 0;
    steam.update(dt, Math.max(B.baking ? B.bake : 0, fresh) * sc);

    const remain = c.bake * (1 - B.bake);
    ringFg.style.strokeDashoffset = (119.4 * (1 - B.bake)).toFixed(1);
    ovenTime.textContent = B.bake >= 1 ? '✓' : mmss(remain);
    if (B.baking) { chip.textContent = `В печи · 400°C · ${mmss(remain)}`; chip.className = 'chip hot'; }
    else if (B.bakedAt) {
      const m = Math.floor((Date.now() - B.bakedAt) / 60000);
      chip.textContent = m < 15 ? `Горячая · из печи ${m ? m + ' мин назад' : 'только что'}` : `Испечена в ${hhmm(B.bakedAt)}`;
      chip.className = 'chip fresh';
    } else { chip.textContent = 'Сырая · ждёт печь'; chip.className = 'chip'; }
  });

  setInterval(updateSummary, 30000);
}

function startBake() {
  if (B.baking) return;
  if (B.bake >= 1) { B.bake = 0; builder.pizza.setBake(0); }
  B.baking = true; B.bakedAt = null;
  const btn = $('#bakeBtn'); btn.disabled = true; btn.textContent = 'Печётся…';
}
function resetBake() {
  B.baking = false; B.bake = 0; B.bakedAt = null;
  const btn = $('#bakeBtn'); btn.disabled = false; btn.textContent = '🔥 В печь';
}

function loadPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  B.size = p.size; B.tops = { ...p.toppings }; B.preset = p.id;
  resetBake(); refresh();
}

function updateSummary() {
  const c = calc(B.size, B.tops);
  $('#sumWeight').textContent = `${c.grams} г`;
  $('#sumBake').textContent = mmss(c.bake);
  const ready = new Date(Date.now() + c.totalMin * 60000);
  $('#sumReady').textContent = `${hhmm(ready)} · ${c.totalMin} мин`;
  $('#sumPrice').textContent = fmt(c.price);
  $('#sumName').textContent = `${pizzaName()} · ${size(B.size).name}`;
  if (!B.baking && B.bake === 0) $('#ovenTime').textContent = mmss(c.bake);
}

function refresh() {
  builder.pizza.setToppings(B.tops);
  document.querySelectorAll('.size-btn').forEach((b) => b.classList.toggle('on', b.dataset.id === B.size));
  document.querySelectorAll('.top-btn').forEach((b) => {
    const q = B.tops[b.dataset.id] || 0;
    b.classList.toggle('on', q > 0);
    b.querySelector('.qty').textContent = q > 1 ? '×2' : '✓';
    b.querySelector('.tp').textContent = '+' + fmt(toppingPrice(b.dataset.id, B.size));
  });
  updateSummary();
}

/* ---------- 3D-превью для меню и иконок ---------- */
async function renderPreviews() {
  const menuJobs = PRESETS.map((p, i) => ({ type: 'pizza', toppings: p.toppings, seed: 20 + i, rot: 0.3 + i }));
  const menuImgs = await renderThumbnails(menuJobs, { width: 520, height: 430 });
  menuImgs.forEach((src, i) => {
    const thumb = $(`.menu-card[data-id="${PRESETS[i].id}"] .thumb`);
    thumb.querySelector('.spinner')?.remove();
    const img = new Image(); img.src = src; img.alt = PRESETS[i].name;
    thumb.prepend(img);
  });
  PREVIEW_CACHE.menu = Object.fromEntries(PRESETS.map((p, i) => [p.id, menuImgs[i]]));
  const icoImgs = await renderThumbnails(TOPPINGS.map((t) => ({ type: 'topping', id: t.id, count: t.id === 'ham' || t.id === 'pepperoni' ? 3 : t.id === 'corn' || t.id === 'jalapeno' ? 14 : 6, radius: 0.42 })), { width: 160, height: 160 });
  icoImgs.forEach((src, i) => { const el = $(`[data-ico="${TOPPINGS[i].id}"]`); el.innerHTML = `<img src="${src}" alt="">`; });
}
const PREVIEW_CACHE = { menu: {} };

/* =====================================================================
   5. КОРЗИНА И ЗАКАЗ
   ===================================================================== */
let cart = [];
try { cart = JSON.parse(localStorage.getItem('azim-cart') || '[]'); } catch { cart = []; }
const saveCart = () => { try { localStorage.setItem('azim-cart', JSON.stringify(cart)); } catch { /* приватный режим */ } };

function snapshot() {
  const { stage } = builder;
  stage.renderer.render(stage.scene, stage.camera);
  const src = stage.renderer.domElement;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a1d16'; ctx.fillRect(0, 0, 128, 128);
  const s = Math.min(src.width, src.height);
  ctx.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, 128, 128);
  return c.toDataURL('image/jpeg', 0.8);
}

function addToCart() {
  const c = calc(B.size, B.tops);
  cart.push({ name: pizzaName(), size: B.size, tops: { ...B.tops }, price: c.price, min: c.totalMin, img: snapshot() });
  saveCart(); renderCart();
  const btn = $('#cartOpen'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  toast(`«${pizzaName()}» в корзине`);
}

function renderCart() {
  $('#cartCount').textContent = cart.length;
  const list = $('#cartList');
  if (!cart.length) list.innerHTML = '<div class="cart-empty">Корзина пока пустая.<br>Соберите пиццу в конструкторе 🍕</div>';
  else list.innerHTML = cart.map((it, i) => `
    <div class="cart-item">
      <img src="${it.img || ''}" alt="">
      <div><b>${it.name}</b><small>${size(it.size).name} · ${describeTops(it.tops)}</small></div>
      <div class="right"><b>${fmt(it.price)}</b><button class="rm" data-i="${i}">убрать</button></div>
    </div>`).join('');
  list.querySelectorAll('.rm').forEach((b) => b.addEventListener('click', () => { cart.splice(+b.dataset.i, 1); saveCart(); renderCart(); }));
  const total = cart.reduce((s, x) => s + x.price, 0);
  const mins = cart.length ? Math.max(...cart.map((x) => x.min)) + 3 * (cart.length - 1) : 0;
  $('#cartTotal').textContent = fmt(total);
  $('#cartTime').textContent = cart.length ? `≈ ${mins} мин` : '—';
  const lines = cart.map((x, i) => `${i + 1}. ${x.name}, ${size(x.size).name}: ${describeTops(x.tops)} (${fmt(x.price)})`);
  const msg = `Здравствуйте, Азим! Хочу заказать пиццу:\n${lines.join('\n')}\n\nИтого: ${fmt(total)}`;
  const order = $('#orderBtn');
  order.href = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
  order.style.pointerEvents = cart.length ? '' : 'none';
  order.style.opacity = cart.length ? 1 : 0.5;
}

function initCart() {
  const drawer = $('#drawer');
  const open = (v) => { drawer.classList.toggle('open', v); drawer.setAttribute('aria-hidden', String(!v)); };
  $('#cartOpen').addEventListener('click', () => open(true));
  $('#cartClose').addEventListener('click', () => open(false));
  drawer.addEventListener('click', (e) => { if (e.target === drawer) open(false); });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && open(false));
  renderCart();
}

let toastTimer;
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- старт ---------- */
$('#year').textContent = new Date().getFullYear();
initHero();
initFresh();
initMenu();
initBuilder();
loadPreset('azim');
initCart();
setTimeout(() => renderPreviews().catch((e) => console.warn('preview', e)), 400);
