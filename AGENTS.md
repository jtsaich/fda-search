# Repository Guidelines

## Project Structure & Module Organization
- The repository is a monorepo managed from the root `package.json`; run shared scripts from the project root.
- `backend/` contains the FastAPI service (`main.py` entrypoint, `services/` for RAG components, `utils/` helpers, `uploads/` for stored documents).
- `frontend/` is the Next.js app using the App Router (`app/` routes, `components/` UI primitives, `lib/` data access, `utils/` shared helpers, `public/` static assets).
- `docs/` stores design notes, and `sample_docs/` offers fixtures for local ingestion tests; avoid committing sensitive files to `uploads/`.

## Build, Test, and Development Commands
- `npm run install:all` installs both front- and back-end dependencies; run it after cloning or when packages change.
- `npm run dev` starts FastAPI and Next.js together via `concurrently`; visit http://localhost:3000 for the UI and http://localhost:8000/docs for API docs.
- `npm run dev:backend` (FastAPI with live reload) and `npm run dev:frontend` (Next.js with Turbopack) let you focus on one side at a time.
- `npm run build:frontend` produces an optimized Next.js build; always pair it with a successful `npm run lint:frontend` before opening a PR.
- Activate the Python venv with `source backend/venv/bin/activate` and run `python backend/main.py` for quick smoke tests without the root script.

## Coding Style & Naming Conventions
- Frontend code follows Next.js conventions: TypeScript, ES2022 modules, 2-space indentation, PascalCase components in `components/`, and camelCase utilities. Keep Tailwind classes co-located with JSX. Run `npm run lint:frontend` before committing.
- Backend code should stay PEP 8 compliant: 4-space indentation, descriptive snake_case names, and type hints where practical. Reuse service objects from `services/` instead of instantiating clients inline.
- Centralize configuration in `.env`; never log secrets and prefer the existing `logging` setup in `main.py` for observability.

## Testing Guidelines
- Automated tests are not yet configured; when adding them, place FastAPI tests under `backend/tests/` (pytest + `TestClient`) and React tests under `frontend/__tests__/` (Vitest or Testing Library) and wire new scripts into the respective `package.json`.
- For now, exercise new endpoints with `curl http://localhost:8000/api/...` or the interactive Swagger UI, and validate UI flows against sample documents in `sample_docs/`.
- Record any manual test steps in the PR description until automated coverage lands; flag regressions with TODOs so they can be converted into tests promptly.

## Commit & Pull Request Guidelines
- Follow the prevailing Conventional Commit style (`feat:`, `fix:`, `chore:`); keep subject lines under 72 characters and focus each commit on one logical change set.
- PRs should link to tracking issues when available, describe functional changes, list manual/automated verification results, and include screenshots or API transcripts for UI-facing work.
- Run `npm run lint:frontend` and a backend smoke test before requesting review; note any skipped checks explicitly. Keep PRs small and cross-reference related docs in `docs/` when the change alters behavior.

## Security & Configuration Tips
- Duplicate `.env.example` to `.env` (root, backend, and frontend if needed) and store API keys for OpenRouter, Hugging Face, and Pinecone securely.
- Do not commit `.env`, `uploads/` contents, or generated artifacts; add new secrets to `.gitignore` as necessary and rotate leaked credentials immediately.
