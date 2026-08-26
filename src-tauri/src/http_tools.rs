use serde_json::{json, Value};

#[tauri::command]
pub async fn douyin_parse(payload: String) -> Result<Value, String> {
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(35))
    .build()
    .map_err(|e| e.to_string())?;

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
