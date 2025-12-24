import http, { get } from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  secondaryOptions,
  validUserIds,
  countersStatus
} from '../../utils/config.js';
const { logStatus } = countersStatus();

const url = getUrl('/users');
const validCallback = http.expectedStatuses(200);
export  const options = secondaryOptions;

function getValidUserIdsAsCommaSeparatedString() {
  return validUserIds.join(',');
}

export default function () {
  // TEST 1: Valid user IDs
  const validIds = getValidUserIdsAsCommaSeparatedString();

  const fullValidUrl = `${url}?ids=${validIds}`;
  console.log(`Sending request to: ${fullValidUrl}`);

  const validRes = http.get(fullValidUrl, {
    headers: { Accept: 'application/json' },
    responseCallback: validCallback
  });

  logStatus(validRes, 'valid users', 'Get All Users - Valid IDs');
  console.log(`Response is ${validRes.body}`);

  check(validRes, {
    'valid users: status is 200': (r) => r.status === 200,
    'valid users: contains data array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.data);
      } catch {
        return false;
      }
    },
    'valid users: all records successful': (r) => {
      try {
        const body = r.json();
        return body.data.some((u) => u.success === true);
      } catch {
        return false;
      }
    }
  });

  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}
