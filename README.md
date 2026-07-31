# StudyMonk

A production-oriented **CBSE offline-study platform**. A Super Admin builds the
academic catalog (Board → Class → Subject → Chapter → NCERT study material);
students register against a board + class, read their content, and form
**combined study groups** with classmates from the same school, class and
academic year — a Teams-style space with a shared discussion feed.

Everything is data-driven: **no content or catalog is hardcoded** — it all comes
from PostgreSQL and Cloudflare R2.

- **Framework:** Next.js 14 (App Router) — UI and API in one project
- **Database:** PostgreSQL via Prisma
- **File storage:** Cloudflare R2 (S3-compatible), files uploaded/downloaded
  directly browser ⇄ R2 via presigned URLs (bytes never touch the app server)
- **Auth:** bcrypt passwords, JWT access tokens, rotating DB-backed refresh
  sessions

---

## Two-level API security

Every protected API request must clear **two independent levels**:

| Level | What it proves | Native / offline / API clients | First-party web browser |
|------|----------------|-------------------------------|--------------------------|
| **1 — Gateway** | request comes from a trusted client | `x-api-key: <API_GATEWAY_KEY>` header | secure `httpOnly` session cookie (no secret in JS) |
| **2 — Identity** | a valid, active, authorized user | `Authorization: Bearer <jwt>` | same `httpOnly` cookie |

- Enforced **per-route** by `guard()` (`src/lib/auth.ts`) **and** as
  defense-in-depth by `src/middleware.ts`. Because every route re-checks auth
  itself, the app does not rely on middleware alone.
- Access tokens are short-lived (default 15 min); refresh tokens are opaque,
  stored only as SHA-256 hashes, and **rotated** on every use.
- Passwords are bcrypt (cost 12). Role checks (`SUPER_ADMIN` / `STUDENT`) gate
  every endpoint. Students can only ever reach content for **their own class**,
  and groups for **their own school + class + academic year** — access is always
  derived from the DB profile, never from client input.

Public bootstrap routes (no gateway key needed, so a fresh browser works):
`/api/health`, `/api/auth/{login,register,refresh,logout}`, `/api/catalog/*`.
Put a WAF / Cloudflare rate-limit in front of these in production.

---

## 1. Prerequisites

- Node.js 20+
- A PostgreSQL database
- A Cloudflare R2 bucket + API token (Account ID, Access Key ID, Secret)

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`. Generate strong secrets:

```bash
openssl rand -base64 48   # use for JWT_ACCESS_SECRET
openssl rand -base64 48   # use for JWT_REFRESH_SECRET (must differ)
openssl rand -hex 32      # use for API_GATEWAY_KEY
```

Add the **R2 keys you already have** to these fields in `.env`:

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=studymonk-content
R2_ENDPOINT=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
```

## 3. Install & migrate the database

```bash
npm install
npm run db:migrate      # applies prisma/migrations to your Postgres
```

## 4. Create the Super Admin (directly in the database)

There is **no hardcoded admin**. Create one yourself — two options:

### Option A — pure SQL (add the credential directly in the DB)

First generate a bcrypt hash for your chosen password:

```bash
npm run hash -- 'YourStrongPassword!'
```

Then run this against your database (replace the email, name and the hash):

```sql
INSERT INTO "User" (id, email, "passwordHash", "fullName", role, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@yourdomain.com',
  '<paste-the-bcrypt-hash-here>',
  'Super Admin',
  'SUPER_ADMIN',
  true,
  now(),
  now()
);
```

### Option B — helper script (nothing hardcoded; reads CLI args)

```bash
npm run create:superadmin -- --email admin@yourdomain.com --name "Super Admin" --password 'YourStrongPassword!'
```

Log in at `/login` with those credentials — you will land on the **/admin**
panel and can start creating Boards, Classes, Subjects, Chapters and uploading
materials. Students self-register at `/register`.

## 5. Configure R2 CORS (required for browser uploads/downloads)

Because the browser uploads and downloads files directly to/from R2 via
presigned URLs, add a CORS policy to the bucket (Cloudflare dashboard → R2 →
your bucket → Settings → CORS policy):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

## 6. Run

```bash
npm run dev             # http://localhost:3000
# production
npm run build && npm start
```

---

## API overview

All routes return `{ success, data }` or `{ success, error }`.

**Auth (public bootstrap):** `POST /api/auth/register`, `POST /api/auth/login`,
`POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.

**Catalog (public, for registration):** `GET /api/catalog/boards`,
`GET /api/catalog/classes?boardId=`.

**Admin (SUPER_ADMIN, both levels):** CRUD under `/api/admin/boards`,
`/api/admin/classes`, `/api/admin/subjects`, `/api/admin/chapters`,
`/api/admin/materials`; `POST /api/admin/upload-url` (presigned R2 PUT).

**Content (STUDENT, both levels, scoped to own class):**
`GET /api/content/subjects`, `GET /api/content/chapters?subjectId=`,
`GET /api/content/materials?chapterId=`,
`GET /api/content/materials/:id/download` (presigned R2 GET).

**Groups (STUDENT, both levels, scoped to school+class+year):**
`GET|POST /api/groups`, `GET /api/groups/:id`,
`POST /api/groups/:id/{join,leave,posts}`.

### Calling the API as a native / offline client

```
x-api-key: <API_GATEWAY_KEY>
Authorization: Bearer <accessToken from /api/auth/login response body>
```

## Data model

`User` (with student profile fields) · `Session` · `Board` · `Class` ·
`Subject` · `Chapter` · `StudyMaterial` (R2 object key) · `StudyGroup` ·
`GroupMember` · `GroupPost`. See `prisma/schema.prisma`.

## Security notes

- Set `NODE_ENV=production` in production so cookies are `Secure`.
- Rotate `API_GATEWAY_KEY` and JWT secrets periodically.
- `npm audit` shows a couple of residual advisories that are **build-time only**
  and do not apply to this app's configuration: Next's Image Optimizer
  `remotePatterns` DoS (we don't use `next/image` remote patterns) and a
  `postcss` advisory coming from Next's internal pinned build copy. Runtime
  `postcss` is already on a patched version. We track the latest patched
  Next.js 14.2.x, which includes the fix for the middleware auth-bypass CVE.
