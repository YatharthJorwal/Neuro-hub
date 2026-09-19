// Ported from neuro-hub-memory/src/main.rs. Same store, same logic;
// the demo fn main() is gone and five #[tauri::command] wrappers were
// added so the frontend can call this over Tauri's IPC.
use rusqlite::{params, Connection, Result as SqlResult};
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

// ---------------------------------------------------------------------
// Embedder: swap MockEmbedder for a real one before shipping.
//   - Local + private: fastembed-rs with BGE-small-en-v1.5 (~130MB, CPU is
//     plenty fast for occasional writes; downloads the model on first run).
//   - Simplest: call an API embeddings endpoint and cache results.
// The rest of the store doesn't care which one you use.
// ---------------------------------------------------------------------
pub trait Embedder: Send {
    fn dim(&self) -> usize;
    fn embed(&self, text: &str) -> Vec<f32>;
}

pub struct MockEmbedder {
    pub dim: usize,
}

impl Embedder for MockEmbedder {
    fn dim(&self) -> usize {
        self.dim
    }
    // Deterministic bag-of-bytes hash, NOT semantic. Proves the
    // storage/ranking pipeline end to end; replace before real use.
    fn embed(&self, text: &str) -> Vec<f32> {
        let mut v = vec![0f32; self.dim];
        for (i, byte) in text.bytes().enumerate() {
            v[i % self.dim] += byte as f32 / 255.0;
        }
        let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt().max(1e-6);
        v.iter_mut().for_each(|x| *x /= norm);
        v
    }
}

fn vec_to_blob(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|f| f.to_le_bytes()).collect()
}

fn blob_to_vec(b: &[u8]) -> Vec<f32> {
    b.chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

fn cosine(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let na = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let nb = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if na < 1e-9 || nb < 1e-9 {
        0.0
    } else {
        dot / (na * nb)
    }
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  role       TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
CREATE TABLE IF NOT EXISTS memories (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  category           TEXT NOT NULL,
  content            TEXT NOT NULL,
  embedding          BLOB NOT NULL,
  importance         REAL NOT NULL DEFAULT 0.5,
  source_message_id  INTEGER REFERENCES messages(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
"#;

#[derive(Serialize)]
pub struct MemoryHit {
    pub category: String,
    pub content: String,
    pub score: f32,
}

#[derive(Serialize)]
pub struct MessageRow {
    pub role: String,
    pub content: String,
}

pub struct MemoryStore<E: Embedder> {
    conn: Connection,
    embedder: E,
}

impl<E: Embedder> MemoryStore<E> {
    pub fn open(path: &str, embedder: E) -> SqlResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn, embedder })
    }

    pub fn start_session(&self, title: &str) -> SqlResult<i64> {
        self.conn
            .execute("INSERT INTO sessions (title) VALUES (?1)", params![title])?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn log_message(&self, session_id: i64, role: &str, content: &str) -> SqlResult<i64> {
        self.conn.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?1, ?2, ?3)",
            params![session_id, role, content],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn recent_messages(&self, session_id: i64, n: i64) -> SqlResult<Vec<MessageRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT role, content FROM messages WHERE session_id = ?1 ORDER BY id DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![session_id, n], |r| {
            Ok(MessageRow { role: r.get(0)?, content: r.get(1)? })
        })?;
        let mut out: Vec<MessageRow> = rows.collect::<SqlResult<_>>()?;
        out.reverse();
        Ok(out)
    }

    /// Wrapped by the "remember_fact" command: the model decides
    /// something the user said is worth keeping long-term.
    pub fn remember(
        &self,
        category: &str,
        content: &str,
        importance: f32,
        source_message_id: Option<i64>,
    ) -> SqlResult<i64> {
        let embedding = vec_to_blob(&self.embedder.embed(content));
        self.conn.execute(
            "INSERT INTO memories (category, content, embedding, importance, source_message_id)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![category, content, embedding, importance, source_message_id],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Wrapped by the "recall_facts" command: semantic search over
    /// everything remembered so far, ranked by similarity with a small
    /// importance nudge.
    pub fn recall(&self, query: &str, k: usize) -> SqlResult<Vec<MemoryHit>> {
        let q = self.embedder.embed(query);
        let mut stmt = self
            .conn
            .prepare("SELECT category, content, embedding, importance FROM memories")?;
        let rows = stmt.query_map([], |r| {
            let category: String = r.get(0)?;
            let content: String = r.get(1)?;
            let blob: Vec<u8> = r.get(2)?;
            let importance: f32 = r.get(3)?;
            Ok((category, content, blob, importance))
        })?;

        let mut scored = Vec::new();
        for row in rows {
            let (category, content, blob, importance) = row?;
            let score = cosine(&q, &blob_to_vec(&blob)) + importance * 0.1;
            scored.push(MemoryHit { category, content, score });
        }
        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        scored.truncate(k);
        Ok(scored)
    }
}

// The app manages one MemoryStore<MockEmbedder> behind a Mutex (see lib.rs).
type Store = Mutex<MemoryStore<MockEmbedder>>;

#[tauri::command]
pub fn start_session_cmd(state: State<Store>, title: String) -> Result<i64, String> {
    state.lock().unwrap().start_session(&title).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn log_message_cmd(
    state: State<Store>,
    session_id: i64,
    role: String,
    content: String,
) -> Result<i64, String> {
    state
        .lock()
        .unwrap()
        .log_message(session_id, &role, &content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn recent_messages_cmd(
    state: State<Store>,
    session_id: i64,
    n: i64,
) -> Result<Vec<MessageRow>, String> {
    state
        .lock()
        .unwrap()
        .recent_messages(session_id, n)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remember_fact(
    state: State<Store>,
    category: String,
    content: String,
    importance: f32,
) -> Result<i64, String> {
    state
        .lock()
        .unwrap()
        .remember(&category, &content, importance, None)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn recall_facts(state: State<Store>, query: String, k: usize) -> Result<Vec<MemoryHit>, String> {
    state.lock().unwrap().recall(&query, k).map_err(|e| e.to_string())
}
