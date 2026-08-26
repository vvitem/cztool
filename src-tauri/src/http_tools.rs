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

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(20))
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
