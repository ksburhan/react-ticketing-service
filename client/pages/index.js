import axios from 'axios';

import buildClient from '../api/build-client';

const LandingPage = ({ currentUser }) => {
    console.log(currentUser);
    // axios.get('/api/users/currentuser').catch((err) => {
    //     console.log(err.message);
    // });

    return <h1>Landing Page</h1>;
};

LandingPage.getInitialProps = async (context) => {
    const { data } = await buildClient(context).get('/api/users/currentUser');

    return data;
}

export default LandingPage;