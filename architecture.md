# architecture.md

## Stack
- Shell: Tauri 2 — Rust backend + the OS's native webview, not Electron
  (see decisions.md for why)
- Frontend: React + TypeScript, built with Vite
- Backend: Rust
- Storage: SQLite via `rusqlite` with the `bundled` feature — compiles
  its own SQLite, no system dependency needed

## File map
```
neuro-hub-app/
  src/
    App.tsx            entry component, just renders <BrainScene />
    BrainScene.tsx      renders the HUD/tooltip/gate markup, mounts the
                        scene onto a ref via useEffect, cleans up on unmount
    brain-scene.ts       all Three.js logic: node/edge generation, camera
                        controls, render loop
    brain-scene.css      styles, scoped under .brain-root
  src-tauri/
    src/
      lib.rs             app entry: opens the MemoryStore, puts it in
                        managed state via app_data_dir(), registers the
                        5 commands below
      memory.rs           MemoryStore, the Embedder trait + MockEmbedder,
                        the SQLite schema, the 5 #[tauri::command] fns
      main.rs             untouched Tauri boilerplate, calls lib::run()
```

## Visualization (brain-scene.ts)
Procedurally generates a fake human-brain-styled graph: a fixed list of
named regions (Prefrontal Cortex, Motor Cortex, Hippocampus, Cerebellum,
etc.), nodes scattered per region using a seeded RNG (mulberry32, seed
`0xc0a1` — same graph every run), edges from each node to its 5 nearest
neighbors plus a few random long edges, and small light "pulses" that
random-walk across edges to fake activity. **None of this is real
neuroscience or connectome data** — it's decoration, on purpose for now.
See decisions.md and plans.md for what would change that.

## Memory (memory.rs)
Two tables that matter:
- `messages` — raw conversation log: session_id, role, content, timestamp
- `memories` — distilled facts: category, content, an embedding BLOB,
  an importance score, optional source_message_id

No vector database. Ranking is brute-force cosine similarity computed in
Rust over every row in `memories`. That's a deliberate simplicity choice
for personal-app scale (hundreds to low thousands of rows) — see
decisions.md.

5 Tauri commands, callable from the frontend via `invoke()`:
- `start_session_cmd(title)`
- `log_message_cmd(session_id, role, content)`
- `recent_messages_cmd(session_id, n)`
- `remember_fact(category, content, importance)`
- `recall_facts(query, k)`

The DB file lives in the OS's app-data directory (via Tauri's
`app.path().app_data_dir()`), not next to the executable, so it survives
packaging and app updates.

## Not yet connected
- Nothing in the frontend calls `remember_fact` / `recall_facts` yet.
- No LLM sits between the user and those commands — they're built to be
  called by one, as tool calls, once that layer exists.
