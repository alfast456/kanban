const crypto = require('crypto');

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function requiredConfig() {
    const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
        .filter(key => !process.env[key]);
    if (missing.length) throw new Error(`Missing Google OAuth config: ${missing.join(', ')}`);
}

function createState() {
    return crypto.randomBytes(32).toString('base64url');
}

function authorizationUrl(state) {
    requiredConfig();
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
    });
    return `${GOOGLE_AUTHORIZE_URL}?${params}`;
}

async function exchangeCode(code) {
    requiredConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });
    if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
    const data = await response.json();
    if (!data.access_token) throw new Error('Google token response missing access token');
    return data.access_token;
}

async function fetchProfile(accessToken) {
    const response = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Google profile request failed: ${response.status}`);
    const profile = await response.json();
    if (!profile.sub || !profile.email) throw new Error('Google profile missing required fields');
    return profile;
}

module.exports = { createState, authorizationUrl, exchangeCode, fetchProfile };
