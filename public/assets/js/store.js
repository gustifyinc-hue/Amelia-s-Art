/* store.js — display catalog (mirror of server catalog, for rendering only) + cart logic.
   Prices here are for DISPLAY. The real charge is always recomputed server-side from IDs,
   so tampering with these values does nothing to the amount charged. */

const CATALOG = [
  {
    id: 'carving-lamp',
    name: 'Creative 3D Hollow Paper-Cut Light & Shadow Carving Lamp',
    priceCents: 3499,
    image: 'assets/img/product1.svg',
    blurb: 'A hand-finished layered paper-cut scene that throws a soft glowing shadow when lit. Warm LED, USB powered.',
    longDesc:
      "Each lamp is layered, cut, and finished by hand so the light catches every edge of the scene. Switch it on and the room fills with a warm, storybook glow — perfect on a shelf, desk, or bedside table. USB powered, low-heat LED, runs all night.",
    variants: [
      { id: 'carving-a', name: 'Design A' },
      { id: 'carving-b', name: 'Design B' },
      { id: 'carving-c', name: 'Design C' },
    ],
  },
  {
    id: 'gradient-lamp',
    name: 'Light & Shadow Paper Carving Lamp',
    priceCents: 3499,
    image: 'assets/img/product2.svg',
    blurb: 'A warm gradient USB lamp that layers cut-paper depth into a quiet ambient glow.',
    longDesc:
      "My quieter piece — a smooth gradient glow behind layered paper cuts. It melts into the background of a room and just makes everything feel a little cozier. USB powered with a soft-touch switch.",
    variants: [
      { id: 'gradient-default', name: 'Gradient (USB)' },
    ],
  },
];

const CART_KEY = 'paperlamp_cart_v1';

function findProduct(productId) {
  return CATALOG.find((p) => p.id === productId) || null;
}
function findVariant(product, variantId) {
  return product ? product.variants.find((v) => v.id === variantId) || null : null;
}

function formatPrice(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function cartCount() {
  return readCart().reduce((n, item) => n + item.qty, 0);
}

function updateCartCount() {
  const el = document.querySelector('[data-cart-count]');
  if (el) {
    const n = cartCount();
    el.textContent = n;
    el.style.display = n > 0 ? 'inline-flex' : 'none';
  }
}

function addToCart(productId, variantId, qty = 1) {
  const product = findProduct(productId);
  const variant = findVariant(product, variantId);
  if (!product || !variant) return false;

  const cart = readCart();
  const existing = cart.find((i) => i.productId === productId && i.variantId === variantId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ productId, variantId, qty });
  }
  writeCart(cart);
  return true;
}

function setQty(productId, variantId, qty) {
  let cart = readCart();
  if (qty <= 0) {
    cart = cart.filter((i) => !(i.productId === productId && i.variantId === variantId));
  } else {
    const item = cart.find((i) => i.productId === productId && i.variantId === variantId);
    if (item) item.qty = qty;
  }
  writeCart(cart);
}

function removeFromCart(productId, variantId) {
  const cart = readCart().filter((i) => !(i.productId === productId && i.variantId === variantId));
  writeCart(cart);
}

function cartSubtotalCents() {
  return readCart().reduce((sum, item) => {
    const p = findProduct(item.productId);
    return sum + (p ? p.priceCents * item.qty : 0);
  }, 0);
}

document.addEventListener('DOMContentLoaded', updateCartCount);
