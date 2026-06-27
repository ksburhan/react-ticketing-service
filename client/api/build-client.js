import axios from 'axios';
import { installMockAxios, isMockMode } from './mock-axios';

installMockAxios();

const buildClient = ({ req }) => {
    if (isMockMode()) {
        // Mock adapter is installed globally; baseURL doesn't matter, but the
        // url passed to handlers should still match `/api/...` exactly.
        return axios.create({ baseURL: '/' });
    }

    if (typeof window === 'undefined') {
        //server
        return axios.create({
            baseURL: process.env.BASE_URL,
            headers: req.headers
        })
    } else {
        //browser
        return axios.create({
            baseURL: '/'
        })
    }


}

export default buildClient;
