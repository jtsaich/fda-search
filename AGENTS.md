# Repository Guidelines

## Project Structure & Module Organization
- The repository is a monorepo managed from the root `package.json`; run shared scripts from the project root.
- `backend/` contains the FastAPI service (`main.py` entrypoint, `services/` for RAG components, `utils/` helpers, `uploads/` for stored documents).
- `frontend/` is the Next.js app using the App Router (`app/` routes, `components/` UI primitives, `lib/` data access, `utils/` shared helpers, `public/` static assets).
- `docs/` stores design notes, and `sample_docs/` offers fixtures for local ingestion tests; avoid committing sensitive files to `uploads/`.

## Project Context
- FDA Search is a chatbot for FDA, pharma R&D, drug research, pharmaceutical studies, and government research documents. Admins can configure persona prompts and Pinecone-backed RAG.
- Current chat flow is single-shot RAG in `backend/main.py`: last user message -> embedding -> Pinecone top-k -> context appended to the LLM prompt -> AI SDK data stream. Frontend chat messages persist in Supabase as full AI SDK `UIMessage` JSON, so future agent traces can be stored as message data parts.
- Planned agent feature: add a backend agent loop for questions that require database search. Prefer a small orchestrator behind `/api/chat` over a new framework: classify request -> choose Pinecone/SQL/hybrid tool -> run curated query -> evaluate answer -> stream final response.
- Local STARLIMS testing foundation is SQL Server on localhost port 1433, database `STARLIMS_DATA`. Main immediate tables are `dbo.ORDTASK` and `dbo.AUDITTRL`. Do not commit DB credentials; use env vars or local secrets.
- Hosting context: backend runs on Railway, frontend runs on Vercel. The new production SQL Server database should be hosted inside the Railway service/environment so the backend can query it with private/internal networking where available.
- Client validation files previously reviewed: `Aves AI Hub testing - LIMS 20260624.xlsx` and `STARLIMS masterdata - AUDITTRL` test PDF. The XLSX defines LIMS L1-L5 scoring; the PDF narrows the current POC to STARLIMS task execution/data-quality questions, not full batch release.
- Verified May 2026 STARLIMS facts from the local DB: 161 distinct May-handled ORDTASK records via `AUDITTRL`, 159 still present, 2 deleted; events are 125 creates, 208 edits across 81 tasks, and 2 deletes; current status distribution is Prelogged 84, Logged 50, Done 14, OOS 6, Cancelled 5.
- Important data boundary: for the 159 existing May-handled tasks, `ANALYZEDDATE`, `DONE_TESTING_DT`, and usable `TMNAME` were missing for all rows, and `TEST_TYPE` was missing for 158 rows. Answers must not infer TAT, method-version correctness, instrument root cause, QMS root cause, or batch-release eligibility from this data alone.
- STARLIMS DB answers should distinguish facts, observations, inferences, recommendations, and cannot-determine items. Use fixed SQL templates for the MVP instead of executing arbitrary generated SQL.
- Development process for this feature should use a generator/evaluator split: the generator implements the SQL-agent feature, then an evaluator runs the app locally and verifies it with `npm run eval:starlims-agent`. Use `-- --allow-missing-sql` only for non-DB smoke checks; real feature verification should connect to SQL Server and validate `/health/starlims`.

## Build, Test, and Development Commands
- `npm run install:all` installs both front- and back-end dependencies; run it after cloning or when packages change.
- `npm run dev` starts FastAPI and Next.js together via `concurrently`; visit http://localhost:3000 for the UI and http://localhost:8000/docs for API docs.
- `npm run dev:backend` (FastAPI with live reload) and `npm run dev:frontend` (Next.js with Turbopack) let you focus on one side at a time.
- `npm run build:frontend` produces an optimized Next.js build; always pair it with a successful `npm run lint:frontend` before opening a PR.
- `npm run eval:starlims-agent` runs the local evaluator for the STARLIMS SQL-agent feature: contract/evaluator checks, backend startup, and `/health/starlims` verification.
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
