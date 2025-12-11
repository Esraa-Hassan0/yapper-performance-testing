import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  generateCredentials
} from '../../utils/config.js';

const url = getUrl('/users/me/muted'); // Endpoint URL
const loginUrl = getUrl('/auth/login');
const { logStatus, counters } = countersStatus();

export const options = secondaryOptions;

// Setup function to log in and get the token
export function setup() {
  const creds = generateCredentials(true);
  console.log('Logging in with credentials:', creds);

  const res = http.post(loginUrl, JSON.stringify(creds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  });

  logStatus(res, 'Login', 'setup_login');

  const body = res.json();
  const token = body?.data?.access_token;

  if (!token) {
    throw new Error('Failed to log in and retrieve token');
  }

  console.log('Token retrieved:', token);
  return { token };
}

export default function (data) {
  const token = data.token; // Use the token from setup

  const fullUrl = `${url}?limit=20`;
  console.log(`Fetching muted users`);

  // Send GET request to fetch muted users
  const res = http.get(fullUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  logStatus(res, `Fetching muted users`, 'get_user_muted');

  // Validate the response
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response contains muted users data': (r) => {
      try {
        const body = r.json();
        return body.data && Array.isArray(body.data.data);
      } catch {
        return false;
      }
    },
    'response contains success message': (r) => {
      try {
        const body = r.json();
        return body.message === 'Muted list retrieved successfully';
      } catch {
        return false;
      }
    }
  });

  console.log(`Response: ${res.body}`);

  // Simulate real user behavior with random sleep
  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}
