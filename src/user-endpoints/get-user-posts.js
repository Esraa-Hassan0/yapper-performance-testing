import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  generateCredentials,
  validUserIds
} from '../../utils/config.js';

const url = getUrl('/users'); // Base URL for user posts endpoint
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

  // Select a random user ID from the list
  const userId = validUserIds[Math.floor(Math.random() * validUserIds.length)];
  const fullUrl = `${url}/${userId}/posts?limit=20`;
  console.log(`Fetching posts for user ID: ${userId}`);

  // Send GET request to fetch user posts
  const res = http.get(fullUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  logStatus(res, `Fetching posts for user ID: ${userId}`, 'get_user_posts');

  // Validate the response
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response contains posts data': (r) => {
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
        return body.message === 'Retrieved posts successfully';
      } catch {
        return false;
      }
    }
  });

  console.log(`Response for user ${userId}: ${res.body}`);

  // Simulate real user behavior with random sleep
  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}
