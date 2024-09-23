import mongoose from "mongoose";
import { OrderStatus } from "@monkeytickets/common";

import { updateIfCurrentPlugin } from "mongoose-update-if-current";

export { OrderStatus };

// interface that describes properties required to create a new order
interface OrderAttributes {
    id: string;
    version: number;
    userId: string;
    price: number;
    status: OrderStatus;
}

// interface that describes properties Order Model has
interface OrderModel extends mongoose.Model<OrderDocument> {
    build(attrs: OrderAttributes): OrderDocument;
}

// interface that describes properties Order Document has
interface OrderDocument extends mongoose.Document {
    version: number;
    userId: string;
    price: number;
    status: OrderStatus;
}

const orderSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            required: true,
            enum: Object.values(OrderStatus),
            default: OrderStatus.AwaitingPayment
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

orderSchema.set('versionKey', 'version');
orderSchema.plugin(updateIfCurrentPlugin);

orderSchema.statics.build = (attrs: OrderAttributes) => {
    return new Order({
        _id: attrs.id,
        version: attrs.version,
        price: attrs.price,
        userId: attrs.userId,
        status: attrs.status
    });
}

const Order = mongoose.model<OrderDocument, OrderModel>('Order', orderSchema);

export { Order };