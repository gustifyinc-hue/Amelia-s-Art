// Server-authoritative catalog. This is the SINGLE SOURCE OF TRUTH for prices and for the
// CJ Dropshipping IDs used at fulfillment. The browser never sends prices — it sends only
// productId + variantId + quantity, and the server looks everything up here. This prevents
// a customer from editing prices in devtools.
//
// To add/rename variants: edit the `name` (shown to customers) and keep `cjVid` matching the
// real CJ variant ID. Prices are in integer cents.

const PRODUCTS = [
  {
    id: 'carving-lamp',
    name: 'Creative 3D Hollow Paper-Cut Light & Shadow Carving Lamp',
    priceCents: 3499,
    cjProductId: '1469903155922866176',
    image: 'assets/img/product1.svg',
    blurb: 'A hand-finished layered paper-cut scene that throws a soft glowing shadow when lit.',
    variants: [
      { id: 'carving-a', name: '3 Style', cjVid: '1469903156019335169' },
      { id: 'carving-b', name: '5 Style', cjVid: '1469903156023529472' },
      { id: 'carving-c', name: '6 Style', cjVid: '1469903156023529473' },
    ],
  },
  {
    id: 'gradient-lamp',
    name: 'Light & Shadow Paper Carving Lamp',
    priceCents: 3499,
    cjProductId: '0242BEAF-C7A5-4469-A67E-B461063FC6FE',
    image: 'assets/img/product2.svg',
    blurb: 'A warm gradient USB lamp that layers cut-paper depth into a quiet ambient glow.',
    variants: [
      { id: 'gradient-default', name: 'Gradient (USB)', cjVid: '59C48A3B-20BC-498C-A540-2A8B48505D83' },
    ],
  },
];

function getProduct(productId) {
  return PRODUCTS.find((p) => p.id === productId) || null;
}

// Resolve a cart line {productId, variantId} to authoritative data, or null if invalid.
function resolveLine(productId, variantId) {
  const product = getProduct(productId);
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) return null;
  return {
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    variantName: variant.name,
    priceCents: product.priceCents,
    cjProductId: product.cjProductId,
    cjVid: variant.cjVid,
  };
}

module.exports = { PRODUCTS, getProduct, resolveLine };
