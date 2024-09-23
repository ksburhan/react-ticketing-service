import mongoose from "mongoose";

// interface that describes properties required to create a new payment
interface PaymentAttributes {
    orderId: string;
    stripeId: string;
}

// interface that describes properties Payment Model has
interface PaymentModel extends mongoose.Model<PaymentDocument> {
    build(attrs: PaymentAttributes): PaymentDocument;
}

// interface that describes properties Payment Document has
interface PaymentDocument extends mongoose.Document {
    orderId: string;
    stripeId: string;
}

const paymentSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            required: true
        },
        stripeId: {
            type: String,
            required: true
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

paymentSchema.set('versionKey', 'version');

paymentSchema.statics.build = (attrs: PaymentAttributes) => {
    return new Payment(attrs);
}

const Payment = mongoose.model<PaymentDocument, PaymentModel>('Payment', paymentSchema);

export { Payment };