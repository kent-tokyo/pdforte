use serde_json::json;

async fn call_deepl(text: &str, target: &str, api_key: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api-free.deepl.com/v2/translate")
        .header("Authorization", format!("DeepL-Auth-Key {api_key}"))
        .json(&json!({
            "text": [text],
            "target_lang": target.to_uppercase(),
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    body["translations"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "DeepL: 翻訳レスポンスの解析に失敗しました".to_string())
}

async fn call_openai(text: &str, target: &str, api_key: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&json!({
            "model": "gpt-4o-mini",
            "messages": [{
                "role": "user",
                "content": format!(
                    "Translate the following text to {target}. Output ONLY the translated text, no explanations or extra text:\n\n{text}"
                )
            }],
            "temperature": 0.2,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    body["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "OpenAI: 翻訳レスポンスの解析に失敗しました".to_string())
}

async fn call_claude(text: &str, target: &str, api_key: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 4096,
            "messages": [{
                "role": "user",
                "content": format!(
                    "Translate the following text to {target}. Output ONLY the translated text, no explanations:\n\n{text}"
                )
            }]
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    body["content"][0]["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Claude: 翻訳レスポンスの解析に失敗しました".to_string())
}

#[tauri::command]
pub async fn translate_text(
    text: String,
    target_lang: String,
    engine: String,
    api_key: String,
) -> Result<String, String> {
    if text.trim().is_empty() {
        return Ok(text);
    }
    match engine.as_str() {
        "deepl"  => call_deepl(&text, &target_lang, &api_key).await,
        "openai" => call_openai(&text, &target_lang, &api_key).await,
        "claude" => call_claude(&text, &target_lang, &api_key).await,
        other    => Err(format!("Unknown engine: {other}")),
    }
}
