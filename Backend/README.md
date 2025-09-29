/*=======
DevOps Control Center - Backend
==========*/

This folder contains the Express API for project uploads/versioning.

/*=======
Environment
==========*/

1. Copy `.env.example` to `.env` and fill values.
2. The backend uses these vars: DB_HOST, DB_NAME, DB_USER, DB_PASS, PORT

/*=======
Lint & formatting
==========*/

Install dev dependencies (eslint, prettier, nodemon):

pnpm install --filter Backend --workspace --prod=false

Run lint and format:

pnpm --filter Backend run lint
pnpm --filter Backend run format

/*=======
Run (development)
==========*/

Install dependencies:

pnpm install    # or npm install

Run in dev (nodemon):

pnpm run dev

Start (production):

pnpm run start

/*=======
Notes
==========*/

- Temporary uploads are stored under `Backend/var/tmp` (ignored by git).
- Routes are under `Backend/src/routes`. Auth is in `auth.js`.
