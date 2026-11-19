# Branson Explorer

Digital ticketing for Branson, MO shows and attractions: the town's ticket marketplace plus a venue platform (box office, branded checkout, scanning, live dashboard).

- Architecture and decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Style guide: [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md)
- Design tokens: [design/tokens.css](design/tokens.css)

## Develop

Requires Node 22 and Postgres 16.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # core tests on in-process Postgres
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/be_test npm test   # adds real-Postgres concurrency tests
```

First run:

```bash
cp .env.example .env.local   # then set SESSION_SECRET
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/branson_explorer
npm run db:migrate
npm run db:seed      # sample venues, shows, attractions and one staff login per role
npm run dev          # staff admin at http://localhost:3000/admin
```

`npm run db:generate` creates a new migration after editing `src/db/schema.ts`.

Development sign-in lets you pick any seeded staff member to see what each role can do. It only works with `ALLOW_DEV_SIGNIN=true` outside production; real staff sign-in replaces it before launch.

## Layout

- `src/core/` framework-free business logic: inventory locking, pricing, permissions, sessions, seat map builder, theming
- `src/db/` Drizzle schema and client; migrations in `drizzle/`
- `src/server/` server-only data access that applies each staff member's permissions
- `src/app/` Next.js site; staff admin under `src/app/admin`
