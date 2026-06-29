# Deployment Guide

How this multi-service app is deployed publicly and cheaply, what had to change
from the course/local-dev setup to make it production-ready, and the operational
runbook.

Live demo: **https://www.monkey-ticket.site**

---

## 1. Approach

The whole app runs on **one small VPS** (Hetzner CX23 — 2 vCPU / 4 GB / Ubuntu)
using **k3s** (lightweight Kubernetes). Cost ≈ €4–5/month, no managed-Kubernetes
or per-service database bills.

Two deliberate constraints shaped every change:

1. **Keep local development untouched.** `skaffold dev` + `infra/k8s/*` +
   `infra/k8s-dev/*` still work exactly as before (4 separate MongoDBs, no
   resource limits, dev servers with hot-reload). Production is assembled
   *separately*.
2. **Fit comfortably in 4 GB.** That drove the database consolidation, resource
   limits, and the switch from dev servers to compiled production builds.

Production is assembled with **Kustomize** from a single entry point and applied
with:

```bash
kubectl apply -k infra
```

`infra/kustomization.yaml` (at the `infra/` root) cherry-picks the base
manifests, **excludes the four per-service Mongo deployments**, adds the
prod-only resources, and patches each service. Local dev never reads this file.

---

## 2. Repository changes made for production

### 2.1 Prod overlay (Kustomize) — `infra/kustomization.yaml`

A new Kustomization at the `infra/` root (not inside `infra/k8s`, so Skaffold's
`rawYaml` globs are unaffected). It:

- `resources:` includes the 8 base workloads (auth, tickets, orders, payments,
  expiration, expiration-redis, nats, client) **minus** the four
  `*-mongo-depl.yaml` files, plus the prod-only files in `infra/k8s-prod/`.
- `patches:` (strategic-merge, per service) inject `MONGO_URI`, resource
  requests/limits, and readiness/liveness probes.

### 2.2 MongoDB consolidation — `infra/k8s-prod/mongo-shared-depl.yaml`

The four per-service MongoDB deployments are replaced by **one shared
`mongo-srv`**. The "each service owns its DB" boundary is preserved logically by
giving each service a **distinct database name** on the same instance:

| Service  | `MONGO_URI`                              |
|----------|------------------------------------------|
| auth     | `mongodb://mongo-srv:27017/auth`         |
| tickets  | `mongodb://mongo-srv:27017/tickets`      |
| orders   | `mongodb://mongo-srv:27017/orders`       |
| payments | `mongodb://mongo-srv:27017/payments`     |

The shared Mongo deployment includes several hardening choices learned the hard
way (see §5):

- **`image: mongo:4.4`** (pinned). MongoDB 5.0+ requires AVX and/or 3DS-era
  binaries that segfault on this VPS; 4.4 is stable here.
- **`args: ['--wiredTigerCacheSizeGB', '0.5']`** — WiredTiger sizes its cache
  off *host* RAM by default and would exceed the container limit; this caps it.
- **`strategy: { type: Recreate }`** — the data volume is single-writer (RWO);
  Recreate stops the old pod before starting the new one so they never contend
  for `/data/db` during a rollout.
- A **`PersistentVolumeClaim` (2 Gi, default storageClass = k3s local-path)**
  mounted at `/data/db`. Data survives pod restarts; it does **not** survive
  destroying the VPS (no backups — fine for a demo).

### 2.3 Resource limits & health probes — `infra/kustomization.yaml`

Every workload has CPU/memory requests and limits so they coexist on 4 GB:

| Workload                              | Requests        | Limits          |
|---------------------------------------|-----------------|-----------------|
| auth / tickets / orders / payments / expiration | 50m / 64Mi | 250m / 192Mi |
| client (Next.js)                      | 50m / 96Mi      | 300m / 384Mi    |
| nats / expiration-redis               | 25m / 32Mi      | 150m / 128Mi    |
| mongo                                 | 100m / 256Mi    | 500m / 1Gi      |

**Readiness + liveness probes** (TCP socket on `:3000`) are added to the five
HTTP services (auth, tickets, orders, payments, client). A TCP probe avoids
depending on a health-check route and prevents the ingress from sending traffic
to a pod before its server is listening (eliminates 502s on rollout). The
`expiration` worker has no HTTP server, so it gets no probe.

> Limitation: the probes are TCP-only, so a pod can be "ready" while *not*
> connected to Mongo. See §5 and §6.

### 2.4 Production container images (compiled, not dev servers)

The biggest runtime change. Originally every image ran a **dev server in
production**, which is memory-hungry and unstable:

- backend services ran `ts-node-dev` (holds the TS compiler resident) → OOM at
  the 192Mi limit;
- the client ran `next` (dev mode, compiles on demand) → OOM at 256Mi.

Fix — each service now builds once and runs the compiled output, via a
**multi-stage Dockerfile** on **pinned `node:20-alpine`**:

**Backend services** (`auth`, `tickets`, `orders`, `payments`, `expiration`):
- `package.json`: added `"build": "tsc -p tsconfig.build.json"`. **`start` is
  left as `ts-node-dev` so local Skaffold dev is unchanged.**
- `tsconfig.build.json` (new): build-only config that emits to `build/` and
  excludes tests, so the base `tsconfig.json` (used by Jest) keeps the
  `global.signin` type augmentation from `src/test/setup.ts`.
- `Dockerfile`: builder stage runs `npm run build`; runtime stage runs
  `node build/index.js`. Compiled Node uses ~60–80 MB vs ~300 MB for
  ts-node-dev.

**Client** (`client`):
- `package.json`: added `"build": "next build"` and `"start": "next start"`
  (kept `dev` for local).
- `Dockerfile`: builder runs `next build`; runtime runs `next start`. Production
  Next uses a fraction of the dev server's memory.

### 2.5 TLS & ingress

- `infra/k8s-prod/cert-issuer.yaml` (new): a cert-manager `ClusterIssuer`
  (`letsencrypt-prod`, HTTP-01 solver, nginx ingress class).
- `infra/k8s-prod/ingress-srv.yaml`: adds the
  `cert-manager.io/cluster-issuer: letsencrypt-prod` annotation and a `tls:`
  block for `www.monkey-ticket.site` (secret `monkey-ticket-tls`). cert-manager
  obtains and auto-renews the Let's Encrypt certificate.
- `infra/k8s-prod/client-config.yml`: `BASE_URL` points the client's
  **server-side rendering** at the in-cluster ingress
  (`http://ingress-nginx-controller.ingress-nginx.svc.cluster.local`) so SSR
  requests don't hairpin through the public host.

### 2.6 CI/CD pipeline changes — `.github/workflows/`

- **`deploy-manifest.yaml`** — on push to `main` touching `infra/**`: decodes the
  `KUBE_CONFIG` repo secret (base64 of the VPS kubeconfig with the public IP) to
  `~/.kube/config`, then `kubectl apply -k infra`.
- **`deploy-<service>.yaml`** — on push to `main` touching a service path: builds
  the image, pushes to Docker Hub as `ksburhan/<service>`, then
  `kubectl rollout restart deployment <service>-depl` (via `KUBE_CONFIG`).
- **`tests-<service>.yml`** — on PRs touching a service path. Hardened to:
  - `runs-on: ubuntu-22.04` (the default `ubuntu-latest` = 24.04 has no matching
    MongoDB-memory-server binary);
  - `actions/setup-node@v4` pinned to **Node 20**;
  - run **`npm run build`** before `test:ci`, so a compile error fails the PR
    instead of a `main` deploy.
- Test reliability: each service's `test:ci` uses `jest --runInBand`, and the
  Jest config sets `testTimeout: 60000` so the one-time `mongod` binary download
  on a cold runner doesn't trip the default 5 s hook timeout.

---

## 3. One-time infrastructure setup

Performed once on a fresh VPS.

```bash
# 1. k3s — disable traefik (manifests use ingressClassName: nginx),
#    bake the public IP into the API cert so CI's kubectl can reach it.
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC=\
"--disable traefik --write-kubeconfig-mode 644 --tls-san <VPS_IP>" sh -

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 2. ingress-nginx (k3s's built-in klipper LB binds host ports 80/443 to it).
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/cloud/deploy.yaml

# 3. cert-manager (the ClusterIssuer itself ships via `kubectl apply -k infra`).
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml

# 4. secrets.
kubectl create secret generic jwt-secret --from-literal=JWT_KEY="$(openssl rand -hex 32)"
kubectl create secret generic stripe-secret --from-literal=STRIPE_KEY=sk_test_...
```

**Firewall:** use Hetzner's Cloud Firewall (edge) rather than `ufw`, which can
break flannel pod networking. Allow inbound TCP **22, 80, 443, 6443** (6443 is
the k8s API for GitHub Actions; it's protected by client-cert auth in the
kubeconfig).

**GitHub repo secrets:**
- `KUBE_CONFIG` = `base64 -w0` of `/etc/rancher/k3s/k3s.yaml` with `127.0.0.1`
  replaced by the **public IP**.
- `DOCKER_USERNAME` / `DOCKER_PASSWORD` for the image pushes.

**DNS (Hostinger):** `www` A record → `<VPS_IP>`. (Apex is not served — the
ingress only matches `www.monkey-ticket.site`. Hostinger refuses to forward a
domain to its own subdomain, so apex support would require adding it to the
ingress + a cert.)

---

## 4. Release procedure

Branching follows gitflow: feature → `develop` → `main`. **Deploy workflows fire
only on push to `main`**, so a `develop` merge does not deploy; a second
`develop → main` merge does.

1. Merge `develop → main`. The path-filtered workflows build/push changed
   service images and run `kubectl apply -k infra`.
2. **First deploy only — wipe the Mongo PVC.** If the cluster previously ran a
   newer Mongo, `mongo:4.4` cannot read its data files. Since demo data is
   disposable:
   ```bash
   export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
   kubectl scale deployment mongo-depl --replicas=0
   kubectl delete pvc mongo-pvc
   kubectl apply -f - <<'EOF'
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata: { name: mongo-pvc }
   spec:
     accessModes: [ReadWriteOnce]
     resources: { requests: { storage: 2Gi } }
   EOF
   kubectl scale deployment mongo-depl --replicas=1
   ```
3. If backends were rolled out *before* Mongo became healthy, they may log
   `MongooseError: ... buffering timed out` (connected to nothing). Restart them
   once Mongo is up:
   ```bash
   kubectl rollout restart deployment auth-depl tickets-depl orders-depl payments-depl expiration-depl
   ```
4. Verify: `kubectl get pods` all `1/1` with 0 restarts; `https://www.monkey-ticket.site` loads.

---

## 5. Issues encountered & root causes

The deployment surfaced a chain of issues, each masked by the previous one.
Documented here because most were non-obvious.

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| Backends `OOMKilled` / 502s | Images ran `ts-node-dev` (dev server) in prod, exceeding 192Mi | Compile to JS, run `node build/index.js` (§2.4) |
| Mongo `CrashLoopBackOff` (exit 139) | `mongo:latest` (8.x) segfaults on this VPS | Pin `mongo:4.4` |
| Mongo OOM under load | WiredTiger cache sized off host RAM, not the cgroup limit | `--wiredTigerCacheSizeGB 0.5` |
| 502 on rollout | No readiness probes → traffic to not-ready pods | TCP readiness/liveness probes |
| CI tests all crash on import | Modern Node removed `Buffer.SlowBuffer` (needed by `jsonwebtoken`) | Pin Node 20 in Dockerfiles + CI |
| `tsc` build fails (`TS7017` on `global.signin`) | A build-only `exclude` also hid the test type augmentation from Jest | Split `tsconfig.build.json`; leave base `tsconfig.json` intact |
| CI test `beforeAll` timeout | Cold runner downloads ~60 MB `mongod` inside the 5 s hook | `testTimeout: 60000` + `--runInBand` |
| CI test download 403 | MongoDB 6.0.9 has no `ubuntu-24.04` binary; `ubuntu-latest` = 24.04 | `runs-on: ubuntu-22.04` |
| Docker `tsc` build fails on models | No lockfile → `npm install` floats mongoose to a stricter 8.x whose `toJSON` types reject `ret.id` / `delete ret._id` | Type the transform `ret` as `any` in all model schemas |
| "Green tests but failed deploy build" | Jest (ts-jest) didn't run a full `tsc` | Add `npm run build` to the test workflows |
| Client `OOMKilled` (503) | Client ran the `next` **dev server** in prod | Production `next build` / `next start`, limit → 384Mi |
| Backends `buffering timed out` after Mongo wipe | Pods started before Mongo was healthy and never reconnected | `kubectl rollout restart` the backends |

---

## 6. Known limitations & follow-ups

- **Payments are blocked by Stripe 3DS/SCA.** The app uses Stripe's legacy
  **Charges API** (`stripe.charges.create({ source })`), which can't perform 3DS
  authentication. The connected Stripe account is in a 3DS-mandate region
  (Japan), so every charge declines with `authentication_required`. Everything
  else in the purchase flow (signup → ticket → reserve → order) works
  end-to-end. **Fix: migrate `payments/` and the client checkout to the Payment
  Intents API** (planned).
- **No dependency lockfiles in the Docker builds.** Images `COPY package.json`
  and `npm install`, so versions float (this caused the mongoose build break).
  Committing `package-lock.json` and switching to `npm ci` would make builds
  deterministic.
- **TCP-only probes** mean a pod can be "ready" but not DB-connected; a DB-aware
  readiness endpoint would let services self-heal after a Mongo restart instead
  of needing a manual `rollout restart`.
- **Local `skaffold dev` now runs production-mode images** (dev and prod share
  Dockerfiles), so in-container hot-reload is gone. A Skaffold dev profile that
  overrides the command back to the dev server would restore it.
- **Single node, no backups.** Mongo data lives on the node's local disk; losing
  the VPS loses the data. Acceptable for a demo; add `mongodump` to object
  storage (or Hetzner backups) for anything real.
- **Apex domain** (`monkey-ticket.site` without `www`) is not served.
