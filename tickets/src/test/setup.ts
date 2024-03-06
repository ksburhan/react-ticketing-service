import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../app';
import jwt from 'jsonwebtoken';

declare global {
    var signin: () => string[];
}

let mongo: any;
beforeAll(async () => {
    process.env.JWT_KEY = 'asdf';

    mongo = await MongoMemoryServer.create();
    const mongoUri = mongo.getUri();
    await mongoose.connect(mongoUri, {});
});

beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
        await collection.deleteMany();
    }
});

afterAll(async () => {
    if (mongo) {
        await mongo.stop();
    }
    await mongoose.connection.close();
});

global.signin = () => {
    // Build a JWT payload. { id, email }
    const payload = {
        id: '1234',
        email: 'test@test.com'
    }

    // Create JWT
    const token = jwt.sign(payload, process.env.JWT_KEY!);

    // Build session object { jwt: JWT }
    const session = { jwt: token };

    // turn session into JSON
    const sessionJSON = JSON.stringify(session);

    // encode JSON as base64
    const base64 = Buffer.from(sessionJSON).toString('base64');

    // return string that contains cookie with encoded JSON
    return [`session=${base64}`];
}