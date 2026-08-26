use std::fs;
use std::path::Path;

fn read_dotenv_value(key: &str) -> Option<String> {
  let candidates = [".env.production.local", ".env.local", ".env.production", ".env"];
  for file in candidates {
    let path = Path::new("../").join(file);
    let Ok(text) = fs::read_to_string(&path) else {
      continue;
    };
    for line in text.lines() {
      let line = line.trim();
      if line.is_empty() || line.starts_with('#') {
        continue;
      }
      if let Some((k, v)) = line.split_once('=') {
        if k.trim() == key {
          return Some(
            v.trim()
              .trim_matches('"')
              .trim_matches('\'')
              .trim_end_matches('/')
              .to_string(),
          );
        }
      }
    }
  }
  None
}

fn main() {
  if let Some(url) = std::env::var("CZTOOL_UNLOCK_API_URL")
    .ok()
    .or_else(|| std::env::var("VITE_UNLOCK_API_URL").ok())
    .or_else(|| read_dotenv_value("VITE_UNLOCK_API_URL"))
  {
    println!("cargo:rustc-env=VITE_UNLOCK_API_URL={url}");
  }
  println!("cargo:rerun-if-changed=../.env");
  println!("cargo:rerun-if-env-changed=VITE_UNLOCK_API_URL");
  println!("cargo:rerun-if-env-changed=CZTOOL_UNLOCK_API_URL");
  tauri_build::build()
}
