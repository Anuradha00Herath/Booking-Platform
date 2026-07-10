# Booking Platform REST API

A Booking Platform REST API built with **NestJS**, **TypeScript**, **PostgreSQL**, and **Prisma** for the EN2H Software Engineer Intern technical assessment. It allows authenticated users to manage services, and customers to create bookings against those services.

## Project Overview

| Area | Choice |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| Database | PostgreSQL (via Docker) |
| ORM | Prisma 6 |
| Auth | JWT (access + refresh tokens), Passport |
| Validation | class-validator / class-transformer, global `ValidationPipe` |
| Errors | Global exception filter with Prisma error mapping |
| Docs | Swagger (OpenAPI) at `/api/docs` |
| Tests | Jest unit tests (services mocked at the Prisma layer) |

### Features

- **Auth**: register, login, refresh token rotation (hashed in DB), logout
- **Services**: full CRUD, JWT-protected, paginated listing
- **Bookings**: public creation, protected management, status transitions, cancel endpoint
- **Business rules**: bookings require an existing active service; no past dates; cancelled bookings can never be completed; duplicate bookings for the same service/date/time are rejected (application check + DB unique constraint)
- **Bonus**: pagination, search (customer name/email), filter by status, Swagger, Docker, validation, global exception handling, refresh tokens, unit tests, duplicate-booking prevention

## Project Structure

```
src/
├── auth/            # JWT auth: controller, service, strategy, guard, DTOs
├── users/           # User persistence (used by auth)
├── services/        # Service CRUD module
├── bookings/        # Booking module with business rules
├── common/          # Shared DTOs (pagination), global exception filter
├── prisma/          # PrismaService + global module
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma
└── migrations/      # SQL migration files
```

## Installation Steps

Prerequisites: Node.js 20+, npm, Docker (or a local PostgreSQL 14+).

```bash
git clone <repo-url>
cd booking-platform-api
npm install
cp .env.example .env   # then edit values (JWT secrets!)
```

## Environment Variables

See `.env.example`:

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/booking_platform?schema=public` |
| `JWT_ACCESS_SECRET` | Secret for access tokens | random string |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | random string |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |

## Database Setup

Option A — Docker (recommended):

```bash
docker compose up -d db
```

Option B — use an existing PostgreSQL instance and point `DATABASE_URL` at it.

## Running Migrations

```bash
npm run prisma:generate   # generate the Prisma client
npm run migrate:dev       # development (creates DB if needed)
# or in production:
npm run migrate:deploy
```

## Running the Application

```bash
npm run start:dev    # development with watch mode
# or
npm run build && npm run start:prod
```

Full Docker setup (API + DB, runs migrations automatically):

```bash
docker compose up --build
```

The API is served at `http://localhost:3000/api/v1`.

## Running Tests

```bash
npm test          # unit tests
npm run test:cov  # with coverage
```

## API Documentation

Interactive Swagger documentation: **`http://localhost:3000/api/docs`**

### Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | – | Register a user |
| POST | `/api/v1/auth/login` | – | Login, returns access + refresh tokens |
| POST | `/api/v1/auth/refresh` | – | Rotate tokens using a refresh token |
| POST | `/api/v1/auth/logout` | ✅ | Invalidate stored refresh token |
| POST | `/api/v1/services` | ✅ | Create service |
| GET | `/api/v1/services` | ✅ | List services (paginated) |
| GET | `/api/v1/services/:id` | ✅ | Get service by id |
| PATCH | `/api/v1/services/:id` | ✅ | Update service |
| DELETE | `/api/v1/services/:id` | ✅ | Delete service |
| POST | `/api/v1/bookings` | – | Create booking (public) |
| GET | `/api/v1/bookings` | ✅ | List bookings (pagination, `status` filter, `search`) |
| GET | `/api/v1/bookings/:id` | ✅ | Get booking by id |
| PATCH | `/api/v1/bookings/:id/status` | ✅ | Update booking status |
| PATCH | `/api/v1/bookings/:id/cancel` | ✅ | Cancel booking |

Example — create a booking:

```bash
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "John Smith",
    "customerEmail": "john@example.com",
    "customerPhone": "+94771234567",
    "serviceId": "<service-uuid>",
    "bookingDate": "2026-08-15",
    "bookingTime": "14:30",
    "notes": "Please call before arriving"
  }'
```

## Assumptions Made

- **Public booking creation**: per the business rules, `POST /bookings` requires no authentication; all other booking endpoints (list, view, status, cancel) are treated as staff operations and require a JWT.
- **Time zone**: booking date/times are interpreted as **UTC** when validating "not in the past".
- **Duplicate bookings**: a cancelled booking does not block a new booking for the same service/date/time slot; the DB unique constraint plus an application-level check (which excludes cancelled bookings) enforce this.
- **Status transitions**: only the explicitly forbidden transition (CANCELLED → COMPLETED) is blocked on the status endpoint; cancelling is done via the dedicated cancel endpoint, which also rejects cancelling COMPLETED or already-CANCELLED bookings.
- **Service deletion**: services with existing bookings cannot be deleted (FK `ON DELETE RESTRICT`) — the API returns a 400 with a clear message instead of silently removing booking history.
- **Refresh tokens** are stored hashed (bcrypt) and rotated on every refresh; logout invalidates them.

## Future Improvements

- Role-based access control (e.g., admin vs. staff) and per-user ownership of services
- Booking conflict detection based on service duration/time ranges rather than exact slot equality
- E2E tests (Supertest) against a disposable PostgreSQL container
- Rate limiting (`@nestjs/throttler`) on auth and public booking endpoints
- Email notifications on booking confirmation/cancellation
- Soft deletes and audit logging
- CI pipeline (lint, test, build) via GitHub Actions
