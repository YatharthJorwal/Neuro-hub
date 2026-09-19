# plans.md

## Done
- Tauri app scaffolded (React + TypeScript + Vite frontend, Rust backend).
- Visualization ported in from the original `index.html`, confirmed
  running (WASD fly-through, click-to-select all work).
- Memory backend (SQLite, 5 Tauri commands) built, compiles clean,
  wired into managed state. Not yet exercised from the frontend.
- Pushed to https://github.com/YatharthJorwal/Neuro-hub.

## Direction decided, not yet built
Two things got settled without being started:
1. **Embedder will be local** (not an API call) — privacy-motivated,
   likely fastembed-rs. See decisions.md. `memory.rs` still has the
   placeholder hash embedder; this hasn't been touched yet.
2. **Chat layer will be a local LLM** (not Claude API) — same reasoning.
   No model picked yet. Flagged in decisions.md: it'll share the 3060's
   12GB VRAM with the embedder and the visualization, worth sizing with
   that in mind rather than assumed away.

## Still open: what to build first, and when
As of this doc, the user paused deliberately — decided the two
directions above, then said "nothing yet, docs are enough for today."
Nothing has been built since. The three candidates from before are
still the three candidates, just with two of them now pointed in a
known direction instead of an open question:
1. Build the real (local) embedder
2. Build the chat layer (local LLM)
3. Wire real connectome/spiking data into the visualization — still not
   confirmed whether this is still wanted, or whether staying decorative
   and putting effort into chat + memory instead is fine

Don't assume which one starts next, or that any building has resumed,
without checking what the user says at the start of the session.

## Not started, no decision made yet
- Any frontend UI for chat or for browsing/editing stored memories.
- Packaging/distribution (installer, code signing, auto-update).
- Whether the old `index.html` demo stays in the repo (e.g. under
  `legacy/`) or was fully replaced — unverified, see decisions.md.
