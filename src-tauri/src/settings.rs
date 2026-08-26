use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn settings_get_auto_launch(app: AppHandle) -> Result<bool, String> {
  app
    .autolaunch()
    .is_enabled()
    .map_err(|e| format!("读取开机启动失败: {e}"))
}

#[tauri::command]
pub fn settings_set_auto_launch(app: AppHandle, payload: bool) -> Result<bool, String> {
  let launcher = app.autolaunch();
  if payload {
    launcher
      .enable()
      .map_err(|e| format!("开启开机启动失败: {e}"))?;
  } else {
    launcher
      .disable()
      .map_err(|e| format!("关闭开机启动失败: {e}"))?;
  }
  Ok(payload)
}
