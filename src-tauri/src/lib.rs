mod commands;
mod error;
mod models;

use commands::files::{read_claude_md, read_skill, scan_workspace, write_claude_md, write_skill};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            scan_workspace,
            read_claude_md,
            write_claude_md,
            read_skill,
            write_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
