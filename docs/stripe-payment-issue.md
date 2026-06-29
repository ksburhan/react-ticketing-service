# Stripe payment failure — root cause & fix

> **Status: implemented.** The `payments` service and the client checkout were
> migrated off the legacy Charges API to Payment Intents. The sections below
> describe the original failure, the root cause, and the shape of the fix that
> shipped.

## Symptom

On the live site, the full purchase flow works right up to the final step:
signup → create ticket → reserve a ticket all succeed, but **paying always
fails**. The `payments` service returns `HTTP 400` with a generic
`{"message":{"message":"Something went wrong"}}`, and the order stays
`status: "created"` instead of moving to `complete`.

This reproduces with every test card we tried:

- `tok_visa` (Stripe's canned test token)
- a freshly tokenized `4242 4242 4242 4242` via the publishable test key

So it is **not** a bad card number, not a frontend bug, and not an event-propagation
problem — the charge itself is being rejected by Stripe.

## Root cause

The `payments` service uses Stripe's **legacy Charges API**:

```ts
// payments/src/routes/new.ts
await stripe.charges.create({
  currency: 'eur',
  amount: order.price * 100,
  source: token,
});
```

The connected Stripe account is registered in **Japan**. Japanese regulation
mandates **3D Secure / Strong Customer Authentication (SCA)** on card payments,
and the legacy Charges API **cannot perform 3DS** — it has no step to hand the
customer back to the bank for the authentication challenge.

When Stripe sees a charge that legally requires authentication but is sent through
an API that can't do it, it rejects the charge with:

```
StripeCardError: authentication_required
```

Our route catches that and collapses it into the generic
`"Something went wrong"` 400, which is why the surface error looked opaque.

**This is not a deployment bug.** The same code would fail the same way on a local
cluster — it is a mismatch between the legacy API and the account's regulatory
region. It only surfaced now because this is the first time real charges were run
against this Stripe account.

## The fix: migrate to the Payment Intents API

The Charges API is deprecated for exactly this reason. The Payment Intents API is
built around SCA/3DS: it creates an intent server-side, the client confirms it
(running any 3DS challenge in the browser), and the server reacts to the final
status.

### 1. Backend — `payments/src/routes/new.ts`

Replace the one-shot charge with a Payment Intent:

```ts
const paymentIntent = await stripe.paymentIntents.create({
  amount: order.price * 100,
  currency: 'eur',
  payment_method: paymentMethodId,   // sent from the client
  confirm: true,
  automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
});

if (paymentIntent.status === 'requires_action') {
  // hand client_secret back so the browser can run the 3DS challenge
  return res.status(200).send({
    requiresAction: true,
    clientSecret: paymentIntent.client_secret,
  });
}

if (paymentIntent.status !== 'succeeded') {
  throw new BadRequestError('Payment failed');
}
```

The `Payment` model already stores a `stripeId`; it now holds the
`paymentIntent.id`. `PaymentCreated` is published only once the intent reaches
`succeeded` — either on this first call (no 3DS) or via the confirm endpoint
below (after 3DS).

The shared "save `Payment` + publish `PaymentCreated`" step was extracted into
`payments/src/record-payment.ts` so both the create and confirm routes reuse it.

### 1b. Backend — `payments/src/routes/confirm.ts` (new route)

When the first call returns `requires_action`, the browser runs the 3DS
challenge, then calls `POST /api/payments/confirm` with the intent id. The route
re-validates the order, retrieves the intent, and only records the payment if it
is now `succeeded`:

```ts
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
if (paymentIntent.status !== 'succeeded') {
  throw new BadRequestError('Payment not completed');
}
await recordPayment(order.id, paymentIntent.id);
```

This is registered alongside `createChargeRouter` in `payments/src/app.ts`.

### 2. Frontend — `client/pages/orders/[orderId].js`

Swapped `react-stripe-checkout` (which only produces a legacy `source`/token) for
**`@stripe/stripe-js` + `@stripe/react-stripe-js`** (Elements). The flow:

1. Wrap the page in `<Elements stripe={stripePromise}>` and render a
   `<CardElement>` inside a `<CheckoutForm>`.
2. On submit, `stripe.createPaymentMethod({ type: 'card', card })` and POST the
   `paymentMethodId` to `/api/payments`.
3. If the backend replies `requiresAction`, call
   `stripe.confirmCardPayment(clientSecret)` to run the 3DS modal, then POST the
   `paymentIntentId` to `/api/payments/confirm`.
4. On success, redirect to `/orders`.

### 3. Tests

- `payments/src/routes/__test__/new.test.ts`: the Stripe `__mocks__` now expose
  `paymentIntents.create`/`retrieve`; assertions check the intent options and add
  a `requires_action` (3DS) case that asserts no payment is recorded.
- `payments/src/routes/__test__/confirm.test.ts` (new): covers the succeeded
  path (records + publishes), a non-succeeded intent (400), and another user's
  order (401).

All 12 payment-service tests pass under Node 20.

## Scope

- Two backend routes (`new`, `confirm`) + a shared `record-payment` helper.
- One frontend page + a dependency swap (`react-stripe-checkout` →
  `@stripe/stripe-js` + `@stripe/react-stripe-js`).
- Payment-service tests.

No infra, k8s, or event-schema changes — the `PaymentCreated` contract is
unchanged; only *when* and *with what id* it is published changed.

## References

- Stripe — Payment Intents API: https://stripe.com/docs/payments/payment-intents
- Stripe — Migrating off Charges to Payment Intents: https://stripe.com/docs/payments/payment-intents/migration
- Stripe — Strong Customer Authentication (SCA): https://stripe.com/docs/strong-customer-authentication
