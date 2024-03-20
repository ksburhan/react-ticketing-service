export enum OrderStatus {
    // Order created but ticket has not been reserved
    Created = 'created',

    // Ticket is already reserverd or order is cancelled
    // order expired before payment
    Cancelled = 'cancelled',

    // Order has reserved ticket, waiting for payment
    AwaitingPayment = 'awaiting:payment',

    // Order has reserved ticket and payment succesfull
    Complete = 'complete',
}