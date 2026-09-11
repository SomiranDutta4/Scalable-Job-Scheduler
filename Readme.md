# Distributed Job Scheduler

A backend job-queue and scheduling service built with Node.js, Express, Redis, and MongoDB. The project implements priority queues, delayed jobs, retries with exponential backoff, job locking, JWT-based authentication, and real-time job events over Redis Pub/Sub and WebSockets.

## Features

- **Priority queues** with three Redis lists:
  - High priority
  - Normal priority
  - Low priority
- **Immediate and delayed execution** using a Redis sorted set for scheduled jobs.
- **Persistent job state** stored in MongoDB.
- **Automatic retries** with exponential backoff.
- **Redis-based job locking** using `SET ... NX` with a 5-minute expiration.
- **Manual retry and cancellation** through the API.
- **Real-time job events** using Redis Pub/Sub and WebSockets.
- **JWT authentication** for protected job endpoints.
- **Per-user Redis rate limiting** on job creation and manual retry endpoints.
- **Password hashing** with bcrypt.

## Tech Stack

- Node.js
- Express
- Redis
- MongoDB / Mongoose
- WebSockets (`ws`)
- JWT (`jsonwebtoken`)
- bcrypt

## Architecture

The system uses Redis for the fast, transient parts of the scheduler and MongoDB for persistent job data.

```text
                         ┌────────────────────┐
                         │      Client        │
                         └─────────┬──────────┘
                                   │ HTTP / WebSocket
                     ┌─────────────┴─────────────┐
                     │                           │
                     ▼                           ▼
              ┌──────────────┐           ┌──────────────┐
              │ Express API  │           │ WebSocket    │
              │ + JWT Auth   │           │ Server /ws   │
              └──────┬───────┘           └──────┬───────┘
                     │                          │
          ┌──────────┴──────────┐               │
          │                     │               │
          ▼                     ▼               │
     ┌──────────┐          ┌──────────┐         │
     │ MongoDB  │          │  Redis   │─────────┘
     │ Job/User │          │ queues + │   Pub/Sub
     │  state   │          │ schedule │
     └──────────┘          └────┬─────┘
                                │
                                ▼
                         ┌──────────────┐
                         │    Worker    │
                         │ queue polling│
                         │ + execution  │
                         └──────────────┘
```

### Job flow

1. An authenticated client creates a job through the API.
2. Jobs scheduled for the future are stored in the `jobs:scheduled` Redis sorted set.
3. Immediate jobs are pushed into one of three priority queues:
   - `queue:immediate:high`
   - `queue:immediate:normal`
   - `queue:immediate:low`
4. The worker checks the scheduled set and moves due jobs into their priority queue.
5. A worker acquires a Redis lock before processing a job.
6. The job state is persisted in MongoDB and job-state events are published through Redis Pub/Sub.
7. Successful jobs become `completed`.
8. Failed jobs are either retried with exponential backoff or marked `failed` after the configured maximum number of attempts.

## Job States

Jobs can move through these states:

```text
pending
   │
   ├──────────────► queued ─────► processing ─────► completed
   │                                │
   │                                └─────────────► retrying
   │                                                   │
   │                                                   └──► queued
   │
   └──────────────► cancelled

processing ─────► failed
cancelled  ─────► queued   (manual retry)
failed     ─────► queued   (manual retry)
```

The MongoDB job model defines the supported states as:

`pending`, `queued`, `processing`, `completed`, `retrying`, `failed`, and `cancelled`.

## API

The API is mounted under `/api`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/user/signup` | No | Create a user |
| `POST` | `/api/user/login` | No | Login and receive a JWT |
| `POST` | `/api/user/test` | No | Create a test user and receive a JWT |

### Jobs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/job/new` | JWT | Create a job |
| `GET` | `/api/job/status/:jobId` | JWT | Get one of the authenticated user's jobs |
| `GET` | `/api/jobs` | JWT | List the authenticated user's jobs |
| `PUT` | `/api/job/cancel/:jobId` | JWT | Cancel a job |
| `PUT` | `/api/job/retry/:jobId` | JWT | Manually retry a failed or cancelled job |

### Create a job

`POST /api/job/new`

Example body:

```json
{
  "description": "Example scheduled task",
  "task": "run-example-task",
  "scheduledFor": "2026-09-11T20:00:00.000Z",
  "timeoutMs": 0,
  "priority": 3
}
```

`priority` accepts:

- `3` → high
- `2` → normal
- `1` → low

When `scheduledFor` is omitted or is in the past, the job is placed directly into its priority queue. Future jobs are stored in the scheduled-job sorted set until they are due.

## Authentication

Signup stores a bcrypt password hash. Login verifies the password and returns a JWT containing the user's ID.

Protected endpoints expect:

```http
Authorization: Bearer <token>
```

Tokens are configured to expire after **1 hour**.

## Rate Limiting

The project applies a Redis-backed per-user rate limiter to:

- `POST /api/job/new`
- `PUT /api/job/retry/:jobId`

Those routes are configured for **10 requests per 60 seconds per authenticated user**.

The implementation uses a Redis counter with `INCR` and `EXPIRE` for the window.

## Worker

The worker continuously:

1. Checks the scheduled-job sorted set for jobs whose scheduled timestamp has arrived.
2. Moves due jobs into the appropriate priority queue.
3. Blocks on the three Redis queues until a job is available.
4. Attempts to acquire a job-specific Redis lock:
   ```text
   lock:job:<jobId>
   ```
5. Marks the job as `processing` and increments its attempt count.
6. Executes the task.
7. Marks successful jobs as `completed`.
8. On failure, retries using exponential backoff:
   ```text
   delay = 2^(attempts - 1) seconds
   ```
9. Marks jobs as `failed` once `MAX_ATTEMPTS` is reached.

The current task executor is a simulated workload: each task runs for a random duration between 2 and 10 seconds and has a 10% per-second chance of failing.

## Real-Time Job Events

The worker and job controller publish events to the Redis channel:

```text
events:jobs
```

A WebSocket server subscribes to that channel and broadcasts received event messages to connected WebSocket clients.

WebSocket endpoint:

```text
/ws
```

Example event shape:

```json
{
  "jobId": "job-id",
  "userId": "user-id",
  "status": "processing",
  "timestamp": "2026-09-11T14:00:00.000Z",
  "attempt": 1
}
```

Depending on the transition, events may include additional fields such as priority, retry delay, attempt number, or a manual-retry message.

## Data Model

### Job

A job contains:

- `id`
- `userId`
- `description`
- `task`
- `priority`
- `scheduledFor`
- `timeoutMs`
- `status`
- `attempts`
- `createdAt`
- `sentToQueueAt`
- `completedAt`

### User

A user contains:

- `id`
- `name`
- `email`
- `passwordHash`
- `createdAt`
- `updatedAt`

## Environment Variables

Create a `.env` file with the values required by the application:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
REDIS_URL=your_redis_connection_string
JWT_SECRET=your_jwt_secret
MAX_ATTEMPTS=3
```

`MAX_ATTEMPTS` controls the maximum number of processing attempts before a job is permanently marked as failed.

## Installation

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm start
```

Start in development mode:

```bash
npm run dev
```

The package also exposes a worker command:

```bash
npm run worker
```

## Notes

The project is designed as a lightweight job-queue system inspired by the core ideas behind queue libraries such as BullMQ, with Redis handling queue/scheduling operations and MongoDB providing durable job state.
