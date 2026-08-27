use std::path::PathBuf;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

fn http_client(secs: u64) -> Result<reqwest::Client, String> {
  reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(secs))
    .build()
    .map_err(|e| e.to_string())
}

fn cztool_ua(app: &AppHandle) -> String {
  format!("CZTool/{}", app.package_info().version)
}

#[tauri::command]
pub async fn douyin_parse(payload: String) -> Result<Value, String> {
  let client = http_client(35)?;

  let response = client
    .post("https://dd.oihome.dpdns.org/api/parse")
    .header("accept", "*/*")
    .header("content-type", "application/json")
    .header("x-grey-version", "YBQ")
    .header("Referer", "https://dd.oihome.dpdns.org/")
    .json(&json!({
      "url": payload,
      "mobile": false,
      "timeout": 30,
    }))
    .send()
    .await
    .map_err(|e| e.to_string())?;

  if !response.status().is_success() {
    return Err(format!("HTTP {}", response.status().as_u16()));
  }

  response.json().await.map_err(|e| e.to_string())
}

/// QQ 手机号检索（原前端直连；Tauri WebView 跨域会报 Load failed，改走 Rust）
#[tauri::command]
pub async fn qq_search(payload: String) -> Result<Value, String> {
  let qq = payload.trim().to_string();
  if qq.is_empty() || !qq.chars().all(|c| c.is_ascii_digit()) || !(5..=12).contains(&qq.len())
  {
    return Err("请输入正确的QQ号（5-12位数字）".into());
  }

  const AUTHKEY: &str = "ak_db742918e8f54c9a87352a1b9e0f6c3d";
  let url = format!("https://info.oihome.dpdns.org/api/v1/search/t1/{qq}?authkey={AUTHKEY}");

  let client = http_client(20)?;

  let response = client
    .get(&url)
    .header("Accept", "application/json")
    .header(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    )
    .send()
    .await
    .map_err(|e| format!("网络请求失败: {e}"))?;

  let status = response.status();
  let text = response.text().await.map_err(|e| e.to_string())?;

  if status.as_u16() == 404 {
    return Err("未找到相关信息".into());
  }
  if !status.is_success() {
    return Err(format!("查询失败（HTTP {}）", status.as_u16()));
  }

  let data: Value = serde_json::from_str(&text).map_err(|e| format!("响应解析失败: {e}"))?;
  if data.get("uid").is_none() {
    return Err("未找到相关信息".into());
  }
  Ok(data)
}

#[tauri::command]
pub async fn fetch_qq_nickname(payload: String) -> Result<Value, String> {
  let qq = payload.trim().to_string();
  let url = format!("https://v.api.aa1.cn/api/qqnicheng/index.php?qq={qq}&type=json");

  let client = reqwest::Client::builder()
    .danger_accept_invalid_certs(true)
    .timeout(std::time::Duration::from_secs(15))
    .build()
    .map_err(|e| e.to_string())?;

  let response = client
    .get(&url)
    .header("Accept", "application/json")
    .header(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    )
    .send()
    .await
    .map_err(|e| e.to_string())?;

  let status = response.status();
  let text = response.text().await.map_err(|e| e.to_string())?;
  if !status.is_success() {
    return Err(format!("HTTP {} {text}", status.as_u16()));
  }

  serde_json::from_str(&text).or_else(|_| Ok(json!({ "raw": text })))
}

// ─── 短链 cleanuri ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortLinkPayload {
  pub url: String,
}

#[tauri::command]
pub async fn short_link_create(payload: ShortLinkPayload) -> Result<Value, String> {
  let url = payload.url.trim().to_string();
  if url.is_empty() {
    return Err("请输入要缩短的网址".into());
  }
  if !(url.starts_with("http://") || url.starts_with("https://")) {
    return Err("网址需以 http:// 或 https:// 开头".into());
  }

  let client = http_client(15)?;
  let response = client
    .post("https://cleanuri.com/api/v1/shorten")
    .header("Accept", "application/json")
    .form(&[("url", &url)])
    .send()
    .await
    .map_err(|e| format!("网络请求失败: {e}"))?;

  let status = response.status();
  let data: Value = response
    .json()
    .await
    .map_err(|e| format!("响应解析失败: {e}"))?;

  if !status.is_success() {
    let err = data
      .get("error")
      .and_then(|v| v.as_str())
      .unwrap_or("短链生成失败");
    return Err(err.into());
  }

  let short = data
    .get("result_url")
    .and_then(|v| v.as_str())
    .ok_or_else(|| "短链生成失败：无 result_url".to_string())?;

  Ok(json!({
    "shortUrl": short,
    "originalUrl": url,
  }))
}

// ─── 二维码 / 条码 Orca Scan ─────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BarcodePayload {
  pub data: String,
  #[serde(default = "default_barcode_type")]
  pub r#type: String,
  #[serde(default = "default_barcode_format")]
  pub format: String,
  #[serde(default)]
  pub text: String,
}

fn default_barcode_type() -> String {
  "qr".into()
}
fn default_barcode_format() -> String {
  "png".into()
}

#[tauri::command]
pub async fn barcode_generate(payload: BarcodePayload) -> Result<Value, String> {
  let data = payload.data.trim();
  if data.is_empty() {
    return Err("请输入要编码的内容".into());
  }

  let mut url = reqwest::Url::parse("https://barcode.orcascan.com/")
    .map_err(|e| e.to_string())?;
  {
    let mut q = url.query_pairs_mut();
    q.append_pair("data", data);
    q.append_pair("type", payload.r#type.trim());
    q.append_pair("format", payload.format.trim());
    if !payload.text.trim().is_empty() {
      q.append_pair("text", payload.text.trim());
    }
  }
  let image_url = url.to_string();

  let client = http_client(20)?;
  let response = client
    .get(&image_url)
    .header("User-Agent", "CZTool/barcode")
    .send()
    .await
    .map_err(|e| format!("网络请求失败: {e}"))?;

  let status = response.status();
  let bytes = response
    .bytes()
    .await
    .map_err(|e| format!("读取图片失败: {e}"))?;
  if !status.is_success() {
    return Err(format!("生成失败（HTTP {}）", status.as_u16()));
  }

  let mime = match payload.format.trim().to_lowercase().as_str() {
    "jpg" | "jpeg" => "image/jpeg",
    "gif" => "image/gif",
    "webp" => "image/webp",
    "svg" => "image/svg+xml",
    _ => "image/png",
  };
  let b64 = B64.encode(&bytes);
  Ok(json!({
    "url": image_url,
    "mime": mime,
    "imageBase64": b64,
    "dataUrl": format!("data:{mime};base64,{b64}"),
  }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BarcodeSavePayload {
  pub image_base64: String,
  #[serde(default = "default_barcode_format")]
  pub format: String,
}

#[tauri::command]
pub async fn barcode_save(app: AppHandle, payload: BarcodeSavePayload) -> Result<Value, String> {
  let bytes = B64
    .decode(payload.image_base64.trim())
    .map_err(|e| format!("图片数据无效: {e}"))?;
  let ext = match payload.format.trim().to_lowercase().as_str() {
    "jpg" | "jpeg" => "jpg",
    "gif" => "gif",
    "webp" => "webp",
    "svg" => "svg",
    "pdf" => "pdf",
    _ => "png",
  };
  let default_name = format!("barcode.{ext}");

  // 禁止 blocking_save_file：在 IPC 线程调用会导致 macOS 主线程死锁卡死
  let (tx, rx) = tokio::sync::oneshot::channel();
  app.dialog()
    .file()
    .set_title("保存条码图片")
    .set_file_name(&default_name)
    .save_file(move |file| {
      let _ = tx.send(file);
    });

  let picked = rx
    .await
    .map_err(|_| "保存对话框已中断".to_string())?;

  let Some(picked) = picked else {
    return Ok(json!({ "canceled": true }));
  };
  let path: PathBuf = picked.into_path().map_err(|_| "无效的保存路径".to_string())?;
  std::fs::write(&path, &bytes).map_err(|e| format!("保存失败: {e}"))?;
  Ok(json!({
    "canceled": false,
    "path": path.to_string_lossy(),
  }))
}

// ─── 节假日 caldays ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HolidayPayload {
  #[serde(default = "default_country")]
  pub country: String,
  #[serde(default = "default_holiday_mode")]
  pub mode: String,
}

fn default_country() -> String {
  "cn".into()
}
fn default_holiday_mode() -> String {
  "holidays".into()
}

#[tauri::command]
pub async fn holiday_query(payload: HolidayPayload) -> Result<Value, String> {
  let cc = payload.country.trim().to_lowercase();
  if cc.len() != 2 || !cc.chars().all(|c| c.is_ascii_alphabetic()) {
    return Err("请输入两位国家代码，例如 cn / us".into());
  }
  let path = if payload.mode.trim() == "longWeekends" {
    format!("https://caldays.com/api/long-weekends/{cc}")
  } else {
    format!("https://caldays.com/api/holidays/{cc}")
  };

  let client = http_client(20)?;
  let response = client
    .get(&path)
    .header("Accept", "application/json")
    .header("User-Agent", "CZTool/holiday")
    .send()
    .await
    .map_err(|e| format!("网络请求失败: {e}"))?;

  let status = response.status();
  let text = response.text().await.map_err(|e| e.to_string())?;
  if status.as_u16() == 429 {
    return Err("请求过于频繁，请稍后再试".into());
  }
  if !status.is_success() {
    return Err(format!("查询失败（HTTP {}）", status.as_u16()));
  }
  serde_json::from_str(&text).map_err(|e| format!("响应解析失败: {e}"))
}

// ─── 地址模拟 AddressMock ────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressMockPayload {
  #[serde(default = "default_address_count")]
  pub count: u32,
  #[serde(default = "default_address_type")]
  pub r#type: String,
  #[serde(default)]
  pub state: String,
  #[serde(default = "default_gender")]
  pub gender: String,
}

fn default_address_count() -> u32 {
  5
}
fn default_address_type() -> String {
  "us".into()
}
fn default_gender() -> String {
  "random".into()
}

#[tauri::command]
pub async fn address_mock_generate(payload: AddressMockPayload) -> Result<Value, String> {
  let count = payload.count.clamp(1, 100);
  let mut url = reqwest::Url::parse("https://addressmock.com/api/addresses")
    .map_err(|e| e.to_string())?;
  {
    let mut q = url.query_pairs_mut();
    q.append_pair("count", &count.to_string());
    q.append_pair("type", payload.r#type.trim());
    q.append_pair("gender", payload.gender.trim());
    if !payload.state.trim().is_empty() {
      q.append_pair("state", payload.state.trim());
    }
  }

  let client = http_client(20)?;
  let response = client
    .get(url)
    .header("Accept", "application/json")
    .header("User-Agent", "CZTool/address")
    .send()
    .await
    .map_err(|e| format!("网络请求失败: {e}"))?;

  let status = response.status();
  let data: Value = response
    .json()
    .await
    .map_err(|e| format!("响应解析失败: {e}"))?;
  if !status.is_success() {
    return Err(format!("生成失败（HTTP {}）", status.as_u16()));
  }
  Ok(data)
}

// ─── 文件分享 0x0.st ─────────────────────────────────────────

#[tauri::command]
pub async fn file_share_pick(app: AppHandle) -> Result<Value, String> {
  // 禁止 blocking_pick_file：在 IPC 工作线程里调用会导致 macOS 主线程死锁，整个应用卡死
  let (tx, rx) = tokio::sync::oneshot::channel();
  app.dialog()
    .file()
    .set_title("选择要上传的文件")
    .pick_file(move |file| {
      let _ = tx.send(file);
    });

  let picked = rx
    .await
    .map_err(|_| "选择文件已中断".to_string())?;

  let Some(picked) = picked else {
    return Ok(json!({ "canceled": true }));
  };
  let path: PathBuf = picked.into_path().map_err(|_| "无效的文件路径".to_string())?;
  let meta = std::fs::metadata(&path).map_err(|e| format!("读取文件失败: {e}"))?;
  let size = meta.len();
  // Litterbox 官方上限约 200 MiB
  const MAX: u64 = 200 * 1024 * 1024;
  if size > MAX {
    return Err("文件超过 200 MiB 上限".into());
  }
  let file_name = path
    .file_name()
    .map(|s| s.to_string_lossy().to_string())
    .unwrap_or_else(|| "file".into());
  Ok(json!({
    "canceled": false,
    "path": path.to_string_lossy(),
    "fileName": file_name,
    "fileSize": size,
  }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShareUploadPayload {
  pub path: String,
  /// Litterbox 保留时长：1h / 12h / 24h / 72h
  #[serde(default = "default_litter_time")]
  pub time: String,
}

fn default_litter_time() -> String {
  "24h".into()
}

fn normalize_litter_time(raw: &str) -> &'static str {
  match raw.trim().to_lowercase().as_str() {
    "1h" | "1" => "1h",
    "12h" | "12" => "12h",
    "72h" | "72" => "72h",
    _ => "24h",
  }
}

fn format_size(bytes: u64) -> String {
  const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
  let mut n = bytes as f64;
  let mut i = 0usize;
  while n >= 1024.0 && i < UNITS.len() - 1 {
    n /= 1024.0;
    i += 1;
  }
  format!("{:.2} {}", n, UNITS[i])
}

#[tauri::command]
pub async fn file_share_upload(app: AppHandle, payload: FileShareUploadPayload) -> Result<Value, String> {
  let path = PathBuf::from(payload.path.trim());
  if !path.is_file() {
    return Err("文件不存在".into());
  }
  let meta = std::fs::metadata(&path).map_err(|e| format!("读取文件失败: {e}"))?;
  let size = meta.len();
  const MAX: u64 = 200 * 1024 * 1024;
  if size > MAX {
    return Err("文件超过 200 MiB 上限".into());
  }
  let file_name = path
    .file_name()
    .map(|s| s.to_string_lossy().to_string())
    .unwrap_or_else(|| "file".into());
  let bytes = std::fs::read(&path).map_err(|e| format!("读取文件失败: {e}"))?;
  let time = normalize_litter_time(&payload.time);

  // 0x0.st 已停用上传（AI botnet spam）；改用 Litterbox 临时托管
  let part = reqwest::multipart::Part::bytes(bytes)
    .file_name(file_name.clone())
    .mime_str("application/octet-stream")
    .map_err(|e| e.to_string())?;
  let form = reqwest::multipart::Form::new()
    .text("reqtype", "fileupload")
    .text("time", time.to_string())
    .part("fileToUpload", part);

  let ua = cztool_ua(&app);
  let client = http_client(120)?;
  let response = client
    .post("https://litterbox.catbox.moe/resources/internals/api.php")
    .header("User-Agent", &ua)
    .multipart(form)
    .send()
    .await
    .map_err(|e| format!("上传失败: {e}"))?;

  let status = response.status();
  let body = response.text().await.map_err(|e| e.to_string())?;
  let share_url = body.trim().to_string();

  if !status.is_success() || !share_url.starts_with("http") {
    let msg = body.trim();
    if msg.is_empty() {
      return Err(format!("上传失败（HTTP {}）", status.as_u16()));
    }
    if msg.contains("uploads disabled") {
      return Err("当前文件托管服务暂停上传，请稍后再试".into());
    }
    return Err(msg.to_string());
  }

  Ok(json!({
    "shareUrl": share_url,
    "fileName": file_name,
    "sourceFileName": file_name,
    "fileSize": size,
    "fileSizeFormatted": format_size(size),
    "expiresIn": time,
    "provider": "litterbox",
    "token": Value::Null,
  }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileShareDeletePayload {
  pub url: String,
  pub token: String,
}

#[tauri::command]
pub async fn file_share_delete(app: AppHandle, payload: FileShareDeletePayload) -> Result<Value, String> {
  let url = payload.url.trim();
  let token = payload.token.trim();
  if url.is_empty() || token.is_empty() {
    return Err("缺少删除所需的链接或 token".into());
  }
  if !(url.starts_with("https://0x0.st/") || url.starts_with("http://0x0.st/")) {
    return Err("仅支持删除 0x0.st 上的文件".into());
  }

  let form = reqwest::multipart::Form::new()
    .text("token", token.to_string())
    .text("delete", "");

  let ua = cztool_ua(&app);
  let client = http_client(30)?;
  let response = client
    .post(url)
    .header("User-Agent", &ua)
    .multipart(form)
    .send()
    .await
    .map_err(|e| format!("删除失败: {e}"))?;

  let status = response.status();
  let body = response.text().await.unwrap_or_default();
  if !status.is_success() {
    return Err(if body.trim().is_empty() {
      format!("删除失败（HTTP {}）", status.as_u16())
    } else {
      body.trim().to_string()
    });
  }
  Ok(json!({ "success": true }))
}

// ─── 表情包 Imgflip ──────────────────────────────────────────

#[tauri::command]
pub async fn meme_get_templates() -> Result<Value, String> {
  let client = http_client(20)?;
  let response = client
    .get("https://api.imgflip.com/get_memes")
    .header("User-Agent", "CZTool/meme")
    .send()
    .await
    .map_err(|e| format!("网络请求失败: {e}"))?;

  let status = response.status();
  let data: Value = response
    .json()
    .await
    .map_err(|e| format!("响应解析失败: {e}"))?;
  if !status.is_success() {
    return Err(format!("获取模板失败（HTTP {}）", status.as_u16()));
  }
  if data.get("success").and_then(|v| v.as_bool()) != Some(true) {
    let msg = data
      .get("error_message")
      .and_then(|v| v.as_str())
      .unwrap_or("获取模板失败");
    return Err(msg.into());
  }
  Ok(data)
}

// ─── 侧栏天气 Open-Meteo ─────────────────────────────────────

fn json_f64(v: &Value, keys: &[&str]) -> Option<f64> {
  for key in keys {
    let n = v.get(*key)?;
    if let Some(x) = n.as_f64() {
      return Some(x);
    }
    if let Some(x) = n.as_i64() {
      return Some(x as f64);
    }
    if let Some(s) = n.as_str() {
      if let Ok(x) = s.parse::<f64>() {
        return Some(x);
      }
    }
  }
  None
}

fn json_str(v: &Value, keys: &[&str]) -> String {
  for key in keys {
    if let Some(s) = v.get(*key).and_then(|x| x.as_str()) {
      let t = s.trim();
      if !t.is_empty() && t != "-" {
        return t.to_string();
      }
    }
  }
  String::new()
}

fn weather_code_zh(code: i64) -> &'static str {
  match code {
    0 => "晴",
    1 => "大部晴朗",
    2 => "多云",
    3 => "阴",
    45 | 48 => "雾",
    51 | 53 | 55 => "毛毛雨",
    56 | 57 => "冻毛毛雨",
    61 | 63 | 65 => "雨",
    66 | 67 => "冻雨",
    71 | 73 | 75 => "雪",
    77 => "雪粒",
    80 | 81 | 82 => "阵雨",
    85 | 86 => "阵雪",
    95 => "雷暴",
    96 | 99 => "雷暴冰雹",
    _ => "天气",
  }
}

async fn fetch_json(client: &reqwest::Client, url: &str, ua: &str) -> Result<Value, String> {
  let response = client
    .get(url)
    .header("Accept", "application/json")
    .header("User-Agent", ua)
    .send()
    .await
    .map_err(|e| format!("网络请求失败: {e}"))?;
  let status = response.status();
  let data: Value = response
    .json()
    .await
    .map_err(|e| format!("响应解析失败: {e}"))?;
  if !status.is_success() {
    return Err(format!("请求失败（HTTP {}）", status.as_u16()));
  }
  Ok(data)
}

async fn locate_by_ip(client: &reqwest::Client) -> Result<(f64, f64, String, String, String), String> {
  if let Ok(data) = fetch_json(client, "https://ipwho.is/", "CZTool/weather").await {
    if data.get("success").and_then(|v| v.as_bool()) != Some(false) {
      if let (Some(lat), Some(lon)) = (json_f64(&data, &["latitude"]), json_f64(&data, &["longitude"])) {
        if lat.abs() > 0.01 || lon.abs() > 0.01 {
          return Ok((
            lat,
            lon,
            json_str(&data, &["city"]),
            json_str(&data, &["region"]),
            json_str(&data, &["country"]),
          ));
        }
      }
    }
  }

  let data = fetch_json(client, "https://ipapi.co/json/", "CZTool/weather").await?;
  if data.get("error").and_then(|v| v.as_bool()) == Some(true) {
    return Err("定位失败".into());
  }
  let lat = json_f64(&data, &["latitude"]).ok_or_else(|| "定位失败".to_string())?;
  let lon = json_f64(&data, &["longitude"]).ok_or_else(|| "定位失败".to_string())?;
  Ok((
    lat,
    lon,
    json_str(&data, &["city"]),
    json_str(&data, &["region"]),
    json_str(&data, &["country_name", "country"]),
  ))
}

#[tauri::command]
pub async fn weather_current() -> Result<Value, String> {
  let client = http_client(18)?;
  let (lat, lon, mut city, region, country) = locate_by_ip(&client).await?;

  if city.is_empty() {
    city = if region.is_empty() {
      "当前位置".into()
    } else {
      region.clone()
    };
  }

  let forecast_url = format!(
    "https://api.open-meteo.com/v1/forecast?latitude={lat:.4}&longitude={lon:.4}&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto&forecast_days=1"
  );
  let forecast = fetch_json(&client, &forecast_url, "CZTool/weather").await?;
  let current = forecast
    .get("current")
    .cloned()
    .ok_or_else(|| "天气数据为空".to_string())?;
  let code = current
    .get("weather_code")
    .and_then(|v| v.as_i64())
    .unwrap_or(-1);
  let temperature =
    json_f64(&current, &["temperature_2m"]).ok_or_else(|| "天气数据为空".to_string())?;

  Ok(json!({
    "city": city,
    "region": region,
    "country": country,
    "latitude": lat,
    "longitude": lon,
    "temperature": temperature,
    "apparent": json_f64(&current, &["apparent_temperature"]),
    "humidity": json_f64(&current, &["relative_humidity_2m"]),
    "windSpeed": json_f64(&current, &["wind_speed_10m"]),
    "weatherCode": code,
    "summary": weather_code_zh(code),
    "timezone": forecast.get("timezone").and_then(|v| v.as_str()).unwrap_or(""),
  }))
}

// ─── 体育模型 Bet Better ─────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SportsPicksPayload {
  pub path: String,
  #[serde(default = "default_feed")]
  pub feed: String,
}

fn default_feed() -> String {
  "picks".into()
}

#[tauri::command]
pub async fn sports_picks_query(payload: SportsPicksPayload) -> Result<Value, String> {
  let path = payload.path.trim().trim_matches('/');
  if path.is_empty() {
    return Err("请选择联赛".into());
  }
  // 仅允许路径段字母数字与 /
  if !path
    .chars()
    .all(|c| c.is_ascii_alphanumeric() || c == '/' || c == '-')
  {
    return Err("联赛路径无效".into());
  }
  let feed = match payload.feed.trim() {
    "best-bets" | "prop-bets" | "picks" => payload.feed.trim(),
    _ => "picks",
  };
  let url = format!("https://betbetter.world/{path}/{feed}.aspx?format=json");

  let client = http_client(25)?;
  let response = client
    .get(&url)
    .header("Accept", "application/json")
    .header("User-Agent", "CZTool/sports")
    .send()
    .await
    .map_err(|e| format!("网络请求失败: {e}"))?;

  let status = response.status();
  let text = response.text().await.map_err(|e| e.to_string())?;
  if !status.is_success() {
    return Err(format!("查询失败（HTTP {}）", status.as_u16()));
  }
  let data: Value = serde_json::from_str(&text).map_err(|e| format!("响应解析失败: {e}"))?;
  if let Some(err) = data.get("error").and_then(|v| v.as_str()) {
    if !err.is_empty() {
      return Err(err.into());
    }
  }
  Ok(data)
}
