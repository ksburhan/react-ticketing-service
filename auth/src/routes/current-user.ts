import express from 'express';
import { currentUser } from '@monkeytickets/common';

const router = express.Router();

router.get('/api/users/currentuser', currentUser, (req, res) => {
    res.send({ currentUser: req.currentUser || null });
});

export { router as currentuserRouter };