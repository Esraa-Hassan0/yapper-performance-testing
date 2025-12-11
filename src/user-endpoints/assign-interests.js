import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  generateCredentials
} from '../../utils/config.js';

const assignInterestsUrl = getUrl('/users/me/interests');
const loginUrl = getUrl('/auth/login');
const { logStatus, counters } = countersStatus();

export const options = {
  ...secondaryOptions,
};

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
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Prepare interest IDs payload
  const categoryIds = [1, 2, 3];
  const payload = JSON.stringify({ category_ids: categoryIds });

  console.log('Assigning interests:', categoryIds);

  const res = http.post(assignInterestsUrl, payload, { headers });

  logStatus(res, 'Assigning interests', 'assign_interests');
  console.log('Assign interests response status:', res.status);
  console.log('Assign interests response body:', res.body);

  check(res, {
    'assign interests status is 201': (r) => r.status === 201,
    'assign interests success message': (r) => {
      try {
        if (!r.body || r.status === 0) return false;
        const body = r.json();
        return body.message === 'Interests assigned successfully';
      } catch {
        return false;
      }
    }
  });

  if (res.status >= 400 && res.status < 500) {
    console.error(
      `Assign Interests Response: ${res.body} with status code: ${res.status}`
    );
  } else if (res.status === 201) {
    console.log('Interests assigned successfully.');
  }

  console.log('Assign interests operation completed.');

  // Simulate real user behavior with random sleep
  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}
