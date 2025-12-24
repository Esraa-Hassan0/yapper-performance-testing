import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  generateCredentials
} from '../../utils/config.js';

const avatarUploadUrl = getUrl('/users/me/upload-avatar');
const avatarDeleteUrl = getUrl('/users/me/delete-avatar');
const coverUploadUrl = getUrl('/users/me/upload-cover');
const coverDeleteUrl = getUrl('/users/me/delete-cover');
const loginUrl = getUrl('/auth/login');
const { logStatus, counters } = countersStatus();

// Open files in the global scope
const avatarFile = open('../../test-data/avatar.jpg', 'b');
const coverFile = open('../../test-data/cover.jpg', 'b');

export const options = {
  ...secondaryOptions,
  stages: [{ duration: '30s', target: 10 }]
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

  // Upload avatar
  const avatarPayload = http.file(avatarFile, 'avatar.jpg');
  const avatarRes = http.post(
    avatarUploadUrl,
    { file: avatarPayload },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  logStatus(avatarRes, 'Uploading avatar', 'upload_avatar');

  check(avatarRes, {
    'avatar upload status is 201': (r) => r.status === 201,
    'avatar upload success message': (r) => {
      try {
        if (!r.body || r.status === 0) return false;
        const body = r.json();
        return body.message === 'Avatar uploaded successfully';
      } catch {
        return false;
      }
    }
  });
  if (avatarRes.status >= 400 && avatarRes.status < 500) {
    console.error(
      `Avatar Upload Response: ${avatarRes.body} with status code: ${avatarRes.status}`
    );
  } else {
    console.log('Avatar uploaded successfully.');
  }
  if (avatarRes.status === 0) {
    console.error(
      'Avatar upload failed with timeout. Skipping delete operation.'
    );
  } else {
    console.log('Avatar upload response:', avatarRes.body);
  }

  const avatarUrl =
    avatarRes.status === 201 ? avatarRes.json()?.data?.image_url : null;

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
  console.log('Cover upload response:', coverRes.body);

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
  }
  if (coverRes.status === 0) {
    console.error(
      'Cover upload failed with timeout. Skipping delete operation.'
    );
  }

  const coverUrl =
    coverRes.status === 201 ? coverRes.json()?.data?.image_url : null;

  // Delete avatar - validate URL first
  if (!avatarUrl) {
    console.error('Avatar URL is not set. Skipping avatar delete operation.');
  } else {
    console.log('Attempting to delete avatar with URL:', avatarUrl);
    const deleteAvatarRes = http.del(
      avatarDeleteUrl,
      JSON.stringify({ file_url: avatarUrl }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' }
      }
    );
    logStatus(deleteAvatarRes, 'Deleting avatar', 'delete_avatar');
    console.log('Avatar delete response status:', deleteAvatarRes.status);

    if (deleteAvatarRes.status >= 400 && deleteAvatarRes.status < 500) {
      console.error(
        `Avatar Delete Response: ${deleteAvatarRes.body} with status code: ${deleteAvatarRes.status}`
      );
    } else {
      console.log('Avatar deleted successfully.');
    }

    check(deleteAvatarRes, {
      'avatar delete status is 200': (r) => r.status === 200,
      'avatar delete success message': (r) => {
        try {
          if (!r.body || r.status === 0) return false;
          const body = r.json();
          return body.message === 'Avatar deleted successfully';
        } catch {
          return false;
        }
      }
    });
  }

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

    // Log detailed responses for debugging
    console.log('Cover delete response:', deleteCoverRes.body);

    if (deleteCoverRes.status >= 400 && deleteCoverRes.status < 500) {
      console.error(
        `Cover Delete Response: ${deleteCoverRes.body} with status code: ${deleteCoverRes.status}`
      );
    } else {
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

  console.log('Avatar and cover upload and delete operations completed.');

  // Simulate real user behavior with random sleep
  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}
