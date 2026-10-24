<div align="center">

# Reviewly API

**REST API for the Reviewly project submission and review platform.**
Authentication, role-based access, validated submissions and mentor reviews.

![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)

</div>

---

## Table of contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Business rules](#business-rules)
- [Security](#security)
- [Testing](#testing)
- [Known limitations](#known-limitations)

---

## Overview

The API powers both sides of Reviewly:

- **Students** sign up, submit projects and read their own submissions with feedback.
- **Mentors** list every submission with pagination and filters, approve or reject them, and read aggregated statistics.

The code follows a simple layered design: **route → middleware → controller → service → Prisma**. Controllers only read input and send responses; all business rules live in services.

The frontend lives in [`../frontend`](../frontend).

---

## Tech stack

| Area | Tools |
|---|---|
| Runtime | [Bun](https://bun.sh) 1.x |
| Framework | [Express 5](https://expressjs.com) (async errors handled natively) |
| Language | TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Database | PostgreSQL via [Prisma 7](https://www.prisma.io) with `@prisma/adapter-pg` |
| Validation | [Zod 4](https://zod.dev) for body, query, params and environment |
| Auth | `jsonwebtoken` (JWT in an httpOnly cookie), `bcryptjs` (cost 12) |
| Security | `helmet`, `cors`, `express-rate-limit`, `cookie-parser` |
| Tests | `bun test` |

---

## Getting started

### Prerequisites
- [Bun](https://bun.sh) 1.x
- A PostgreSQL database (local, Docker, or hosted such as Prisma Postgres, Neon or Supabase)

### Setup

```bash
bun install
cp .env.example .env         # set DATABASE_URL and a random JWT_SECRET (32+ chars)
bunx prisma migrate deploy   # create the tables
bunx prisma generate         # generate the Prisma client into src/generated/prisma
bunx prisma db seed          # create the mentor account
bun run dev                  # http://localhost:5000
```

Check it is running:

```bash
curl http://localhost:5000/api/health
# {"success":true,"message":"OK"}
```

### Seeded mentor

Mentors cannot sign up through the API. The seed creates one from the `SEED_MENTOR_*` variables:

| Email | Password |
|---|---|
| `mentor@example.com` | `ChangeMe123` |

The seed uses an **upsert by email**, so running it again never creates a second mentor. Change these values before seeding any shared database.

---

## Environment variables

Validated with Zod at startup. The server **refuses to boot** if a value is missing or the secret is too short.

| Variable | Required | Default | Description |
|---|:-:|---|---|
| `NODE_ENV` | | `development` | `development`, `test` or `production` (production turns on `secure` cookies) |
| `PORT` | | `5000` | HTTP port |
| `DATABASE_URL` | ✅ | | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | | At least 32 characters |
| `JWT_EXPIRES_IN` | | `1d` | Token lifetime |
| `CLIENT_ORIGIN` | | `http://localhost:3000` | The only origin allowed by CORS |
| `SEED_MENTOR_NAME` | | `Mentor` | Used by the seed only |
| `SEED_MENTOR_EMAIL` | seed | | Used by the seed only |
| `SEED_MENTOR_PASSWORD` | seed | | Used by the seed only |

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start with watch mode |
| `bun run start` | Start without watch |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | Run unit and API tests |
| `bun run db:migrate` | `prisma migrate dev` (create a new migration while developing) |
| `bun run db:seed` | `prisma db seed` |
| `bun run db:generate` | `prisma generate` |

---

## Project structure

```
backend/
├── prisma/
│   ├── schema.prisma            Models, enums, indexes
│   ├── migrations/              SQL migrations
│   └── seed.ts                  Mentor upsert
├── prisma.config.ts             Prisma 7 config (schema, migrations, seed)
├── src/
│   ├── app.ts                   Express app (exported without listen, used by tests)
│   ├── server.ts                Starts the HTTP server
│   ├── config/env.ts            Zod-validated environment
│   ├── lib/prisma.ts            Prisma client with the pg adapter
│   ├── middlewares/
│   │   ├── authenticate.ts      Verifies the JWT cookie → req.user
│   │   ├── authorize.ts         Role check (403)
│   │   ├── validate.ts          Zod validation for body / query / params (422)
│   │   ├── rateLimiters.ts      Global, auth and submission limits
│   │   └── errorHandler.ts      404 handler and central error handler
│   ├── modules/
│   │   ├── auth/                auth.route, .controller, .service, .schema
│   │   └── submission/          submission.route, .controller, .service, .schema
│   ├── utils/
│   │   ├── ApiError.ts          Error with status code and field errors
│   │   ├── sendResponse.ts      Success envelope
│   │   └── normalizeRepoUrl.ts  Key used for duplicate detection
│   └── generated/prisma/        Generated client (git-ignored)
└── tests/
    ├── api.test.ts              End-to-end API flow
    └── normalizeRepoUrl.test.ts
```

---

## Data model

```
┌──────────────┐ 1      N ┌──────────────────┐ 1      N ┌──────────────┐
│     User     │─────────<│    Submission    │─────────<│   Feedback   │
│ (STUDENT or  │ student  │ status: PENDING  │          │   message    │
│   MENTOR)    │          │ APPROVED/REJECTED│          └──────┬───────┘
└──────┬───────┘          └──────────────────┘                 │
       │ 1                                              N      │
       └───────────────────── mentor ──────────────────────────┘
```

| Model | Key fields |
|---|---|
| `User` | `id`, `name`, `email` (unique), `passwordHash`, `role` (`STUDENT` \| `MENTOR`) |
| `Submission` | `projectName`, `repoUrl`, `repoUrlNormalized` (**unique**), `liveLink`, `description`, `status`, `reviewedAt`, `studentId` |
| `Feedback` | `message`, `submissionId`, `mentorId` |

**Indexes**
- `repoUrlNormalized` unique: duplicate protection enforced by the database
- `(status, createdAt desc)`: filtered, newest-first mentor table
- `(studentId, createdAt desc)`: a student's own list

---

## API reference

Base URL: `http://localhost:5000/api`

### Response format

```jsonc
// Success
{
  "success": true,
  "message": "Submissions fetched",
  "data": [ /* ... */ ],
  "meta": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }   // lists only
}

// Error
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "repoUrl", "message": "Must be a GitHub repository URL (https://github.com/owner/repo)" }]
}
```

### Endpoints

#### Auth

| Method | Path | Access | Body | Success |
|---|---|---|---|---|
| `POST` | `/auth/signup` | Public | `{ name, email, password }` | `201` user + cookie |
| `POST` | `/auth/login` | Public | `{ email, password }` | `200` user + cookie |
| `POST` | `/auth/logout` | Any | | `200`, cookie cleared |
| `GET` | `/auth/me` | Logged in | | `200` current user |

#### Submissions

| Method | Path | Access | Input | Success |
|---|---|---|---|---|
| `POST` | `/submissions` | Student | `{ projectName, repoUrl, liveLink, description }` | `201` submission |
| `GET` | `/submissions/me` | Student | `?page=1&pageSize=10&status=` | `200` list + meta |
| `GET` | `/submissions` | Mentor | `?page=1&pageSize=10&status=` | `200` list + meta |
| `GET` | `/submissions/stats` | Mentor | | `200` `{ total, pending, approved, rejected }` |
| `PATCH` | `/submissions/:id/status` | Mentor | `{ status: "APPROVED" \| "REJECTED", feedback? }` | `200` updated submission |
| `GET` | `/health` | Public | | `200` |

Each submission in a list includes its `student` (`id`, `name`, `email`) and `feedbacks` (with the mentor's name), loaded in the **same query**, so there is no N+1 problem.

### Example

```bash
# Log in as the mentor and keep the cookie
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"mentor@example.com","password":"ChangeMe123"}' \
  http://localhost:5000/api/auth/login

# Second page of rejected submissions
curl -b cookies.txt "http://localhost:5000/api/submissions?status=REJECTED&page=2"

# Reject with a reason
curl -b cookies.txt -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"REJECTED","feedback":"The live link returns 404."}' \
  http://localhost:5000/api/submissions/<id>/status
```

### Status codes

| Code | When |
|---|---|
| `400` | Malformed JSON body |
| `401` | No session, or the token is expired or invalid |
| `403` | Logged in, but the wrong role |
| `404` | Submission or route not found |
| `409` | Email already registered, repository already submitted, or submission already reviewed |
| `422` | Validation failed (field errors in `errors[]`) |
| `429` | Rate limit hit (`Retry-After` header included) |
| `500` | Unexpected error (generic message; details only in server logs) |

---

## Business rules

### Validation

| Field | Rule |
|---|---|
| `name` | Trimmed, 2–60 characters |
| `email` | Valid email, lowercased, max 120 |
| `password` | 8–72 characters, at least one letter and one number |
| `projectName` | Trimmed, 3–80 characters |
| `repoUrl` | `https://github.com/<owner>/<repo>` (optional `www.`, `.git`, trailing `/`), max 200 |
| `liveLink` | Valid `https://` URL with a real domain, max 200 |
| `description` | Trimmed, 20–1000 characters |
| `status` (review) | `APPROVED` or `REJECTED` |
| `feedback` | 5–500 characters, **required when rejecting** |
| `page` / `pageSize` | Integers; `page ≥ 1`, `pageSize` 1–50 (default 10) |
| `status` (filter) | `PENDING`, `APPROVED` or `REJECTED`, optional |

Unknown fields are stripped, so a client can never set `role` or `studentId`.

### Duplicates
A repository can be submitted **once, by anyone**. URLs are normalized first (lowercase, `www.` removed, trailing `/` and `.git` removed), so `https://www.GitHub.com/Owner/Repo.git/` and `https://github.com/owner/repo` collide. The check is a **unique index**, not a lookup before insert, so two simultaneous requests cannot both succeed.

### Review flow
`PENDING → APPROVED` or `PENDING → REJECTED`, exactly once. The update runs inside a transaction with `WHERE status = 'PENDING'`; if nothing was updated the API answers `409` (already reviewed) or `404` (unknown id). The feedback is written in the same transaction.

### Rate limits

| Scope | Limit | Keyed by |
|---|---|---|
| All routes | 100 requests / minute | IP |
| `POST /auth/login`, `POST /auth/signup` | 10 / 15 minutes | IP |
| `POST /submissions` | 5 attempts / 10 minutes | Student id |

---

## Security

- **Passwords** hashed with bcrypt (cost 12), never returned or logged.
- **Same login error** for an unknown email and a wrong password, and the same timing (a dummy hash is compared when the email does not exist).
- **JWT** `{ sub, role }` signed with `JWT_SECRET`, stored in an **httpOnly**, `sameSite=lax` cookie (`secure` in production). JavaScript cannot read it.
- **Authentication vs authorization:** `authenticate` answers "who are you?", `authorize(...roles)` answers "what may you do?". Both run on every protected route.
- **No IDOR:** a student's list is always filtered by the id from the verified token, never by a value from the request.
- **helmet** security headers, **CORS** limited to `CLIENT_ORIGIN` with credentials, JSON body limit of 10 kB.
- **Parameterized queries only** (Prisma); no raw SQL.
- **Central error handler:** no stack traces or database errors reach the client.
- `.env` is git-ignored; `.env.example` holds placeholders only.

---

## Testing

```bash
bun test
```

| Test | What it proves |
|---|---|
| URL normalization | Casing, `www.`, `.git` and trailing `/` map to one key |
| Signup with `role: "MENTOR"` | Account is still a `STUDENT`; no password hash in the response |
| Login failures | Wrong email and wrong password return the same `401` message |
| Session | Missing or tampered token → `401` |
| Validation | Bad repo URL → `422` with the `repoUrl` field |
| Duplicates | Same repo in different casing with `.git/` → `409` |
| Roles | Student → `403` on mentor routes; mentor → `403` on submit |
| Review | Reject without reason → `422`; second review → `409`; unknown id → `404` |
| Filtering | `?status=REJECTED` returns only rejected rows with correct `meta`; `pageSize=500` → `422` |
| Stats | `total = pending + approved + rejected` |
| Rate limit | Sixth attempt in 10 minutes → `429` with `Retry-After` |

The tests start the app on a random port and run against `DATABASE_URL`. Every row they create belongs to a `@test.local` user and is deleted afterwards. Point `DATABASE_URL` at a separate database if you prefer full isolation.

---

## Known limitations

- The rate-limit store is **in memory**: it resets on restart and is per process. Use a Redis store when running more than one instance.
- No refresh tokens: sessions last `JWT_EXPIRES_IN` (24 hours by default).
- A review cannot be undone, and a rejected repository cannot be resubmitted.
- Out of scope: password reset, email verification, editing or deleting submissions, managing mentors through the API.
