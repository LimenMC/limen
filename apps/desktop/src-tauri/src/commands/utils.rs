#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn get_system_memory() -> Result<u64, crate::AppError> {
    use sysinfo::System;
    
    let mut sys = System::new_all();
    sys.refresh_memory();
    
    // Return total memory in MB
    let total_memory_mb = sys.total_memory() / 1024 / 1024;
    
    Ok(total_memory_mb)
}
