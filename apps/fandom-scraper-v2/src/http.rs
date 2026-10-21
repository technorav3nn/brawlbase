use anyhow::{Context, Result, bail, ensure};
use reqwest::{Client, StatusCode, header::RETRY_AFTER};
use serde_json::Value;
use std::{sync::Arc, time::Duration};
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct Http {
    client: Client,
    permits: Arc<Semaphore>,
    attempts: usize,
    backoff: Duration,
}

impl Http {
    pub fn new(concurrency: usize) -> Result<Self> {
        ensure!(concurrency > 0, "HTTP concurrency must be positive");
        Ok(Self {
            client: Client::builder()
                .user_agent("brawlbase-fandom-scraper-v2/0.1")
                .connect_timeout(Duration::from_secs(10))
                .timeout(Duration::from_secs(60))
                .pool_idle_timeout(Duration::from_secs(90))
                .build()?,
            permits: Arc::new(Semaphore::new(concurrency)),
            attempts: 4,
            backoff: Duration::from_millis(500),
        })
    }

    pub async fn bytes(&self, url: &str) -> Result<Vec<u8>> {
        self.request(url, false).await
    }

    pub async fn json(&self, url: &str) -> Result<Value> {
        serde_json::from_slice(&self.request(url, true).await?)
            .with_context(|| format!("invalid JSON from {url}"))
    }

    async fn request(&self, url: &str, json: bool) -> Result<Vec<u8>> {
        for attempt in 0..self.attempts {
            let permit = self.permits.acquire().await?;
            let response = self.client.get(url).send().await;
            let mut delay = self.backoff * (1 << attempt);
            let error = match response {
                Err(error) => error.to_string(),
                Ok(response) => {
                    let status = response.status();
                    let retry = status == StatusCode::TOO_MANY_REQUESTS
                        || status == StatusCode::REQUEST_TIMEOUT
                        || status.is_server_error();
                    if !status.is_success() && !retry {
                        bail!("HTTP {status} from {url}");
                    }
                    if let Some(header) = response
                        .headers()
                        .get(RETRY_AFTER)
                        .and_then(|h| h.to_str().ok())
                    {
                        if let Ok(seconds) = header.parse::<u64>() {
                            delay = delay.max(Duration::from_secs(seconds));
                        } else if let Ok(date) = chrono::DateTime::parse_from_rfc2822(header)
                            && let Ok(wait) =
                                (date.with_timezone(&chrono::Utc) - chrono::Utc::now()).to_std()
                        {
                            delay = delay.max(wait);
                        }
                    }
                    match response.bytes().await {
                        Ok(bytes) if status.is_success() => {
                            if json {
                                match serde_json::from_slice::<Value>(&bytes) {
                                    Ok(value) => {
                                        let code = value
                                            .pointer("/error/code")
                                            .and_then(Value::as_str)
                                            .unwrap_or("");
                                        if ![
                                            "maxlag",
                                            "ratelimited",
                                            "readonly",
                                            "internal_api_error_DBConnectionError",
                                        ]
                                        .contains(&code)
                                        {
                                            return Ok(bytes.to_vec());
                                        }
                                        format!("transient MediaWiki error: {value}")
                                    }
                                    Err(error) => format!("invalid JSON: {error}"),
                                }
                            } else {
                                return Ok(bytes.to_vec());
                            }
                        }
                        Ok(_) => format!("HTTP {status}"),
                        Err(error) => error.to_string(),
                    }
                }
            };
            drop(permit); // Backoff must not hold a network slot.
            if attempt + 1 == self.attempts {
                bail!("{url} failed after {} attempts: {error}", self.attempts);
            }
            eprintln!("Retrying {url}: {error}");
            tokio::time::sleep(delay).await;
        }
        unreachable!()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };

    #[tokio::test]
    async fn retries_transient_failures_and_mediawiki_maxlag() {
        let server = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", server.local_addr().unwrap());
        let task = tokio::spawn(async move {
            for body in [
                "HTTP/1.1 503 Unavailable\r\nContent-Length: 0\r\n\r\n".to_owned(),
                response(r#"{"error":{"code":"maxlag"}}"#),
                response(r#"{"ok":true}"#),
            ] {
                let (mut stream, _) = server.accept().await.unwrap();
                let mut request = [0; 2048];
                assert!(stream.read(&mut request).await.unwrap() > 0);
                stream.write_all(body.as_bytes()).await.unwrap();
            }
        });
        let mut http = Http::new(2).unwrap();
        http.backoff = Duration::from_millis(1);
        assert_eq!(http.json(&url).await.unwrap()["ok"], true);
        task.await.unwrap();
    }

    fn response(body: &str) -> String {
        format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
    }

    #[tokio::test]
    async fn enforces_request_limit() {
        let server = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", server.local_addr().unwrap());
        let active = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let (a, p) = (active.clone(), peak.clone());
        let task = tokio::spawn(async move {
            let mut tasks = Vec::new();
            for _ in 0..12 {
                let (mut stream, _) = server.accept().await.unwrap();
                let (a, p) = (a.clone(), p.clone());
                tasks.push(tokio::spawn(async move {
                    p.fetch_max(a.fetch_add(1, Ordering::SeqCst) + 1, Ordering::SeqCst);
                    let mut request = [0; 2048];
                    assert!(stream.read(&mut request).await.unwrap() > 0);
                    tokio::time::sleep(Duration::from_millis(5)).await;
                    stream.write_all(response("{}").as_bytes()).await.unwrap();
                    a.fetch_sub(1, Ordering::SeqCst);
                }));
            }
            for task in tasks {
                task.await.unwrap();
            }
        });
        let http = Http::new(3).unwrap();
        let results = futures::future::join_all((0..12).map(|_| http.json(&url))).await;
        assert!(results.iter().all(Result::is_ok));
        task.await.unwrap();
        assert!(peak.load(Ordering::SeqCst) <= 3);
    }
}
