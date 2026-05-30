# Lumen & Paper — handmade paper-lamp store

A custom storefront that takes **real card payments** with Stripe and **auto-places
supplier orders** with CJ Dropshipping. No Shopify subscription — you only pay Stripe's
per-sale fee (~2.9% + $0.30).

- **Frontend:** static HTML/CSS/JS in `public/` (homepage, product page, cart, success/cancel).
- **Backend:** two Vercel serverless functions in `api/`.
- **Payments:** Stripe Checkout (Stripe hosts the secure card page — cards + Apple/Google Pay).
- **Fulfillment:** on a paid order, a Stripe webhook calls the CJ API to place the dropship order.

```
store/
  public/        # the website (deployed as static files)
  api/           # serverless functions
    create-checkout-session.js   # builds the Stripe Checkout session
    fulfill-order.js             # Stripe webhook -> places the CJ order
  lib/catalog.js # SINGLE source of truth for prices + CJ product/variant IDs
```

---

## How a sale works

1. Customer adds lamp(s) to cart (stored in their browser) and clicks **Checkout**.
2. The browser sends only product **IDs + quantities** to `/api/create-checkout-session`.
3. The server looks up the **real price** from `lib/catalog.js` (so prices can't be tampered
   with) and redirects the customer to Stripe's hosted payment page.
4. Customer pays. Stripe redirects them to `success.html`.
5. Stripe **pays out to your bank** automatically (~2 business days; first payout ~7 days).
6. Stripe fires the `checkout.session.completed` webhook → `/api/fulfill-order.js`, which
   verifies the signature, reads the order, and **auto-places it on CJ** with the customer's
   shipping address. The CJ order id is logged.

---

## One-time setup (you have nothing yet — do these in order)

### 1. Stripe account
1. Create an account at https://dashboard.stripe.com and activate it (business info + bank
   account — this is where payouts land).
2. Get your **secret key** at https://dashboard.stripe.com/apikeys. Use the **test** key
   (`sk_test_...`) first; switch to the **live** key (`sk_live_...`) when you go live.

### 2. CJ Dropshipping account + API key
1. Create an account at https://cjdropshipping.com and find/list your two lamps.
2. Go to the **Developer** area: https://developers.cjdropshipping.com → generate an
   **API key**.
3. Note your CJ **login email** and the **API key** — these become `CJ_EMAIL` and `CJ_API_KEY`.
4. The product/variant IDs are already wired in `lib/catalog.js`:
   - Product 1 `CJSN137818802BY` → variants `CJSN137818803CX`, `CJSN137818805EV`, `CJSN137818806FU`
   - Product 2 `CJJZLELE00312-Gradient-USB` (single SKU)
   > If CJ's order API expects a different `vid` than the SKU for Product 2, update `cjVid`
   > in `lib/catalog.js`.

### 3. Vercel account (free hosting)
1. Create an account at https://vercel.com.
2. Install the CLI: `npm i -g vercel`.

---

## Run locally

```bash
cd store
npm install
cp .env.local.example .env.local   # then fill in your real keys (Windows: copy the file)
vercel dev                         # serves the site + /api at http://localhost:3000
```

### Test the full payment + fulfillment flow (test mode)
1. In another terminal, forward webhooks to your local function:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/fulfill-order
   ```
   Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` in `.env.local`, then restart `vercel dev`.
2. Open http://localhost:3000, add a lamp, go to cart, click **Checkout securely**.
3. Pay with the Stripe test card: **`4242 4242 4242 4242`**, any future expiry, any CVC, any ZIP.
4. You should land on `success.html`. Check:
   - The order appears in the Stripe Dashboard (test mode) with the shipping address.
   - The `vercel dev` console logs `CJ order placed … CJ=<id>` (or a clear CJ error).

---

## Deploy

```bash
cd store
vercel            # first deploy (preview)
vercel --prod     # production
```

Then in the Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | your `sk_test_...` (then `sk_live_...` when live) |
| `STRIPE_WEBHOOK_SECRET` | the signing secret from the Stripe webhook endpoint (next step) |
| `CJ_EMAIL` | your CJ login email |
| `CJ_API_KEY` | your CJ API key |
| `PUBLIC_BASE_URL` | your deployed URL, e.g. `https://your-store.vercel.app` |

### Register the Stripe webhook (production)
1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://YOUR-DOMAIN/api/fulfill-order`
3. Event to send: **`checkout.session.completed`**.
4. Copy the endpoint's **Signing secret** (`whsec_...`) into the `STRIPE_WEBHOOK_SECRET`
   env var in Vercel, then redeploy.

---

## Going live (real money)
1. Swap the Stripe **test** keys for **live** keys in Vercel (`STRIPE_SECRET_KEY` + a live
   webhook endpoint's `STRIPE_WEBHOOK_SECRET`).
2. Make one real low-value purchase end-to-end.
3. Confirm: Stripe shows the payment + a scheduled payout, and CJ shows the new order.

---

## Editing the store
- **Prices / variant names / CJ IDs:** edit `lib/catalog.js` (authoritative) **and** the
  display copy in `public/assets/js/store.js` (names, blurbs, images). Keep the `id`s matching
  between the two files.
- **Product photos:** drop real images into `public/assets/img/` and update the `image`
  paths in `store.js` + `lib/catalog.js`. (Placeholder SVGs ship by default.)
- **Store name / story / colors:** `public/index.html` and `public/assets/css/styles.css`.

## Notes & limits
- Every card processor charges a fee — Stripe is ~2.9% + $0.30/sale. There is no 0% option.
- Fulfillment success still depends on CJ stock/logistics. If a CJ order fails, the webhook
  logs the error (Vercel → your project → **Logs**) so you can place it manually in CJ.
- The cart lives in the customer's browser (`localStorage`) — there's no database or login.
