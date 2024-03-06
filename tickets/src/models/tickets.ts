import mongoose from "mongoose";

// interface that describes properties required to create a new User
interface TicketAttributes {
    title: string;
    price: number;
    userId: string;
}

// interface that describes properties Ticket Model has
interface TicketModel extends mongoose.Model<TicketDocument> {
    build(attrs: TicketAttributes): TicketDocument;
}

// interface that describes properties Ticket Document has
interface TicketDocument extends mongoose.Document {
    title: string;
    price: number;
    userId: string;
}

const ticketSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        userId: {
            type: String,
            required: true
        }
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
}

const Ticket = mongoose.model<TicketDocument, TicketModel>('Ticket', ticketSchema);

export { Ticket };