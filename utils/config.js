import {
  email as randEmail,
  seed as randSeed,
  string as randString,
  int as randInt
} from './random.js';

export const BASE_URL = __ENV.BASE_URL;
export const WAIT_TIME = Number(__ENV.WAIT_TIME) || 1;
export const email = __ENV.EMAIL || 'mariorafat10@gmail.com';
export const password = __ENV.PASSWORD || '';

// Export random functions for use in tests

// If a RAND_SEED env var is provided, seed the random generator for reproducible runs
if (__ENV.RAND_SEED) {
  randSeed(Number(__ENV.RAND_SEED) || __ENV.RAND_SEED);
}

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
    return {
      identifier: email,
      password: password,
      type: 'email'
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
    { duration: '1m', target: 50 }, // ramp-up from 0 to 50 users
    { duration: '2m', target: 50 }, // hold at 50 users
    { duration: '1m', target: 100 }, // ramp-up to 100 users
    { duration: '2m', target: 100 }, // hold at 100 users (stress peak)
    { duration: '1m', target: 0 } // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% requests should fail
    http_req_duration: ['p(95)<800'] // 95% of requests <600ms
  },
  cloud: {
    projectID: 5399990
  }
};

export { randEmail, randString };