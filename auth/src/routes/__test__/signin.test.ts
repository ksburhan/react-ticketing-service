import request from "supertest";
import { app } from "../../app";

it('fails when email does not exist yet', async () => {
    return request(app)
        .post('/api/users/signin')
        .send({
            email: "test@test.com",
            password: 'password'
        })
        .expect(400);
});

it('fails when incorrect password is supplied', async () => {
    await request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'password',
            username: "testUser"
        })
        .expect(201);

    await request(app)
        .post('/api/users/signin')
        .send({
            email: "test@test.com",
            password: 'asasdas'
        })
        .expect(400);
});

it('responds with cookie when correct credentials', async () => {
    await request(app)
        .post('/api/users/signup')
        .send({
            email: "test@test.com",
            password: 'password',
            username: "testUser"
        })
        .expect(201);

    const response = await request(app)
        .post('/api/users/signin')
        .send({
            email: "test@test.com",
            password: 'password'
        })
        .expect(200);

    expect(response.get('Set-Cookie')).toBeDefined();
});

it('returns a 400 with an invalid email', async () => {
    return request(app)
        .post('/api/users/signin')
        .send({
            email: "testtest.com",
            password: 'password'
        })
        .expect(400);
});

it('returns a 400 with no password', async () => {
    return request(app)
        .post('/api/users/signin')
        .send({
            email: "test@test.com",
        })
        .expect(400);
});

it('returns a 400 with missing email and password', async () => {
    return request(app)
        .post('/api/users/signin')
        .send({})
        .expect(400);
});
