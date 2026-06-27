import axios from 'axios';
import { handleMockRequest } from './mock-data';

let installed = false;

export const isMockMode = () => process.env.NEXT_PUBLIC_USE_MOCKS === '1';

export const installMockAxios = () => {
    if (installed || !isMockMode()) return;
    installed = true;

    axios.defaults.adapter = async (config) => {
        const data = handleMockRequest(config);
        return {
            data,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {},
        };
    };
};
