import mongoose from "mongoose";

import { Order, OrderStatus } from "./orders";

// interface that describes properties required to create a new User
interface TicketAttributes {
    title: string;
    price: number;
}

// interface that describes properties Ticket Model has
interface TicketModel extends mongoose.Model<TicketDocument> {
    build(attrs: TicketAttributes): TicketDocument;
}

// interface that describes properties Ticket Document has
export interface TicketDocument extends mongoose.Document {
    title: string;
    price: number;
    isReserved(): Promise<boolean>;
}

const ticketSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
    },
    {
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
            }
        }
    }
);

ticketSchema.statics.build = (attrs: TicketAttributes) => {
    return new Ticket(attrs);
};
ticketSchema.methods.isReserved = async function () {
    const existingOrder = await Order.findOne({
        ticket: this,
        status: {
            $in: [
                OrderStatus.Created,
                OrderStatus.AwaitingPayment,
                OrderStatus.Complete
            ],
        },
    });

    return !!existingOrder;
}

const Ticket = mongoose.model<TicketDocument, TicketModel>('Ticket', ticketSchema);

export { Ticket };