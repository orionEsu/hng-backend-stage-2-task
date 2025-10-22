# HNG Stage 2 Task

A small Node.js + TypeScript HTTP server that responds to GET /me with a JSON payload and a cat fact fetched from an external API (https://catfact.ninja/fact).

## Project files
- `server.ts` — main server implementation
- `package.json` — scripts and devDependencies

## Prerequisites
- Node.js (v16 or later recommended)
- npm (comes with Node.js)

Note: This project uses TypeScript and runs via the `tsx` runner in development. All required packages are listed as devDependencies in `package.json`.

## Install dependencies
Open a terminal in the project root (on Windows your default shell is `cmd.exe`) and run:

```bash
npm install
```

This installs the following devDependencies declared in `package.json`:

- `typescript` — TypeScript compiler
- `tsx` — fast TypeScript runner for development
- `@types/node` — Node.js type definitions

No additional runtime dependencies are required.

## Run locally

Development (watch & run TypeScript directly):

```bash
npm run dev
```

This uses `tsx watch server.ts` to run the server and reload on file changes.

Build (compile to JavaScript) and run:

```bash
npm run build
npm start
```

`npm run build` runs `tsc` and produces compiled output (commonly in `dist/`); `npm start` runs `node dist/server.js`.

## Server behavior

- Listens by default on hostname `127.0.0.1` and port `3000` (see `server.ts`).
- Route: `GET /me` — returns JSON with `status`, `user` (email, name, stack), `timestamp`, and a `fact` field fetched from `https://catfact.ninja/fact`.
- Other routes return a 404 JSON response.

Example request (from a separate terminal):

```bash
curl http://127.0.0.1:3000/me
```

On Windows `cmd.exe` you can either use the bundled `curl` or open the URL in a browser.

## Troubleshooting
- If `npm run dev` fails with a missing command, ensure `node` and `npm` are installed and available in your PATH.
- If the external cat-fact API is down, the server may return an error or a fallback message — check the server logs for details.

