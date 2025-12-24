import {
  email as randEmail,
  seed as randSeed,
  string as randString,
  int as randInt
} from './random.js';

import { Counter } from 'k6/metrics';

export const BASE_URL = __ENV.BASE_URL;
export const WAIT_TIME = Number(__ENV.WAIT_TIME) || 1;
export const email = __ENV.EMAIL || 'mariorafat10@gmail.com';
export const password = __ENV.PASSWORD || '';

// Export random functions for use in tests

// If a RAND_SEED env var is provided, seed the random generator for reproducible runs
if (__ENV.RAND_SEED) {
  randSeed(Number(__ENV.RAND_SEED) || __ENV.RAND_SEED);
}

export const validUserIds = [
  '3d6eacb0-fd31-4e6c-b85a-862a1e45bcf7',
  '30eccf23-3e37-4308-9313-1c3547da14a5',
  'b36c6d01-f478-4338-86cf-1499526f9ddf',
  '8b36bd34-b743-4355-8cd1-d215a4cb5050',
  'b825aee5-903f-4cf0-b52a-3e59923ced60',
  '98626d50-106e-4c62-a1ff-b30902b5aa34',
  'c2fb38f9-4865-4d86-bbc5-9782c9e83e2e',
  '285864e9-2340-4d80-96b3-ea5c2a233474'
];
export const myId = 'c2fb38f9-4865-4d86-bbc5-9782c9e83e2e';

/**
 * Generate a random phone number in international format
 * @returns {string} phone number like "+1-555-123-4567"
 */
export function randPhone() {
  const countryCode = randInt(1, 999); // Country code 1-999
  const areaCode = randInt(100, 999); // Area code 100-999
  const exchangeCode = randInt(100, 999); // Exchange code 100-999
  const lineNumber = randInt(1000, 9999); // Line number 1000-9999

  return `+${countryCode}-${areaCode}-${exchangeCode}-${lineNumber}`;
}

/**
 * Get email from env or generate a random one
 * @param {string} prefix - prefix for generated email (default: 'user')
 * @returns {string} email address
 */
export function getEmailOrRandom(prefix = 'user') {
  return email || randEmail(prefix);
}

/**
 * Generate credentials using env values or random generation
 * @param {string} prefix - prefix for generated email (default: 'user')
 * @returns {object} { email, password }
 */
export function generateCredentials(realUser = false) {
  if (realUser) {
    console.log(__ENV.EMAIL, __ENV.PASSWORD);
    return {
      identifier: email,
      type: 'email',
      password: password
    };
  }
  return {
    identifier: randEmail('invalid_user'),
    password: randString(30),
    type: 'email'
  };
}

/**
 * Sleep for a random duration to simulate real user behavior
 * @param {number} minSeconds - minimum sleep time (default: 1)
 * @param {number} maxSeconds - maximum sleep time (default: 5)
 * @example randomSleep(2, 8) // sleep 2-8 seconds
 */
export function randomeSeconds(minSeconds = 1, maxSeconds = 5) {
  const randomSeconds = randInt(minSeconds, maxSeconds);
  return randomSeconds;
}

export function getUrl(endpoint) {
  return `${BASE_URL}${endpoint}`;
}

//generate strong password
export function generateStrongPassword(length = 12) {
  // Password (min 8 chars, must include uppercase, lowercase, and number/special char)
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';

  if (length < 8) length = 8; // enforce minimum length

  let password = '';
  password += uppercase.charAt(randInt(0, uppercase.length - 1));
  password += lowercase.charAt(randInt(0, lowercase.length - 1));
  password += numbers.charAt(randInt(0, numbers.length - 1));
  password += specialChars.charAt(randInt(0, specialChars.length - 1));

  // Fill the rest of the password length with random chars
  const allChars = uppercase + lowercase + numbers + specialChars;
  for (let i = 4; i < length; i++) {
    password += allChars.charAt(randInt(0, allChars.length - 1));
  }

  return password;
}

export const options = {
  stages: [
    { duration: '1m', target: 100 }, // ramp-up from 0 to 100 users
    { duration: '1m', target: 100 }, // hold at 100 users
    { duration: '1m', target: 200 }, // ramp-up to 200 users
    { duration: '1m', target: 200 }, // hold at 200 users (stress peak)
    { duration: '1m', target: 1000 }, // ramp-up to 1000 users
    { duration: '1m', target: 1000 }, // hold at 1000 users (stress peak)
    { duration: '1m', target: 1500 }, // ramp-up to 1500 users
    { duration: '1m', target: 1500 }, // hold at 1500 users (stress peak)
    { duration: '1m', target: 0 } // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% requests should fail
    http_req_duration: ['p(95)<800'] // 95% of requests <800ms
  },
  cloud: {
    projectID: 5399990
  }
};

export const secondaryOptions = {
  stages: [
    { duration: '10s', target: 100 }, // ramp-up from 0 to 100 users
    { duration: '15s', target: 100 }, // ramp-up from 0 to 100 users

    { duration: '10s', target: 200 }, // ramp-up from 0 to 100 users
    { duration: '15s', target: 200 }, // ramp-up from 0 to 100 users

    { duration: '10s', target: 300 }, // ramp-up to 200 users
    { duration: '15s', target: 300 }, // ramp-up to 200 users

    { duration: '10s', target: 500 }, // ramp-up to 200 users
    { duration: '15s', target: 500 }, // ramp-up to 200 users

    { duration: '10s', target: 600 }, // ramp-up to 200 users
    { duration: '15s', target: 600 }, // ramp-up to 200 users

    { duration: '10s', target: 800 }, // ramp-up to 200 users
    { duration: '15s', target: 800 }, // ramp-up to 200 users

    { duration: '10s', target: 1000 }, // ramp-up to 200 users
    { duration: '15s', target: 1000 }, // ramp-up to 200 users

    { duration: '10s', target: 1200 }, // ramp-up to 200 users
    { duration: '15s', target: 1200 }, // ramp-up to 200 users

    { duration: '15s', target: 1300 }, // ramp-up to 200 users
    { duration: '15s', target: 1300 }, // ramp-up to 200 users

    { duration: '15s', target: 1500 }, // ramp-up to 200 users
    { duration: '15s', target: 1500 }, // ramp-up to 200 users
    { duration: '1m', target: 0 } // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% requests should fail
    http_req_duration: ['p(95)<800'] // 95% of requests <800ms
  },
  cloud: {
    projectID: 5399990
  },
  insecureSkipTLSVerify: true,
  noConnectionReuse: false
};

export function countersStatus() {
  const counters = {
    status1xx: new Counter('status_1xx'),
    status2xx: new Counter('status_2xx'),
    status3xx: new Counter('status_3xx'),
    status4xx: new Counter('status_4xx'),
    status5xx: new Counter('status_5xx'),
    status500: new Counter('internal_server_error_500')
  };

  // Function to log and update counters based on response status
  function logStatus(res, label, testName) {
    console.log(`${label} - Status: ${res.status}`);

    if (res.status >= 100 && res.status < 200) {
      counters.status1xx.add(1);
    } else if (res.status >= 200 && res.status < 300) {
      counters.status2xx.add(1);
    } else if (res.status >= 300 && res.status < 400) {
      counters.status3xx.add(1);
    } else if (res.status >= 400 && res.status < 500) {
      counters.status4xx.add(1);
    } else if (res.status >= 500 && res.status < 600) {
      counters.status5xx.add(1);
      if (res.status === 500) {
        counters.status500.add(1);
      }
    }
  }

  // Return the logStatus function and counters
  return { logStatus, counters };
}

export { randEmail, randString };
