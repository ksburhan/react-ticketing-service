import { Publisher, Subjects, TicketCreatedEvent } from '@monkeytickets/common';

export class TicketCreatedPublisher extends Publisher<TicketCreatedEvent> {
    readonly subject = Subjects.TicketCreated;
}