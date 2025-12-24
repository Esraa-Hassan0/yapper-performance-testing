# Yapper Performance Testing

Performance and load testing suite for Yapper, a Twitter-like social media platform. This project uses K6 to simulate realistic user traffic patterns and measure system performance under various load conditions.

## Overview

This repository provides comprehensive performance testing coverage for the Yapper backend APIs, including:

- Authentication and user management flows
- Tweet creation, interaction, and management
- Timeline and feed operations
- User profile and relationship management
- Chat and messaging endpoints

The test suite is designed to identify performance bottlenecks, measure response times and throughput, and validate system behavior under stress conditions.

## Tech Stack

| Tool                           | Purpose                                |
| ------------------------------ | -------------------------------------- |
| [K6](https://k6.io)            | Load and performance testing framework |
| [Grafana](https://grafana.com) | Metrics visualization and dashboards   |
| Node.js                        | Development environment and tooling    |

## Project Structure

```
yapper-performance-testing/
├── src/
│   ├── auth-endpoints/          # Authentication endpoint tests
│   │   ├── login.js
│   │   ├── signup.js
│   │   ├── logout.js
│   │   ├── refresh.js
│   │   ├── forget-password.js
│   │   ├── change-password.js
│   │   └── ...
│   ├── tweets-endpoints/        # Tweet operation tests
│   │   ├── create-delete-tweet.js
│   │   ├── like-unlike-tweet.js
│   │   ├── repost-unrepost-tweet.js
│   │   ├── quote-tweet.js
│   │   └── ...
│   ├── user-endpoints/          # User management tests
│   │   ├── follow-user.js
│   │   ├── get-current-user.js
│   │   ├── get-user-by-name.js
│   │   └── ...
│   ├── timeline-endpoints/      # Timeline and feed tests
│   ├── chat-endpoints/          # Messaging tests
│   ├── flows/                   # Complete user flow scenarios
│   │   ├── authentication_userManagement.js
│   │   └── tweets.js
│   └── bottleneck/              # Bottleneck identification tests
├── utils/
│   ├── config.js                # Configuration and test options
│   └── random.js                # Random data generation utilities
└── test-data/                   # Test data and fixtures
```

## Prerequisites

- [K6](https://k6.io/docs/getting-started/installation/) installed locally or K6 Cloud account
- Node.js (for development dependencies and linting)
- Access to Yapper backend API

## Installation

Clone the repository:

```bash
git clone https://github.com/your-username/yapper-performance-testing.git
cd yapper-performance-testing
```

Install development dependencies:

```bash
npm install
```

## Configuration

Set the following environment variables before running tests:

```bash
export BASE_URL="https://api.yapper.example.com"
export EMAIL="your-test-user@example.com"
export PASSWORD="your-password"
export WAIT_TIME=1
```

Optional configuration:

```bash
export RAND_SEED=12345          # For reproducible random data
```

## Running Tests

### Individual Endpoint Tests

Run a specific endpoint test:

```bash
k6 run src/auth-endpoints/login.js
```

### Complete Flow Tests

Run comprehensive user flow scenarios:

```bash
# Authentication and user management flow
k6 run src/flows/authentication_userManagement.js

# Tweet lifecycle flow
k6 run src/flows/tweets.js
```

### Custom Load Profiles

Modify the load stages in `utils/config.js` or override via command line:

```bash
k6 run --vus 100 --duration 5m src/flows/tweets.js
```

### K6 Cloud

Run tests on K6 Cloud for distributed load generation:

```bash
k6 cloud src/flows/authentication_userManagement.js
```

## Test Scenarios

### Authentication Flow

Tests the complete authentication lifecycle including:

- User login with email/password
- Token refresh
- Password confirmation
- Username availability checks
- Profile updates
- Logout

Load profile: Ramps from 0 to 1500 virtual users over 9 minutes.

### Tweet Flow

Tests comprehensive tweet operations:

- Create tweets with media (images/videos)
- Update tweet content
- Reply to tweets
- Quote tweets
- Like/unlike operations
- Repost/unrepost operations
- Bookmark management
- View tracking
- Tweet deletion

### Performance Thresholds

Default thresholds configured in `utils/config.js`:

- HTTP request failure rate: < 1%
- 95th percentile response time: < 800ms

## Metrics and Monitoring

The test suite tracks custom metrics:

- HTTP status code distribution (200, 201, 400, 401, 404, 500)
- Tweets created
- Likes, reposts, bookmarks
- View counts
- Error rates

View results in:

- K6 terminal output
- K6 Cloud dashboard (when using cloud execution)
- Grafana dashboards (when integrated with InfluxDB/Prometheus)

## Development

### Code Quality

Run ESLint to check code quality:

```bash
npm run lint
```

### Adding New Tests

1. Create a new test file in the appropriate directory under `src/`
2. Import utilities from `utils/config.js` and `utils/random.js`
3. Define test options and custom metrics
4. Implement the test scenario
5. Add appropriate checks and logging

Example structure:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { getUrl, options as testOptions } from '../../utils/config.js';

export const options = {
  ...testOptions,
  // Custom options
};

export default function () {
  // Test implementation
}
```

## Troubleshooting

### Connection Refused

Ensure the `BASE_URL` environment variable points to a running Yapper backend instance.

### Authentication Failures

Verify that `EMAIL` and `PASSWORD` environment variables are set correctly and correspond to a valid user account.

### High Error Rates

Check backend logs for errors and ensure the system has sufficient resources to handle the configured load.

## License

ISC

## Contributing

Contributions are welcome. Please ensure all tests pass and follow the existing code structure when submitting pull requests.
