import { Publisher, Subjects, TicketUpdatedEvent } from '@monkeytickets/common';

export class TicketUpdatedPublisher extends Publisher<TicketUpdatedEvent> {
    readonly subject = Subjects.TicketUpdated;
}