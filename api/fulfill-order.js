// POST /api/fulfill-order  — Stripe webhook endpoint that drives auto-fulfillment.
const Stripe = require('stripe');
const { resolveLine } = require('../lib/catalog');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

const COUNTRY_NAMES = {
  AF:'Afghanistan',AR:'Argentina',AU:'Australia',AT:'Austria',BE:'Belgium',BR:'Brazil',
  CA:'Canada',CL:'Chile',CN:'China',CO:'Colombia',HR:'Croatia',CZ:'Czech Republic',
  DK:'Denmark',EG:'Egypt',FI:'Finland',FR:'France',DE:'Germany',GR:'Greece',
  HK:'Hong Kong',HU:'Hungary',IN:'India',ID:'Indonesia',IE:'Ireland',IL:'Israel',
  IT:'Italy',JP:'Japan',JO:'Jordan',KZ:'Kazakhstan',KE:'Kenya',KW:'Kuwait',
  LT:'Lithuania',LU:'Luxembourg',MY:'Malaysia',MX:'Mexico',MA:'Morocco',NL:'Netherlands',
  NZ:'New Zealand',NG:'Nigeria',NO:'Norway',PK:'Pakistan',PE:'Peru',PH:'Philippines',
  PL:'Poland',PT:'Portugal',QA:'Qatar',RO:'Romania',SA:'Saudi Arabia',SG:'Singapore',
  ZA:'South Africa',KR:'South Korea',ES:'Spain',SE:'Sweden',CH:'Switzerland',
  TW:'Taiwan',TH:'Thailand',TR:'Turkey',UA:'Ukraine',AE:'United Arab Emirates',
  GB:'United Kingdom',US:'United States',VN:'Vietnam',
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function cjAuth() {
  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.CJ_EMAIL, password: process.env.CJ_API_KEY }),
  });
  const data = await res.json();
  if (!data || !data.data || !data.data.accessToken) {
    throw new Error(`CJ auth failed: ${JSON.stringify(data)}`);
  }
  return data.data.accessToken;
}

async function cjCreateOrder(token, order) {
  const res = await fetch(`${CJ_BASE}/shopping/order/createOrderV2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': token },
    body: JSON.stringify(order),
  });
  const data = await res.json();
  if (!data || data.result === false) {
    throw new Error(`CJ createOrder failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function fulfillToCJ(session) {
  let cart = [];
  try {
    cart = JSON.parse(session.metadata && session.metadata.cart ? session.metadata.cart : '[]');
  } catch {
    cart = [];
  }

  const products = [];
  for (const entry of cart) {
    const line = resolveLine(entry.p, entry.v);
    if (!line) {
      console.error(`fulfill-order: unknown item ${entry.p}/${entry.v} — skipping`);
      continue;
    }
    products.push({ vid: line.cjVid, quantity: entry.q });
  }
  if (products.length === 0) throw new Error('No fulfillable line items in session.');

  const ship =
    session.shipping_details ||
    (session.collected_information && session.collected_information.shipping_details) ||
    session.customer_details ||
    {};
  const addr = ship.address || (session.customer_details && session.customer_details.address) || {};
  const name = ship.name || (session.customer_details && session.customer_details.name) || '';
  const phone = (session.customer_details && session.customer_details.phone) || '';

  const countryCode = addr.country || '';
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;

  const order = {
    orderNumber: session.id,
    shippingCustomerName: name,
    shippingPhone: phone,
    shippingCountryCode: countryCode,
    shippingCountry: countryName,
    shippingProvince: addr.state || '',
    shippingCity: addr.city || '',
    shippingAddress: [addr.line1, addr.line2].filter(Boolean).join(', '),
    shippingZip: addr.postal_code || '',
    remark: 'Lumen & Paper order',
    fromCountryCode: 'CN',
    logisticName: 'CJPacket Ordinary',
    products,
  };

  const token = await cjAuth();
  const result = await cjCreateOrder(token, order);
  const cjOrderId =
    (result.data && (result.data.orderId || result.data.orderNum || result.data.cjOrderId)) || 'unknown';
  console.log(`fulfill-order: CJ order placed. Stripe=${session.id} CJ=${cjOrderId}`);
  return cjOrderId;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let event;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('fulfill-order: signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    return;
  }

  if (event.type !== 'checkout.session.completed') {
    res.status(200).json({ received: true, ignored: event.type });
    return;
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    console.log(`fulfill-order: session ${session.id} not paid (${session.payment_status}) — skipping`);
    res.status(200).json({ received: true, skipped: 'not paid' });
    return;
  }

  try {
    const cjOrderId = await fulfillToCJ(session);
    res.status(200).json({ received: true, cjOrderId });
  } catch (err) {
    console.error(`fulfill-order: CJ fulfillment FAILED for Stripe session ${session.id}:`, err.message);
    res.status(200).json({ received: true, fulfillmentError: err.message });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };