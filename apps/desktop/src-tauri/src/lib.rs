mod error;
mod models;
mod api;
mod commands;
mod minecraft;
mod auth;
mod discord;

pub use commands::*;

pub use error::AppError;
pub use models::*;

pub fn run() {
    use tauri::Manager;
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let auth_state = commands::AuthState::new();
            app.manage(auth_state);
            app.manage(minecraft::ProcessTracker::new());
            
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::search_mods,
            commands::get_mod_details,
            commands::get_mod_versions,
            commands::download_mod,
            commands::get_minecraft_versions,
            commands::download_minecraft_version,
            commands::launch_minecraft,
            commands::get_limen_config,
            commands::get_app_version,
            commands::get_microsoft_login_url,
            commands::open_microsoft_login,
            commands::authenticate_microsoft,
            commands::refresh_microsoft_token,
            commands::get_current_profile,
            commands::check_and_refresh_token,
            commands::logout,
            commands::get_fabric_versions,
            commands::get_fabric_versions_for_game,
            commands::get_quilt_versions,
            commands::get_quilt_versions_for_game,
            commands::get_forge_versions,
            commands::get_neoforge_versions,
            commands::install_fabric_loader,
            commands::install_quilt_loader,
            commands::install_forge_loader,
            commands::install_neoforge_loader,
            commands::launch_with_loader,
            commands::get_current_session,
            commands::is_game_playing,
            commands::get_play_duration,
            commands::end_game_session,
            commands::enable_discord_rpc,
            commands::disable_discord_rpc,
            commands::update_discord_activity,
            commands::archive_profile,
            commands::export_profile_mrpack,
            commands::get_archived_profiles,
            commands::restore_profile,
            commands::delete_archived_profile,
            commands::install_modpack,
            commands::scan_profile_mods,
            commands::get_java_installations,
            commands::set_custom_java_path,
            commands::reset_java_path,
            commands::fetch_skin_texture,
            commands::detect_skin_model,
            commands::upload_skin,
            commands::upload_skin_from_file,
            commands::get_current_skin_url,
            commands::read_local_skin_file,
            commands::get_app_settings,
            commands::save_app_settings,
            commands::get_minecraft_profiles,
            commands::save_minecraft_profiles,
            commands::get_custom_skins,
            commands::save_custom_skins,
            commands::get_profile_mods,
            commands::save_profile_mods,
            commands::remove_mod,
            commands::scan_installed_mods,
            commands::get_system_memory,
            commands::get_java_memory,
            commands::save_java_memory,
            commands::check_for_updates,
            commands::download_update,
        ])
        .run(tauri::generate_context!())
        .expect("Limen failed to start");
}
