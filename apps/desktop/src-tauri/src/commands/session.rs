use crate::AppError;

#[tauri::command]
pub async fn get_current_session(
    state: tauri::State<'_, crate::minecraft::ProcessTracker>,
) -> Result<Option<crate::minecraft::process_tracker::GameSessionInfo>, AppError> {
    Ok(state.get_current_session())
}

#[tauri::command]
pub async fn is_game_playing(
    state: tauri::State<'_, crate::minecraft::ProcessTracker>,
) -> Result<bool, AppError> {
    Ok(state.is_playing())
}

#[tauri::command]
pub async fn get_play_duration(
    state: tauri::State<'_, crate::minecraft::ProcessTracker>,
) -> Result<Option<u64>, AppError> {
    Ok(state.get_play_duration())
}

#[tauri::command]
pub async fn end_game_session(
    state: tauri::State<'_, crate::minecraft::ProcessTracker>,
) -> Result<(), AppError> {
    state.end_session();
    Ok(())
}

#[tauri::command]
pub async fn enable_discord_rpc(
    state: tauri::State<'_, crate::minecraft::ProcessTracker>,
) -> Result<(), AppError> {
    state.enable_discord_rpc();
    Ok(())
}

#[tauri::command]
pub async fn disable_discord_rpc(
    state: tauri::State<'_, crate::minecraft::ProcessTracker>,
) -> Result<(), AppError> {
    state.disable_discord_rpc();
    Ok(())
}

#[tauri::command]
pub async fn update_discord_activity(
    state: tauri::State<'_, crate::minecraft::ProcessTracker>,
    activity_type: String,
    details: Option<String>,
) -> Result<(), AppError> {
    state.update_activity(&activity_type, details.as_deref());
    Ok(())
}
