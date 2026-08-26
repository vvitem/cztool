mod history;
mod http_tools;
mod paths;
mod settings;
mod system_info;
mod unlock;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

#[tauri::command]
fn ping() -> String {
  "pong".into()
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
  window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn maximize_window(window: tauri::Window) -> Result<(), String> {
  let maximized = window.is_maximized().map_err(|e| e.to_string())?;
  if maximized {
    window.unmaximize().map_err(|e| e.to_string())
  } else {
    window.maximize().map_err(|e| e.to_string())
  }
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
  window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn desktop_runtime() -> String {
  "tauri".into()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.set_focus();
        let _ = win.show();
      }
    }))
    .plugin(tauri_plugin_autostart::init(
      MacosLauncher::LaunchAgent,
      Some(vec![]),
    ))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let db = history::init_db(app.handle())?;
      app.manage(db);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ping,
      minimize_window,
      maximize_window,
      close_window,
      desktop_runtime,
      unlock::unlock_get_device_id,
      unlock::unlock_get_status,
      unlock::unlock_verify,
      unlock::unlock_clear,
      unlock::unlock_open_external,
      history::history_add,
      history::history_list,
      history::history_clear,
      history::history_clear_all,
      system_info::system_machine_info,
      http_tools::douyin_parse,
      http_tools::fetch_qq_nickname,
      http_tools::update_get_version,
      http_tools::update_get_settings,
      http_tools::update_set_auto_check,
      http_tools::update_check,
      http_tools::update_quit_and_install,
      settings::settings_get_auto_launch,
      settings::settings_set_auto_launch,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
