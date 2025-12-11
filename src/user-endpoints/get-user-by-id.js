import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  validUserIds
} from '../../utils/config.js';

const url = getUrl('/users'); // Base URL for the endpoint
const { logStatus, counters } = countersStatus();

export const options = secondaryOptions;

export default function () {
  // Select a random user ID from the list
  const userId = validUserIds[Math.floor(Math.random() * validUserIds.length)];
  const fullUrl = `${url}/${userId}`;
  console.log(`Fetching user by ID: ${userId}`);

  // Send GET request to fetch user by ID
  const res = http.get(fullUrl, {
    headers: { Accept: 'application/json' }
  });

  logStatus(res, `Fetching user by ID: ${userId}`, 'get_user_by_id');

  // Validate the response
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response contains user data': (r) => {
      try {
        const body = r.json();
        return body.data && body.data.user_id === userId;
      } catch {
        return false;
      }
    },
    'response contains success message': (r) => {
      try {
        const body = r.json();
        return body.message === 'User retrieved successfully';
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
