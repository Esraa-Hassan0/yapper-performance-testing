import {
  randomSeed,
  randomIntBetween,
  randomFloatBetween,
  randomItem,
  randomString
} from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Lightweight wrapper utilities around k6/random with safer defaults
export function seed(s) {
  // Accept numeric or string seeds
  if (s === undefined || s === null) return;
  if (typeof s === 'string' && s !== '' && !Number.isNaN(Number(s))) {
    randomSeed(Number(s));
    return;
  }
  if (typeof s === 'number') randomSeed(s);
}

export function int(min = 0, max = 1) {
  return randomIntBetween(min, max);
}

export function float(min = 0, max = 1) {
  return randomFloatBetween(min, max);
}

export function item(arr) {
  return randomItem(arr);
}

export function string(len = 8, charset) {
  // k6's randomString expects a length and an optional charset string
  const cs = charset || 'abcdefghijklmnopqrstuvwxyz0123456789';
  return randomString(len, cs);
}

export function weightedPick(items, weights) {
  if (
    !Array.isArray(items) ||
    !Array.isArray(weights) ||
    items.length !== weights.length
  ) {
    throw new Error('items and weights must be arrays of equal length');
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0];
  const r = randomFloatBetween(0, total);
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (r <= cum) return items[i];
  }
  return items[items.length - 1];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomIntBetween(0, i);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

export function email(prefix = 'user') {
  const local = randomString(8, 'abcdefghijklmnopqrstuvwxyz0123456789');
  const domain = randomItem([
    'example.com',
    'test.com',
    'mailinator.com',
    'local.test'
  ]);
  return `${prefix}.${local}@${domain}`;
}

export default {
  seed,
  int,
  float,
  item,
  string,
  weightedPick,
  shuffle,
  email
};
