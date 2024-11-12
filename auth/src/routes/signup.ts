import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { validateRequest, BadRequestError } from '@monkeytickets/common';

import { User } from '../models/users';
import { UserCreatedPublisher } from '../events/user-created-publisher';
import { natsWrapper } from '../nats-wrapper';

const router = express.Router();

router.post('/api/users/signup', [
    body('email')
        .isEmail()
        .withMessage('Email must be valid'),
    body('password')
        .trim()
        .isLength({ min: 4, max: 20 })
        .withMessage('Password must be between 4 and 20 characters'),
    body('username')
        .trim()
        .isLength({ min: 4, max: 20 })
        .withMessage('Username must be between 4 and 20 characters')
],
    validateRequest,
    async (req: Request, res: Response) => {
        const { email, password, username } = req.body;

        const existingEmail = await User.findOne({ email });
        const existingUser = await User.findOne({ username });

        if (existingEmail || existingUser) {
            throw new BadRequestError('Email or username already in use');
        }

        const user = User.build({ email, password, username });
        await user.save();

        const userJwt = jwt.sign({
            id: user.id,
            email: user.email,
            username: user.username,
        }, process.env.JWT_KEY!);

        req.session = { jwt: userJwt };

        res.status(201).send(user);

        new UserCreatedPublisher(natsWrapper.client).publish({
            id: user.id,
            username: user.username,
        });
    });

export { router as signupRouter };