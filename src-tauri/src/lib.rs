mod commands;
mod error;
mod models;

use commands::config::load_claude_config;
use commands::files::{read_claude_md, read_skill, scan_workspace, write_claude_md, write_skill};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Logging plugin: routes `log::{info,debug,warn,error}` calls to the
        // dev terminal AND the webview DevTools console. Our crate is bumped
        // to Debug so per-file traces show by default; everything else stays
        // at Info to keep noise from third-party crates down.
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .level_for("skillful_claude_lib", log::LevelFilter::Debug)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .build(),
        )
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
            load_claude_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
