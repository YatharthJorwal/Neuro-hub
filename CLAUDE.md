# CLAUDE.md

Read this first, every session. It's short on purpose — the actual
content lives in its own file. Don't try to hold the whole project in
this one doc.

## What this is
A Tauri (Rust + React/TypeScript) desktop app: a 3D "brain" visualization
with a local memory system, aiming toward an LLM chat layer with tool use.
Working name: Neuro-hub.

## Where to look for what
- **Starting a brand new session/clone** → `new-session-prompt.md` has
  the template to paste in — fill in the bracketed part each time,
  don't reuse it generic.
- **Current state, right now** → `handoff.md`. Read it first. If it looks
  stale or doesn't match what's actually in the repo, say so and update it
  before relying on it — see the staleness note at the top of that file.
- **How the pieces fit together, file map** → `architecture.md`
- **Why something was built the way it was** → `decisions.md` — check
  before re-deciding something already settled (Tauri vs Electron, the
  embedder approach, no vector DB, etc.)
- **What's next, open questions** → `plans.md`

## Workflow
When delivering file changes (code, docs, anything), always give exact
apply commands — extraction/copy with full absolute paths, then the git
add/commit/push — not just a bare zip or a file list with "put these
somewhere." This came from repeated path-confusion friction (zips
landing one folder level off from assumed). Full absolute paths in
every command, not relative ones, and a `dir`/verification step before
anything destructive (`-Force` copies, `git commit`).

## Hard truths — do not contradict these
- This is not an LLM and has no path to becoming one on its own. The 3D
  visualization is a procedurally generated decorative graph — fake
  region labels, seeded RNG — not real neuroscience or connectome data.
- No chat/LLM layer exists yet. The memory commands (`remember_fact`,
  `recall_facts`) are built to be called by one later, as tool calls.
- The embedder in `memory.rs` is a non-semantic placeholder hash.
  `recall_facts` results mean nothing until it's swapped for a real one.
- Stack is decided, don't relitigate without a stated reason: Tauri (not
  Electron), Rust backend, React + TypeScript + Vite frontend, SQLite
  (`rusqlite`, bundled) for storage.
