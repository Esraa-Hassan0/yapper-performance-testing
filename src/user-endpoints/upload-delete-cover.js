import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  generateCredentials
} from '../../utils/config.js';

const coverUploadUrl = getUrl('/users/me/upload-cover');
const coverDeleteUrl = getUrl('/users/me/delete-cover');
const loginUrl = getUrl('/auth/login');
const { logStatus, counters } = countersStatus();

// Open files in the global scope
const coverFile = open('../../test-data/cover.jpg', 'b');

export const options = {
  ...secondaryOptions,
  stages: [],
  vus: 1
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
    Authorization: `Bearer ${token}`
  };

  // Upload cover
  const coverPayload = http.file(coverFile, 'cover.jpg');
  console.log('Starting cover upload...');
  const coverRes = http.post(
    coverUploadUrl,
    { file: coverPayload },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  logStatus(coverRes, 'Uploading cover', 'upload_cover');
  console.log('Cover upload response status:', coverRes.status);
  console.log('Cover upload response body:', coverRes.body);

  check(coverRes, {
    'cover upload status is 201': (r) => r.status === 201,
    'cover upload success message': (r) => {
      try {
        if (!r.body || r.status === 0) return false;
        const body = r.json();
        return body.message === 'Cover uploaded successfully';
      } catch {
        return false;
      }
    }
  });

  if (coverRes.status >= 400 && coverRes.status < 500) {
    console.error(
      `Cover Upload Response: ${coverRes.body} and status code: ${coverRes.status}`
    );
  } else if (coverRes.status === 201) {
    console.log('Cover uploaded successfully.');
  }

  const coverUrl =
    coverRes.status === 201 ? coverRes.json()?.data?.image_url : null;

  // Delete cover - validate URL first
  if (!coverUrl) {
    console.error('Cover URL is not set. Skipping cover delete operation.');
  } else {
    console.log('Attempting to delete cover with URL:', coverUrl);
    const deleteCoverRes = http.del(
      coverDeleteUrl,
      JSON.stringify({ file_url: coverUrl }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' }
      }
    );
    logStatus(deleteCoverRes, 'Deleting cover', 'delete_cover');
    console.log('Cover delete response status:', deleteCoverRes.status);
    console.log('Cover delete response body:', deleteCoverRes.body);

    if (deleteCoverRes.status >= 400 && deleteCoverRes.status < 500) {
      console.error(
        `Cover Delete Response: ${deleteCoverRes.body} with status code: ${deleteCoverRes.status}`
      );
    } else if (deleteCoverRes.status === 200) {
      console.log('Cover deleted successfully.');
    }

    check(deleteCoverRes, {
      'cover delete status is 200': (r) => r.status === 200,
      'cover delete success message': (r) => {
        try {
          if (!r.body || r.status === 0) return false;
          const body = r.json();
          return body.message === 'Cover deleted successfully';
        } catch {
          return false;
        }
      }
    });
  }

  console.log('Cover upload and delete operations completed.');
}
