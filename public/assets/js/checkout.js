/* checkout.js — sends the cart (IDs + quantities only) to the serverless endpoint,
   then redirects the browser to the Stripe-hosted checkout page. */

async function startCheckout(buttonEl, errorEl) {
  const cart = readCart();
  if (cart.length === 0) return;

  const items = cart.map((i) => ({
    productId: i.productId,
    variantId: i.variantId,
    quantity: i.qty,
  }));

  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.dataset.label = buttonEl.textContent;
    buttonEl.textContent = 'Taking you to checkout…';
  }
  if (errorEl) errorEl.textContent = '';

  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Could not start checkout. Please try again.');
    }
    window.location.href = data.url;
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message || 'Something went wrong. Please try again.';
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = buttonEl.dataset.label || 'Checkout';
    }
  }
}
