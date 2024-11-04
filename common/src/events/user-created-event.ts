import { Subjects } from "./subjects";

export interface TicketUpdatedEvent {
    subject: Subjects.UserCreated;
    data: {
        id: string;
        username: string;
    };
}