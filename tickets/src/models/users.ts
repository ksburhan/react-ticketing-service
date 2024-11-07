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
    username: string
}

const UserSchema = new mongoose.Schema(
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

UserSchema.set('versionKey', 'version');
UserSchema.plugin(updateIfCurrentPlugin);

UserSchema.statics.build = (attrs: UserAttributes) => {
    return new User(attrs);
}

const User = mongoose.model<UserDocument, UserModel>('User', UserSchema);

export { User };