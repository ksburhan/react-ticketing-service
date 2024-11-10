import mongoose from "mongoose";
import { OrderStatus } from "@monkeytickets/common";

import { TicketDocument } from "./tickets";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";
import { UserDocument } from "./users";

export { OrderStatus };

// interface that describes properties required to create a new User
interface OrderAttributes {
    buyer: UserDocument;
    status: OrderStatus;
    expiresAt: Date;
    ticket: TicketDocument;
}

// interface that describes properties Order Model has
interface OrderModel extends mongoose.Model<OrderDocument> {
    build(attrs: OrderAttributes): OrderDocument;
}

// interface that describes properties Order Document has
interface OrderDocument extends mongoose.Document {
    buyer: UserDocument;
    version: number;
    status: OrderStatus;
    expiresAt: Date;
    ticket: TicketDocument;
}

const orderSchema = new mongoose.Schema(
    {
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            required: true,
            enum: Object.values(OrderStatus),
            default: OrderStatus.Created
        },
        expiresAt: {
            type: mongoose.Schema.Types.Date,
        },
        ticket: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ticket'
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

orderSchema.set('versionKey', 'version');
orderSchema.plugin(updateIfCurrentPlugin);

orderSchema.statics.build = (attrs: OrderAttributes) => {
    return new Order(attrs);
}

const Order = mongoose.model<OrderDocument, OrderModel>('Order', orderSchema);

export { Order };