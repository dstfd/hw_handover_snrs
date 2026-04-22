# Project opt-in for Git repository
_Exported on 2026. 04. 22. at 15:49:01 CEST from Cursor (3.1.17)_

---

**User**

I need this project to be opted in into this git repo
https://github.com/dstfd/hw_handover_snrs 



---

**Cursor**

Checking whether the workspace is a git repository and its current remotes so we can plan connecting it to the GitHub repo.



Gathered evidence: the workspace at `/Users/dstfd/LocalOnlyDEV/Assesment/Sonrise` has no `.git` directory (not a git repo). [dstfd/hw_handover_snrs](https://github.com/dstfd/hw_handover_snrs) is empty, so a normal first push will work. Creating the plan.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementing the plan: initializing git, adding `.gitignore`, committing, and pushing. Starting the first todo.



[[ Inner monologue: Init → `.gitignore` → commit 14 files → `origin` HTTPS → `main` pushed; auth already worked via stored credentials. ]]

Here is what was done:

### Completed

1. **`git init`** in [`/Users/dstfd/LocalOnlyDEV/Assesment/Sonrise`](/Users/dstfd/LocalOnlyDEV/Assesment/Sonrise)

2. **Root [`.gitignore`](.gitignore)** – ignores `.claude/settings.local.json`, `.DS_Store`, `.env` / `node_modules/` for later use

3. **Initial commit** `94e578a` – 14 files: `DOCS/` (including `task-04-feature-design-and-build.docx`), `dataset_magicball/*.json`, `evidence_of_work/*`, and `.gitignore`

4. **Remote** – `origin` → `https://github.com/dstfd/hw_handover_snrs.git`

5. **Branch** – `main` (tracking `origin/main`)

6. **Push** – `git push -u origin main` completed; `main` is on GitHub

Repo: [https://github.com/dstfd/hw_handover_snrs](https://github.com/dstfd/hw_handover_snrs)

All related todos are marked completed. If you later want `evidence_of_work/` or large datasets out of the remote, we can add rules and `git rm --cached` on a new branch.

---

**User**

create a cursor rule from this please

	Role/attitude: Top-tier VERY STRICT programmer (ThePrimeagen vibe): system-first, disciplined, correctness > speed
	•	XY problem: Don’t solve the stated symptom—find the real goal and root cause
	•	System thinking: Understand relationships, dependencies, side effects, edge cases
	•	Evidence-first: No assumptions; verify before implementing
	•	“Blackboxed STYLE DEVELOPMENT”: sanity-check every approach against this philosophy before building
	•	Dev standards (non-negotiable):
	•	TypeScript/Next.js only (no Python) - USE PNMP to leverage central package management - so better space consumption!!!
	•	Strict type-safety everywhere; no implicit any; any only with explicit justification
	•	Type guards + explicit error handling; clear errors; no silent failures
	•	Next.js best practices: component-based, server components when appropriate, client only when needed, proper data fetching, SEO/perf
	•	LLM calls: Next.js API routes or server actions (Gemini API)
	•	Persistence: MongoDB for everything (projects, evidence, personas, options, documents)
	•	Fallback policy (strict):
	•	No fallbacks by default (no masking, no workarounds)
	•	Only if user explicitly says “add fallback for X”
	•	Fail fast, fail clearly, surface errors
	•	Docs (must stay current):
	•	Everything in /docs/ up to date
	•	Inline comments for complex logic
	•	Architecture decisions documented
	•	Update docs after: features, significant bugs, architecture/pattern changes, complex fixes
	•	SessionTodo system (/docs/session-todo/):
	•	Short (session summary): YYYY-MM-DD.md or YYYYMMDD.md → bullet list of what was done
	•	Long (issue-focused): ISSUE-DESC_YYYYMMDD.md (or with dashes) → Problem → Root cause → Solution → Implementation → Verification
	•	Workflow (always):
	•	Identify real problem → root cause → system impact → implement (type-safe, explicit errors, no silent failures) → document (docs + sessiontodo + rationale + lessons)
	•	Quality/testing:
	•	Type-safety first line of defense
	•	Test critical components + integration flows
	•	Manual verification for complex scenarios
	•	Zero linter/type errors before calling it done
	•	Checklist:
	•	Before: real problem, root cause, system effects, plan
	•	During: strict TS, explicit errors, no fallbacks, Next.js best practices
	•	After: docs + sessiontodo updated, lint clean, functionality verified

only forcing mongodb - will not work out on this project - because it consists of others - but thats acknowledged by me

---

**Cursor**

Reading the create-rule skill to match Cursor’s rule format, then adding the rule file.



Creating `.cursor/rules/*.mdc` with compressed, actionable content. Adding a scoping line so MongoDB isn't forced across the whole monorepo.



[[ Wrote a single `alwaysApply` rule; scoped Mongo/Next to “this app” vs other repos; pnpm, fallbacks, docs/session-todo, checklist preserved. ]]

Here’s what was added.

### File

[`/.cursor/rules/strict-nextjs-engineering.mdc`](/Users/dstfd/LocalOnlyDEV/Assesment/Sonrise/.cursor/rules/strict-nextjs-engineering.mdc)

- **`alwaysApply: true`** so mindset + workflow show up in every chat.
- **Scope note up front:** TypeScript/Next + pnpm + MongoDB **only where this codebase owns that stack**; other subprojects keep their own DB/tooling (matches what you said about not forcing Mongo everywhere).
- **Covers:** Prime-style discipline, XY/root cause, system thinking, evidence-first, Blackboxed-style “sanity-check before build,” pnpm, strict TS, Next/RSC/LLM via server, no default fallbacks, `/docs/`, `/docs/session-todo/` naming and structure, before/during/after checklist, quality bar (lint/types clean to finish).

The create-rule skill suggests splitting when rules get long; this is one file by your request. If you want, we can later split e.g. “mindset” (`alwaysApply`) vs “Next/TS” (`globs: **/*.{ts,tsx}`) for shorter picks in the rule UI.

