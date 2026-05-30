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
    cjProductId: 'CJSN137818802BY',
    image: 'assets/img/product1.svg',
    blurb: 'A hand-finished layered paper-cut scene that throws a soft glowing shadow when lit.',
    // Rename these display names to whatever the three real designs are.
    variants: [
      { id: 'carving-a', name: 'Design A', cjVid: 'CJSN137818803CX' },
      { id: 'carving-b', name: 'Design B', cjVid: 'CJSN137818805EV' },
      { id: 'carving-c', name: 'Design C', cjVid: 'CJSN137818806FU' },
    ],
  },
  {
    id: 'gradient-lamp',
    name: 'Light & Shadow Paper Carving Lamp',
    priceCents: 3499,
    cjProductId: 'CJJZLELE00312-Gradient-USB',
    image: 'assets/img/product2.svg',
    blurb: 'A warm gradient USB lamp that layers cut-paper depth into a quiet ambient glow.',
    // Single-SKU product. The CJ id supplied was a SKU; if CJ expects a different `vid`
    // for the order line, update cjVid below to the real variant id from your CJ listing.
    variants: [
      { id: 'gradient-default', name: 'Gradient (USB)', cjVid: 'CJJZLELE00312-Gradient-USB' },
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
