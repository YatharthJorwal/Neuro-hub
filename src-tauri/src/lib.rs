mod memory;

use memory::{MemoryStore, MockEmbedder};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Store the DB in the OS's proper app-data folder rather than
            // next to the executable, so it survives updates and works
            // the same in dev and in a packaged build.
            let data_dir = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
            let db_path = data_dir.join("neuro_hub_memory.db");

            let store = MemoryStore::open(
                db_path.to_str().expect("non-utf8 app data path"),
                MockEmbedder { dim: 64 },
            )
            .expect("failed to open memory store");
            app.manage(Mutex::new(store));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            memory::start_session_cmd,
            memory::log_message_cmd,
            memory::recent_messages_cmd,
            memory::remember_fact,
            memory::recall_facts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
