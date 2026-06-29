# Make the Stripe publishable key configurable

> **Status: deferred.** Tracked by a `TODO` in
> `client/pages/orders/[orderId].js`. Not urgent — see "Why it's not a
> security issue" below.

## Current state

The Stripe **publishable** key (`pk_test_…`) is hardcoded in
`client/pages/orders/[orderId].js`:

```js
const STRIPE_PUBLISHABLE_KEY = 'pk_test_…';
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
```

## Why it's not a security issue

This is the **publishable** key, not the secret key:

- The publishable key is meant to be public. Stripe.js runs in the browser and
  needs it to tokenize cards, so it is always shipped to every visitor — there
  is no way to hide it. Hardcoding it leaks nothing.
- The **secret** key (`sk_…`) is the sensitive one (it can create charges,
  refunds, read customer data). It is already kept out of the codebase: it is
  injected into the `payments` service as the `STRIPE_KEY` env var from the
  `stripe-secret` Kubernetes secret.

So the change below is about **configurability and convention**, not security.

## What we want instead

Read the key from an environment variable so test/live keys can be swapped per
environment without editing source.

### Option A — build-time (`NEXT_PUBLIC_STRIPE_KEY`), simplest

```js
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY);
```

**Caveat:** Next.js inlines `NEXT_PUBLIC_*` at **build time** (`next build` in
`client/Dockerfile`), not runtime. CI builds one image that runs in every
environment, so the key is baked in at build time. That is fine if the
test-vs-live choice is made when the image is built, but it cannot be overridden
per deployment via a k8s configmap the way `BASE_URL` is.

To wire this up:
1. Set `NEXT_PUBLIC_STRIPE_KEY` as a build arg / env in `client/Dockerfile`
   before `npm run build`.
2. Provide it in CI (`deploy-client.yaml`) from a repo secret.

### Option B — runtime (`publicRuntimeConfig`), fully per-environment

Use `next.config.js` `publicRuntimeConfig` (or pass the key from
`getInitialProps` as a prop) so the value is read at request time and can come
from a k8s configmap/secret, matching how `BASE_URL` already works. More
plumbing; only worth it if the same image must serve both test and live with
different keys.

## Recommendation

For the current single-account demo, **Option A** is the right amount of effort:
it follows convention and removes the literal from source, and the build-time
caveat does not matter because the demo only ever uses the test key.
