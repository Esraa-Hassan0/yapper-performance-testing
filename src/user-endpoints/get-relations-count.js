import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  generateCredentials
} from '../../utils/config.js';

const relationsCountUrl = getUrl('/users/me/relations-count');
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
  const headers = {
    Authorization: `Bearer ${token}`
  };

  console.log('Fetching user relations count...');

  const res = http.get(relationsCountUrl, { headers });

  logStatus(res, 'Getting user relations count', 'get_relations_count');
  console.log('User relations count response status:', res.status);
  console.log('User relations count response body:', res.body);

  check(res, {
    'relations count status is 200': (r) => r.status === 200,
    'relations count success message': (r) => {
      try {
        if (!r.body || r.status === 0) return false;
        const body = r.json();
        return body.message === 'User relations counts retrieved successfully';
      } catch {
        return false;
      }
    },
    'relations count has data': (r) => {
      try {
        if (!r.body || r.status === 0) return false;
        const body = r.json();
        return (
          body.data &&
          typeof body.data.blocked_count === 'number' &&
          typeof body.data.muted_count === 'number'
        );
      } catch {
        return false;
      }
    }
  });

  if (res.status >= 400 && res.status < 500) {
    console.error(
      `Relations Count Response: ${res.body} with status code: ${res.status}`
    );
  } else if (res.status === 200) {
    console.log('User relations count retrieved successfully.');
    try {
      const body = res.json();
      console.log('Blocked count:', body.data.blocked_count);
      console.log('Muted count:', body.data.muted_count);
    } catch {
      console.log('Could not parse relations count from response');
    }
  }

  console.log('Get user relations count operation completed.');

  // Simulate real user behavior with random sleep
  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}
