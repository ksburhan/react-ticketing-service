# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a multi-service monorepo for a ticket-reselling platform. Each top-level directory is its own deployable unit with its own `package.json`, `Dockerfile`, `tsconfig.json`, and `node_modules`:

- `auth/` — user signup/signin/signout (Express + MongoDB, JWT in cookie-session)
- `tickets/` — create/list/update tickets for sale (Express + MongoDB)
- `orders/` — reserve a ticket; expires after 15 minutes if unpaid (Express + MongoDB)
- `payments/` — Stripe charge against a reserved order (Express + MongoDB)
- `expiration/` — Bull/Redis-backed delayed-job worker that emits expiration events (no HTTP server)
- `client/` — Next.js 14 (pages router) frontend in plain JS
- `common/` — shared library published to npm as `@monkeytickets/common` (errors, middleware, NATS event base classes & subjects). **Not consumed via the local path** — services depend on the published version.
- `nats-test/` — throwaway scripts for poking at NATS streaming locally
- `infra/k8s/` — base manifests applied to all clusters
- `infra/k8s-dev/` — dev-only overlays (ingress with `host: ticketing.dev`, `BASE_URL` config)
- `infra/k8s-prod/` — prod-only overlays (referenced by CI but not present in this checkout)

## Architecture

**Sync layer:** Five services sit behind an nginx ingress. The ingress routes by path prefix:
`/api/users → auth-srv`, `/api/tickets → tickets-srv`, `/api/orders → orders-srv`, `/api/payments → payments-srv`, `/ → client-srv`. All backend services listen on port 3000 inside the cluster. Auth uses a JWT stored in a cookie-session; the `currentUser` middleware in `@monkeytickets/common` decodes it on every request.

**Async layer:** Services communicate over **NATS Streaming** (not core NATS). Subjects are enumerated in `common/src/events/subjects.ts` and each service has matching `events/listeners` and `events/publishers` directories. The flow:

1. `auth` publishes `UserCreated` on signup → `tickets` and `orders` replicate the user into their own DB.
2. `tickets` publishes `TicketCreated`/`TicketUpdated` → `orders` replicates the ticket.
3. `orders` publishes `OrderCreated` → `expiration` schedules a Bull job for 15 min, `payments` and `tickets` lock the ticket.
4. `expiration` publishes `ExpirationComplete` → `orders` cancels the order.
5. `orders` publishes `OrderCancelled` → `tickets` and `payments` release the ticket.
6. `payments` publishes `PaymentCreated` after a successful Stripe charge → `orders` marks the order Complete.

**Concurrency control:** Mongoose models in `tickets/`, `orders/`, and `payments/` use `mongoose-update-if-current` with a `version` field. Listeners must `find` by `id` AND `version` (`version - 1` of incoming event) to prevent out-of-order processing. Every listener also calls `msg.ack()` only on success; failures redeliver after `ackWait`.

**Each service owns its DB.** `tickets/` and `orders/` keep local `User` and `Ticket` collections populated only via NATS events — they never read another service's DB.

## Common commands

Backend services share the same scripts (run from inside `auth/`, `tickets/`, `orders/`, `payments/`, or `expiration/`):

```bash
npm install
npm start              # ts-node-dev with --poll (for Docker volume mounts)
npm test               # jest --watchAll --no-cache (uses mongodb-memory-server)
npm run test:ci        # jest, single run (CI uses this)
```

Run a single test file: `npx jest src/routes/__test__/new.test.ts` (or `npm test -- src/routes/__test__/new.test.ts` to keep the watcher).

Frontend (`client/`): `npm run dev` (Next.js dev server). There are no tests.

Common library (`common/`): `npm run build` compiles to `./build/`. `npm run pub` commits, bumps patch, builds, publishes to npm — only the maintainer should run this.

After publishing a new `@monkeytickets/common`, bump it in every service with `bash scripts/update-commons.sh` (note: the script does `cd ..` first, so run it from a one-level-deep dir, not the repo root).

## Local development

Local dev uses **Skaffold + Kubernetes** (not docker-compose). From the repo root:

```bash
skaffold dev
```

This builds all six images, applies `infra/k8s/*` and `infra/k8s-dev/*`, and watches for `src/**/*.ts` (or `*.js` for client) to live-sync. Prerequisites:

- A local k8s cluster (Docker Desktop k8s, kind, or minikube)
- `nginx-ingress` installed in the cluster
- `127.0.0.1 ticketing.dev` in `/etc/hosts` (the ingress is hostname-bound)
- A `jwt` secret: `kubectl create secret generic jwt-secret --from-literal=JWT_KEY=<anything>`
- A `stripe-secret` secret for payments: `kubectl create secret generic stripe-secret --from-literal=STRIPE_KEY=<key>`

Required env vars (set via the deployment manifests, not `.env`): `JWT_KEY`, `MONGO_URI`, `NATS_CLIENT_ID`, `NATS_URL`, `NATS_CLUSTER_ID`. The `nats-srv` service exposes NATS streaming on `http://nats-srv:4222` with cluster id `ticketing`.

App is reachable at `https://ticketing.dev` (accept the self-signed cert).

## Test setup

Each backend service has `src/test/setup.ts` that:
- Spins up `mongodb-memory-server` per test run, clears all collections between tests
- Mocks `nats-wrapper.ts` via `src/__mocks__/nats-wrapper.ts` (jest auto-mock) — assertions on published events check `natsWrapper.client.publish` was called
- Defines a global `signin()` helper that returns a Set-Cookie array — pass it as `.set('Cookie', cookie)` on supertest requests

When adding a new service or new auth-touching test, mirror this pattern; do not connect to a real Mongo/NATS in tests.

## CI/CD

GitHub Actions in `.github/workflows/`:
- `tests-<service>.yml` — runs `npm run test:ci` on PRs that touch that service's path
- `deploy-<service>.yaml` — on push to `main` touching the service path: builds image, pushes to Docker Hub as `ksburhan/<service>`, and `kubectl rollout restart deployment <service>-depl` against the DigitalOcean cluster `ticketing`
- `deploy-manifest.yaml` — on push to `main` touching `infra/**`: applies `infra/k8s` and `infra/k8s-prod`

Path filters mean a PR/commit that only touches one service won't trigger the others' jobs.
