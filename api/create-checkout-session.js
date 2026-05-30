// POST /api/create-checkout-session
// Body: { items: [{ productId, variantId, quantity }] }
// Returns: { url } -> the Stripe-hosted Checkout page. Prices are recomputed here from the
// server catalog, so the client cannot influence the amount charged.

const Stripe = require('stripe');
const { resolveLine } = require('../lib/catalog');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Where CJ can ship. Broad list so worldwide customers aren't blocked at checkout.
const SHIP_COUNTRIES = [
  'US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE',
  'SE', 'NO', 'DK', 'FI', 'AT', 'CH', 'PL', 'CZ', 'JP', 'SG', 'AE', 'BR', 'MX',
];

function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }

    const line_items = [];
    const cartMeta = []; // compact mapping the webhook uses to place the CJ order

    for (const item of items) {
      const qty = Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 0));
      if (!qty) continue;
      const line = resolveLine(item.productId, item.variantId);
      if (!line) {
        res.status(400).json({ error: 'One of the items is no longer available.' });
        return;
      }
      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'usd',
          unit_amount: line.priceCents,
          product_data: {
            name: line.name,
            description: line.variantName,
            metadata: { productId: line.productId, variantId: line.variantId, cjVid: line.cjVid },
          },
        },
      });
      cartMeta.push({ p: line.productId, v: line.variantId, q: qty });
    }

    if (line_items.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }

    const baseUrl = getBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: SHIP_COUNTRIES },
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      // Compact cart stored for the fulfillment webhook (Stripe metadata: <500 chars/value).
      metadata: { cart: JSON.stringify(cartMeta) },
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel.html`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
};
