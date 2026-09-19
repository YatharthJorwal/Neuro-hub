# handoff.md

> **This is a snapshot for the start of a session, not a living log.**
> It reflects the state as of the date below. If what you find in the
> repo doesn't match this file, the repo is the truth — update this file
> to match before relying on it further, and note the new date. A stale
> handoff is worse than no handoff.

Last updated: 2026-09-19, right after the first working build got pushed.

## Where things physically are
- Repo: https://github.com/YatharthJorwal/Neuro-hub — just force-pushed
  with the full `neuro-hub-app` project, replacing the old single-file
  `index.html` demo that used to be the whole repo.
  **Unverified:** whether the old `index.html` was preserved somewhere
  (e.g. `legacy/`) or fully overwritten. Check before assuming either way.
- Local machine: Windows, project lives at
  `C:\Users\User\Downloads\Fly\neuro-hub-app`.
- Sibling folders still sitting locally but NOT part of the app:
  `Fly\neuro-hub-memory` (an earlier standalone practice crate — its
  logic was already ported into the real app, this copy is superseded)
  and `Fly\Project Neuro` (a Grok App Builder–generated version of the
  same visualization — explicitly not used as a base, see decisions.md).

## Confirmed working right now
- `cargo check` passes in `src-tauri` on the user's real machine (Tauri
  2.11.5, rusqlite 0.31.0 bundled, compiled clean).
- `npm run tauri dev` opens a window showing the visualization: a
  procedurally generated node graph (590 neurons / 1956 synapses in the
  confirmed run), WASD fly-through, click-to-select — all working.
- The memory backend (SQLite via rusqlite; `sessions` / `messages` /
  `memories` tables; 5 Tauri commands) compiles and is wired into the
  app's managed state.

## Not yet true, don't assume otherwise
- Nothing in the frontend calls `remember_fact` or `recall_facts` yet —
  the memory system is wired in but not exercised from the UI.
- No real (semantic) embedder — still the placeholder hash.
- No LLM/chat layer of any kind.
- Visualization is still procedural/decorative, not driven by real
  connectome or simulation data.

## Hardware this runs on
i5 14400f, RTX 3060 12GB, 32GB (16GB x2) DDR5 4000MT/s. Relevant for any
future decision about running a local embedding model or a local LLM.

## What's next
Check `plans.md` under "Next up" — three candidates were on the table
and not yet decided as of this snapshot. Don't assume which one without
checking there (and checking what the user actually says at the start
of the new session — they may have already decided).
