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
Nothing has been built since. Then confirmed the third candidate:
**real connectome data is wanted, not staying decorative** — the
original motivating idea, referencing FlyWire's public connectome
reconstruction (flywire.ai) as the visual/data target: real fly brain,
real neurons, real synapses, not the current procedurally generated
human-brain-styled graph.

That's now 3 for 3 on direction:
1. Real (local) embedder — direction decided, not built
2. Chat layer (local LLM) — direction decided, not built
3. Real connectome data in the visualization — **confirmed wanted**,
   not started, and the least scoped of the three. Open technical
   questions nobody's answered yet:
   - Data source: FlyWire's public exports (via Codex / CAVE) are the
     obvious target, but the full adult fly brain is ~139k neurons and
     tens of millions of synapses — likely too much to ship or render
     at full fidelity. Needs a decision on a subset (a few neuropil
     regions? a cell-type sample?) or an aggressive downsample.
   - `brain-scene.ts` currently expects one node shape (id, region,
     x/y/z, radius, hue/sat/lit) and one edge shape (a, b, length) —
     real data needs a conversion step into that shape, or the shape
     needs to change to carry real IDs/cell types/neuropil names.
   - Rendering the current procedural graph is ~600 nodes. Real data at
     any meaningful scale is one to several orders of magnitude more —
     unverified whether the current InstancedMesh approach holds up on
     the 3060 without changes.

None of the three next-step candidates has been started. Don't assume
one has, or that today's session picked which one goes first — check
what the user says.

## Not started, no decision made yet
- Any frontend UI for chat or for browsing/editing stored memories.
- Packaging/distribution (installer, code signing, auto-update).
- Whether the old `index.html` demo stays in the repo (e.g. under
  `legacy/`) or was fully replaced — unverified, see decisions.md.
