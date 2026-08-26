use tauri::Window;

#[tauri::command]
fn ping() -> String {
  "pong".into()
}

#[tauri::command]
fn minimize_window(window: Window) -> Result<(), String> {
  window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn maximize_window(window: Window) -> Result<(), String> {
  let maximized = window.is_maximized().map_err(|e| e.to_string())?;
  if maximized {
    window.unmaximize().map_err(|e| e.to_string())
  } else {
    window.maximize().map_err(|e| e.to_string())
  }
}

#[tauri::command]
fn close_window(window: Window) -> Result<(), String> {
  window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn desktop_runtime() -> String {
  "tauri".into()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ping,
      minimize_window,
      maximize_window,
      close_window,
      desktop_runtime,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
