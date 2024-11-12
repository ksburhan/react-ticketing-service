export enum Subjects {
    UserCreated = "auth:created",

    TicketCreated = 'ticket:created',
    TicketUpdated = 'ticket:updated',

    OrderCreated = 'order:created',
    OrderCancelled = 'order:cancelled',

    ExpirationComplete = "expiration:complete",

    PaymentCreated = "payment:created",
}