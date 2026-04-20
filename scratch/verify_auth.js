const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}/api/countries`;

async function testAuth() {
    console.log('Testing authentication...');
    
    // 1. Test without auth
    try {
        await axios.get(URL);
        console.error('FAIL: Accessible without authentication!');
    } catch (err) {
        if (err.response && err.response.status === 401) {
            console.log('PASS: Access denied without authentication (401).');
        } else {
            console.error('ERROR: Unexpected behavior without auth:', err.message);
        }
    }

    // 2. Test with correct auth
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD;
    
    if (!password) {
        console.warn('SKIP: Correct auth test skipped (ADMIN_PASSWORD not set).');
        return;
    }

    try {
        const res = await axios.get(URL, {
            auth: {
                username,
                password
            }
        });
        if (res.status === 200) {
            console.log('PASS: Access granted with correct authentication (200).');
        } else {
            console.error('FAIL: Unexpected status code with correct auth:', res.status);
        }
    } catch (err) {
        console.error('FAIL: Authentication failed with correct credentials:', err.message);
    }
}

testAuth();
