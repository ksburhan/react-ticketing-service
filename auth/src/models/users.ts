import mongoose from "mongoose";
import { Password } from "../services/password";

// interface that describes properties required to create a new User
interface UserAttributes {
    email: string,
    password: string,
    username: string
}

// interface that describes properties User Model has
interface UserModel extends mongoose.Model<UserDocument> {
    build(attrs: UserAttributes): UserDocument;
}

// interface that describes properties User Document has
interface UserDocument extends mongoose.Document {
    email: string;
    password: string;
    username: string;
}

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    }
},
    {
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.password;
                delete ret.__v;
            }
        }
    });

userSchema.pre('save', async function (done) {
    if (this.isModified('password')) {
        const hashed = await Password.toHash(this.get('password'));
        this.set('password', hashed);
    }
    done();
});

userSchema.statics.build = (attrs: UserAttributes) => {
    return new User(attrs);
}

const User = mongoose.model<UserDocument, UserModel>('User', userSchema);

export { User };