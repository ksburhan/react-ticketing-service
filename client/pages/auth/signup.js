import { useState } from 'react';
import Router from 'next/router';
import useRequest from '../../hooks/use-request';

const SignUp = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const { doRequest, errors } = useRequest({
        url: '/api/users/signup',
        method: 'post',
        body: { email, password, username },
        onSuccess: () => Router.push('/')
    });

    const onSubmit = async (event) => {
        event.preventDefault();

        await doRequest();
    }

    return <form onSubmit={onSubmit}>
        <h1>Sign up</h1>
        <div className="form-group">
            <label>Email Address</label>
            <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="form-control"
            />
        </div>
        <div className="form-group">
            <label>Password</label>
            <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-control"
            />
        </div>
        <div className="form-group">
            <label>Username</label>
            <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="form-control"
            />
        </div>
        {errors}
        <button className="btn btn-primary">Sign Up</button>
    </form>;
};

export default SignUp;