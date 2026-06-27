# react-ticketing-service

A collection of microservices and a Next.js frontend for a ticket-reselling platform.

Users sign up, list tickets for sale, reserve a ticket (held for 15 minutes), and pay
via Stripe. Services are decoupled over NATS Streaming; each service owns its own
MongoDB and replicates the data it needs via events.

## Architecture at a glance

| Service       | Responsibility                                              | Stack                         |
|---------------|------------------------------------------------------------|-------------------------------|
| `auth`        | Signup / signin / signout, JWT in a cookie-session          | Express + MongoDB             |
| `tickets`     | Create / list / update tickets for sale                     | Express + MongoDB             |
| `orders`      | Reserve a ticket; auto-expires after 15 min if unpaid       | Express + MongoDB             |
| `payments`    | Stripe charge against a reserved order                      | Express + MongoDB             |
| `expiration`  | Bull/Redis delayed-job worker that emits expiration events  | Worker (no HTTP server)       |
| `client`      | Frontend                                                    | Next.js 14 (pages router), JS |
| `common`      | Shared errors, middleware, NATS event base classes/subjects | npm `@monkeytickets/common`   |

Services sit behind an nginx ingress that routes by path prefix:
`/api/users → auth`, `/api/tickets → tickets`, `/api/orders → orders`,
`/api/payments → payments`, `/ → client`. All backend services listen on port `3000`
inside the cluster.

- See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, concurrency model, and CI/CD layout.
- See [`EVENTS.md`](./EVENTS.md) for a complete map of every NATS event, its publisher, and its listeners.

## Prerequisites

- A local Kubernetes cluster (Docker Desktop k8s, kind, or minikube)
- [`skaffold`](https://skaffold.dev/) and `kubectl`
- [`nginx-ingress`](https://kubernetes.github.io/ingress-nginx/deploy/) installed in the cluster
- Node.js 18+ (only needed if you want to run the frontend on its own — see below)
- A Stripe account (test mode) for a Stripe API key

## Local development (full stack)

Local dev runs the whole platform on Kubernetes via Skaffold — **not** docker-compose.

### 1. Point `ticketing.dev` at localhost

The ingress is hostname-bound, so add this line to `/etc/hosts`:

```
127.0.0.1 ticketing.dev
```

### 2. Create the required secrets

The deployment manifests read these from Kubernetes `Secret`s. Skaffold will **not**
create them for you — create them once per cluster before running `skaffold dev`:

```bash
# JWT signing key — used by auth, tickets, orders, payments, and the client (SSR).
# The value can be anything, but it must be present or the pods crash-loop.
kubectl create secret generic jwt-secret \
  --from-literal=JWT_KEY=<any-random-string>

# Stripe secret key (test mode is fine) — used by the payments service.
kubectl create secret generic stripe-secret \
  --from-literal=STRIPE_KEY=<your-stripe-test-secret-key>
```

> Missing either secret is the most common reason a fresh cluster fails to start.
> Verify with `kubectl get secrets` — you should see `jwt-secret` and `stripe-secret`.

### 3. Run it

```bash
skaffold dev
```

This builds all six images, applies `infra/k8s/*` (base) and `infra/k8s-dev/*`
(dev overlays), and live-syncs `src/**/*.ts` (and `*.js` for the client) into the
running pods. The app is served at:

```
https://ticketing.dev
```

(Accept the self-signed certificate.)

### Environment variables

These are set by the deployment manifests, **not** by `.env` files. You don't normally
edit them for local dev, but they're listed here so you know what each service expects:

| Variable                              | Used by                                  | Source                          |
|---------------------------------------|------------------------------------------|---------------------------------|
| `JWT_KEY`                             | auth, tickets, orders, payments, client  | `jwt-secret` (you create it)    |
| `STRIPE_KEY`                          | payments                                 | `stripe-secret` (you create it) |
| `MONGO_URI`                           | auth, tickets, orders, payments          | hardcoded in each `*-depl.yaml` |
| `NATS_URL` / `NATS_CLUSTER_ID` / `NATS_CLIENT_ID` | auth, tickets, orders, payments, expiration | `*-depl.yaml`        |
| `REDIS_HOST`                          | expiration                               | `expiration-depl.yaml`          |
| `BASE_URL`                            | client (server-side data fetching)       | `infra/k8s-dev/client-config.yml` (ConfigMap `ticketing-config`) |

The in-cluster NATS streaming server is reachable at `http://nats-srv:4222` with
cluster id `ticketing`.

## Frontend-only development (no backend required)

You don't need the full Kubernetes stack to work on UI. The client ships an in-memory
mock layer (`client/api/mock-axios.js` + `client/api/mock-data.js`) that intercepts all
axios calls and returns canned data, so you can run just the Next.js dev server.

From `client/`:

```bash
npm install

npm run dev               # real backend — expects the ingress at https://ticketing.dev
npm run dev:mock          # mocked backend, starts SIGNED IN as a demo user
npm run dev:mock:signedout  # mocked backend, starts SIGNED OUT
```

The dev server runs at `http://localhost:3000`.

How the mocks work:

- Toggled by `NEXT_PUBLIC_USE_MOCKS=1` (the `dev:mock` scripts set this for you).
- `NEXT_PUBLIC_MOCK_SIGNED_OUT=1` starts with no current user so you can exercise the
  signup/signin flows.
- Mock data lives in `client/api/mock-data.js`: a demo user (`guybrush`) and six sample
  Monkey Island tickets. Signup, signin, signout, listing/creating tickets, creating
  orders, and "paying" all work against in-memory state (state resets on restart).
- Stripe payments resolve instantly to a fake charge — no real Stripe key needed in
  mock mode.

Use mock mode for layout, styling, and component work. Use the full stack (or the real
`npm run dev` against `ticketing.dev`) when you need real auth cookies, persistence, or
the async order-expiration behavior.

## Per-service backend development & testing

Each backend service (`auth`, `tickets`, `orders`, `payments`, `expiration`) is a
standalone Node project with the same scripts. From inside a service directory:

```bash
npm install
npm start            # ts-node-dev (with --poll, for Docker volume mounts)
npm test             # jest --watchAll (uses mongodb-memory-server)
npm run test:ci      # jest single run (what CI uses)
```

Tests use `mongodb-memory-server` and a mocked `nats-wrapper`, so they need **no**
running Mongo or NATS. Run a single file:

```bash
npx jest src/routes/__test__/new.test.ts
```

## The shared `common` library

`common/` is published to npm as `@monkeytickets/common` and consumed by services as a
**published dependency** (not a local path). After changing it:

```bash
cd common
npm run build        # compile to ./build
npm run pub          # commit, bump patch, build, publish (maintainer only)

# then bump the version in every service:
bash scripts/update-commons.sh   # note: it cd's .. first — run from a one-level-deep dir
```

## Project layout

```
auth/         tickets/      orders/       payments/     expiration/   # backend services
client/                                                               # Next.js frontend
common/                                                               # shared npm package
infra/k8s/         base manifests (deployments, mongo, nats, redis)
infra/k8s-dev/     dev overlays (ingress host: ticketing.dev, BASE_URL)
scripts/           helper scripts (update-commons.sh)
skaffold.yaml      builds all six images + live sync
```

## Further reading

- [`CLAUDE.md`](./CLAUDE.md) — architecture, concurrency control, CI/CD, conventions
- [`EVENTS.md`](./EVENTS.md) — full NATS event flow diagrams
