import request from "supertest";
import { app } from "../../app";

it('returns a 201 on succesful signup', async () => {
    return request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'password',
            username: 'testUser'
        })
        .expect(201);
});

it('returns a 400 with an invalid email', async () => {
    return request(app)
        .post('/api/users/signup')
        .send({
            email: "testtest.com",
            password: 'password',
            username: 'test'
        })
        .expect(400);
});

it('returns a 400 with an invalid password', async () => {
    return request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'p',
            username: "testUser"
        })
        .expect(400);
});

it('returns a 400 with an invalid username', async () => {
    return request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'password',
            username: "t"
        })
        .expect(400);
});

it('returns a 400 with missing email and password and username', async () => {
    return request(app)
        .post('/api/users/signup')
        .send({})
        .expect(400);
});

it('disallows duplicate emails', async () => {
    await request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'password',
            username: "testUser"
        })
        .expect(201);

    return request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'password',
            username: "testUser1"
        })
        .expect(400);
});

it('disallows duplicate usernames', async () => {
    await request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'password',
            username: "testUser"
        })
        .expect(201);

    return request(app)
        .post('/api/users/signup')
        .send({
            email: "test1@test.com",
            password: 'password',
            username: "testUser"
        })
        .expect(400);
});

it('sets a cookie after successful signup', async () => {
    const response = await request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'password',
            username: "testUser"
        })
        .expect(201);

    expect(response.get('Set-Cookie')).toBeDefined();
});

