# Event Flows

This document maps every NATS Streaming event in the system: who fires it, who listens, and what each listener does.

Subjects are defined in `common/src/events/subjects.ts`. Each backend service has matching `events/publishers` and `events/listeners` directories.

---

## Service map

```
  ┌────────┐     ┌─────────┐     ┌────────┐     ┌──────────┐     ┌────────────┐
  │  auth  │     │ tickets │     │ orders │     │ payments │     │ expiration │
  └────────┘     └─────────┘     └────────┘     └──────────┘     └────────────┘
   publishes      publishes       publishes      publishes        publishes
   UserCreated    TicketCreated   OrderCreated   PaymentCreated   ExpirationComplete
                  TicketUpdated   OrderCancelled
```

---

## 1. UserCreated

Fired on signup. Replicates the new user into every service that needs to look up usernames or own-ticket relations.

```
                       ┌──────────────────────────────────┐
                       │  auth                            │
                       │  POST /api/users/signup          │
                       │  publishes UserCreated           │
                       └─────────────────┬────────────────┘
                                         │  { id, username }
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
              ┌────────────────────┐         ┌────────────────────┐
              │ tickets            │         │ orders             │
              │ build & save local │         │ build & save local │
              │ User { id, name }  │         │ User { id, name }  │
              └────────────────────┘         └────────────────────┘
```

- **Publisher:** `auth/src/routes/signup.ts` → `UserCreatedPublisher`
- **Listeners:**
  - `tickets`: creates a local `User` doc so tickets can be tied to an owner.
  - `orders`: creates a local `User` doc so tickets replicated here can be tied to that owner.

---

## 2. TicketCreated

Fired when a logged-in user lists a new ticket for sale.

```
                       ┌──────────────────────────────────┐
                       │  tickets                         │
                       │  POST /api/tickets               │
                       │  publishes TicketCreated         │
                       └─────────────────┬────────────────┘
                                         │  { id, title, price, owner }
                                         ▼
                              ┌────────────────────────┐
                              │ orders                 │
                              │ look up local owner    │
                              │ build & save Ticket    │
                              └────────────────────────┘
```

- **Publisher:** `tickets/src/routes/new.ts` → `TicketCreatedPublisher`
- **Listener:**
  - `orders`: finds the local `User` for `owner.id`, then builds a local `Ticket` doc. If the user is unknown a `NotFoundError` is thrown and the message is redelivered.

---

## 3. TicketUpdated

Fired when the ticket owner edits the ticket, **and also whenever the ticket gets reserved or released** (so `orderId` changes).

```
                       ┌──────────────────────────────────┐
                       │  tickets                         │
                       │  PUT /api/tickets/:id            │
                       │  + order-created listener        │
                       │  + order-cancelled listener      │
                       │  publishes TicketUpdated         │
                       └─────────────────┬────────────────┘
                                         │  { id, version, title, price, orderId, owner }
                                         ▼
                              ┌────────────────────────────┐
                              │ orders                     │
                              │ Ticket.findByEvent(...)    │
                              │ (matches id + version-1)   │
                              │ set { title, price }, save │
                              └────────────────────────────┘
```

- **Publisher:** `tickets/src/routes/update.ts`, plus re-emitted by tickets' own `OrderCreatedListener` / `OrderCancelledListener` after toggling `orderId`.
- **Listener:**
  - `orders`: uses `findByEvent` (a model helper that matches `id` AND `version - 1`) to enforce ordering, then updates title & price. Out-of-order messages are not ack'd and get redelivered.

---

## 4. OrderCreated

Fired when a user reserves a ticket. Fan-out: schedule expiration, copy order into payments, mark the ticket reserved.

```
                       ┌──────────────────────────────────┐
                       │  orders                          │
                       │  POST /api/orders                │
                       │  publishes OrderCreated          │
                       └─────────────────┬────────────────┘
                                         │  { id, status, userId, expiresAt,
                                         │    version, ticket: {id, price} }
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
   ┌────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
   │ expiration         │   │ payments               │   │ tickets                │
   │ enqueue Bull job   │   │ build & save local     │   │ Ticket.findById        │
   │ delay = expiresAt  │   │ Order { id, price,     │   │ set orderId = order.id │
   │   - now            │   │   status, userId, ver }│   │ save                   │
   │                    │   │                        │   │ publish TicketUpdated  │
   └────────────────────┘   └────────────────────────┘   └────────────────────────┘
```

- **Publisher:** `orders/src/routes/new.ts` → `OrderCreatedPublisher`
- **Listeners:**
  - `expiration`: schedules a Bull/Redis delayed job (`expirationQueue.add`) that fires at `expiresAt`.
  - `payments`: stores a local copy of the order so it can later verify the order in the charge route.
  - `tickets`: locks the ticket by setting `orderId`, then republishes `TicketUpdated` so every replica sees the lock.

---

## 5. ExpirationComplete

Fired by the expiration worker 15 minutes after `OrderCreated` (unless the order was already completed).

```
                       ┌──────────────────────────────────┐
                       │  expiration                      │
                       │  Bull job processor              │
                       │  publishes ExpirationComplete    │
                       └─────────────────┬────────────────┘
                                         │  { orderId }
                                         ▼
                              ┌─────────────────────────────────┐
                              │ orders                          │
                              │ findById(orderId)               │
                              │ if status == Complete: just ack │
                              │ else: status = Cancelled, save  │
                              │ publish OrderCancelled          │
                              └─────────────────────────────────┘
```

- **Publisher:** `expiration/src/queues/expiration-queue.ts` job processor → `ExpirationCompletePublisher`
- **Listener:**
  - `orders`: short-circuits if the order was already paid. Otherwise cancels the order and emits `OrderCancelled` to ripple the cancellation.

---

## 6. OrderCancelled

Fired by orders when an order is cancelled (either by `ExpirationComplete` or by the cancel route).

```
                       ┌──────────────────────────────────┐
                       │  orders                          │
                       │  DELETE /api/orders/:id          │
                       │  + expiration-complete listener  │
                       │  publishes OrderCancelled        │
                       └─────────────────┬────────────────┘
                                         │  { id, version, ticket: {id} }
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
              ┌──────────────────────────┐   ┌──────────────────────────┐
              │ tickets                  │   │ payments                 │
              │ Ticket.findById          │   │ Order.findOne            │
              │ set orderId = undefined  │   │   (id + version - 1)     │
              │ save                     │   │ status = Cancelled, save │
              │ publish TicketUpdated    │   │                          │
              └──────────────────────────┘   └──────────────────────────┘
```

- **Publisher:** `orders/src/routes/delete.ts`, plus re-emitted by orders' own `ExpirationCompleteListener`.
- **Listeners:**
  - `tickets`: unlocks the ticket (`orderId = undefined`) and republishes `TicketUpdated` so the ticket is bookable again.
  - `payments`: updates its local order replica to `Cancelled` so a late charge cannot succeed.

---

## 7. PaymentCreated

Fired by payments after a successful Stripe charge. Completes the order.

```
                       ┌──────────────────────────────────┐
                       │  payments                        │
                       │  POST /api/payments              │
                       │  publishes PaymentCreated        │
                       └─────────────────┬────────────────┘
                                         │  { id, orderId, stripeId }
                                         ▼
                              ┌─────────────────────────────────┐
                              │ orders                          │
                              │ findById(orderId)               │
                              │ status = Complete, save         │
                              │ (no further publish — order is  │
                              │  terminal; expiration job is    │
                              │  short-circuited in step 5)     │
                              └─────────────────────────────────┘
```

- **Publisher:** `payments/src/routes/new.ts` → `PaymentCreatedPublisher`
- **Listener:**
  - `orders`: marks the order `Complete`. The pending expiration job will later wake up, see `status === Complete`, and ack without cancelling.

---

## Cross-cutting notes

- **Queue groups:** every service uses a `queueGroupName` ("tickets-service", "orders-service", etc.) so multiple replicas of the same service share work — only one replica handles each message.
- **Versioning:** `tickets`, `orders`, and `payments` models use `mongoose-update-if-current`. Listeners match on `id` AND `version - 1` (via `findByEvent` or `findOne`) so events processed out of order are simply not ack'd and get redelivered.
- **Ack-on-success only:** every listener calls `msg.ack()` at the end of `onMessage`. If `onMessage` throws, the message is redelivered after `ackWait`.
- **No direct DB reads across services:** `tickets/` and `orders/` keep their own local `User` and `Ticket` collections, populated purely from these events.
