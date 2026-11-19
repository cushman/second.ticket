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

Database:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/branson_explorer
npm run db:generate  # after editing src/db/schema.ts
npm run db:migrate
```

## Layout

- `src/core/` framework-free business logic: inventory locking, pricing, theming
- `src/db/` Drizzle schema and client; migrations in `drizzle/`
- `src/app/` Next.js site
