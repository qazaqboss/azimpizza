// Меню, цены и время приготовления. Цены в тенге — меняйте здесь.
export const WHATSAPP_PHONE = ''; // например '77011234567' — номер Азима для заказов (без +). Пусто = выбор контакта в WhatsApp

export const SIZES = [
  { id: 's', name: '26 см', label: 'Малая', price: 2900, k: 0.8, bake: 150, grams: 420, scale: 0.84 },
  { id: 'm', name: '32 см', label: 'Средняя', price: 3900, k: 1, bake: 180, grams: 560, scale: 1 },
  { id: 'l', name: '40 см', label: 'Большая', price: 5200, k: 1.35, bake: 220, grams: 820, scale: 1.16 },
];

// Основа всегда включена: тесто 24 ч ферментации + томатный соус + моцарелла
export const BASE = [
  { id: 'dough', name: 'Тесто ручной работы', fresh: 'Созревает 24 часа', note: 'Мука, вода, соль, оливковое масло. Тянем руками, без скалки.' },
  { id: 'sauce', name: 'Томатный соус', fresh: 'Варится каждое утро', note: 'Томаты, чеснок, орегано, щепотка сахара.' },
  { id: 'cheese', name: 'Моцарелла кубиками', fresh: 'Режем перед сборкой', note: 'Кубики плавятся неравномерно — отсюда «пятна» сыра.' },
];

export const TOPPINGS = [
  { id: 'ham', name: 'Ветчина', group: 'Мясо', price: 700, grams: 60, sec: 10, fresh: 'Тонкие лепестки, нарезаны утром', img: 'img/ham.jpg' },
  { id: 'pepperoni', name: 'Пепперони', group: 'Мясо', price: 800, grams: 50, sec: 10, fresh: 'Пикантная колбаса, хрустит по краям' },
  { id: 'mozz', name: 'Двойная моцарелла', group: 'Сыр', price: 600, grams: 80, sec: 20, fresh: 'Ещё кубиков сверху', img: 'img/mozzarella.jpg' },
  { id: 'redonion', name: 'Красный лук', group: 'Овощи', price: 250, grams: 30, sec: 5, fresh: 'Кольца, нарезаны за час', img: 'img/red-onion.jpg' },
  { id: 'onion', name: 'Репчатый лук', group: 'Овощи', price: 200, grams: 30, sec: 5, fresh: 'Мелкая соломка', img: 'img/onion.jpg' },
  { id: 'olive-black', name: 'Маслины', group: 'Овощи', price: 400, grams: 30, sec: 5, fresh: 'Без косточки, кольцами', img: 'img/olives.jpg' },
  { id: 'olive-green', name: 'Зелёные оливки', group: 'Овощи', price: 400, grams: 30, sec: 5, fresh: 'Без косточки, кольцами', img: 'img/olives.jpg' },
  { id: 'jalapeno', name: 'Халапеньо', group: 'Остро', price: 300, grams: 20, sec: 5, fresh: 'Мелко рубленный, для огня', img: 'img/jalapeno.jpg', hot: true },
  { id: 'mushroom', name: 'Шампиньоны', group: 'Овощи', price: 450, grams: 50, sec: 10, fresh: 'Свежие, пластинками' },
  { id: 'pepper', name: 'Болгарский перец', group: 'Овощи', price: 350, grams: 40, sec: 5, fresh: 'Три цвета, полосками' },
  { id: 'corn', name: 'Кукуруза', group: 'Овощи', price: 300, grams: 40, sec: 5, fresh: 'Сладкие зёрна' },
  { id: 'basil', name: 'Базилик', group: 'Зелень', price: 250, grams: 5, sec: 0, fresh: 'Кладём после печи' },
];

export const PRESETS = [
  { id: 'azim', name: 'Азим Классик', tag: 'Фирменная', desc: 'Та самая пицца с фото: ветчина, моцарелла, красный лук, маслины, оливки и капля халапеньо.', size: 'm', toppings: { ham: 1, redonion: 1, 'olive-black': 1, 'olive-green': 1, jalapeno: 1 } },
  { id: 'margo', name: 'Маргарита', tag: 'Классика', desc: 'Тесто, соус, двойная моцарелла и свежий базилик. Ничего лишнего.', size: 'm', toppings: { mozz: 1, basil: 1 } },
  { id: 'fire', name: 'Пепперони Огонь', tag: 'Остро', desc: 'Много пепперони, халапеньо и красный лук.', size: 'm', toppings: { pepperoni: 2, jalapeno: 1, redonion: 1 } },
  { id: 'brat', name: 'По-братски', tag: 'Сытная', desc: 'Ветчина, пепперони, шампиньоны и лук — для большой компании.', size: 'l', toppings: { ham: 1, pepperoni: 1, mushroom: 1, onion: 1 } },
  { id: 'garden', name: 'Огород', tag: 'Овощная', desc: 'Перец, шампиньоны, кукуруза, маслины и красный лук.', size: 'm', toppings: { pepper: 1, mushroom: 1, corn: 1, 'olive-black': 1, redonion: 1 } },
];

const byId = Object.fromEntries(TOPPINGS.map((t) => [t.id, t]));
export const topping = (id) => byId[id];
export const size = (id) => SIZES.find((s) => s.id === id) || SIZES[1];

export const toppingPrice = (id, sizeId) => Math.round((byId[id].price * size(sizeId).k) / 10) * 10;

export function calc(sizeId, tops) {
  const s = size(sizeId);
  let price = s.price, grams = s.grams, bake = s.bake, n = 0;
  for (const [id, q] of Object.entries(tops)) {
    if (!q || !byId[id]) continue;
    price += toppingPrice(id, sizeId) * q;
    grams += Math.round(byId[id].grams * s.k * q);
    bake += byId[id].sec * q;
    n += q;
  }
  const prepMin = 5 + n * 0.5; // растянуть тесто + разложить начинку руками
  const totalMin = Math.ceil(prepMin + bake / 60);
  return { price, grams, bake, prepMin, totalMin, n };
}

export const fmt = (n) => n.toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₸';
export const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
