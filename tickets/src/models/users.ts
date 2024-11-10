import mongoose from "mongoose";
import { updateIfCurrentPlugin } from "mongoose-update-if-current";

interface UserAttributes {
    id: string;
    username: string;
}

interface UserModel extends mongoose.Model<UserDocument> {
    build(attrs: UserAttributes): UserDocument;
}

export interface UserDocument extends mongoose.Document {
    username: string;
}

const userSchema = new mongoose.Schema(
    {
        username: {
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

userSchema.statics.build = (attrs: UserAttributes) => {
    return new User({
        _id: attrs.id,
        username: attrs.username,
    });
};

const User = mongoose.model<UserDocument, UserModel>('User', userSchema);

export { User };