use crate::{http::Http, images::Vips};
use anyhow::{Context, Result};
use futures::{StreamExt, stream};
use serde_json::Value;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, AtomicUsize, Ordering},
    time::Instant,
};

/// Rename within the destination directory so an interrupted write never truncates an existing file.
pub async fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let parent = path.parent().context("output path has no parent")?;
    tokio::fs::create_dir_all(parent).await?;
    let temp = parent.join(format!(
        ".fandom-{}-{}.tmp",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let result = async {
        tokio::fs::write(&temp, bytes).await?;
        tokio::fs::rename(&temp, path).await
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&temp).await;
    }
    result.with_context(|| format!("writing {}", path.display()))
}

pub async fn write_data(data: &Value, path: &Path) -> Result<()> {
    atomic_write(path, serde_json::to_string_pretty(data)?.as_bytes()).await
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetTransform {
    Standard,
    RemoveWhite,
    ProfileIcon,
    Raw,
}

#[derive(Debug, Clone)]
pub struct AssetJob {
    pub url: String,
    pub path: PathBuf,
    pub transform: AssetTransform,
}

#[derive(Clone)]
pub struct Downloader {
    http: Http,
    concurrency: usize,
}

impl Downloader {
    pub fn new(http: Http, concurrency: usize) -> Result<Self> {
        anyhow::ensure!(concurrency > 0, "asset concurrency must be positive");
        Vips::global()?; // Fail before producing an incomplete output tree if the codec is unavailable.
        Ok(Self { http, concurrency })
    }

    pub async fn download_asset(&self, job: &AssetJob) -> Result<()> {
        eprintln!("[image] Downloading {} -> {}", job.url, job.path.display());
        let bytes = self.http.bytes(&job.url).await?;
        if job.transform == AssetTransform::Raw {
            return atomic_write(&job.path, &bytes).await;
        }
        let transform = job.transform;
        let encoded = tokio::task::spawn_blocking(move || {
            let vips = Vips::global()?;
            match transform {
                AssetTransform::Standard => vips.asset(&bytes, false),
                AssetTransform::RemoveWhite => vips.asset(&bytes, true),
                AssetTransform::ProfileIcon => vips.profile_icon(&bytes),
                AssetTransform::Raw => Ok(bytes),
            }
        })
        .await??;
        atomic_write(&job.path, &encoded).await
    }

    pub async fn download_gear(&self, url: &str, path: &Path) -> Result<()> {
        let start = Instant::now();
        eprintln!("[gear image] Downloading {url} -> {}", path.display());
        let bytes = self.http.bytes(url).await?;
        let encoded = tokio::task::spawn_blocking(move || Vips::global()?.gear(&bytes)).await??;
        atomic_write(path, &encoded).await?;
        eprintln!(
            "[gear image] Saved {} ({} bytes, {:.2}s)",
            path.display(),
            encoded.len(),
            start.elapsed().as_secs_f64()
        );
        Ok(())
    }

    /// Independent paths run concurrently; repeated paths retain their original write order.
    /// This preserves the last profile icon and shared accessory overwrite behavior.
    pub async fn download_all(&self, jobs: Vec<AssetJob>) -> usize {
        let total = jobs.len();
        let start = Instant::now();
        let completed = AtomicUsize::new(0);
        eprintln!(
            "[images] Downloading {total} images (up to {} at once)",
            self.concurrency
        );
        let mut by_path = HashMap::<PathBuf, usize>::new();
        let mut groups = Vec::<Vec<AssetJob>>::new();
        for job in jobs {
            let index = *by_path.entry(job.path.clone()).or_insert_with(|| {
                groups.push(Vec::new());
                groups.len() - 1
            });
            groups[index].push(job);
        }
        let failures = stream::iter(groups)
            .map(|group| {
                let completed = &completed;
                async move {
                    let mut failures = 0;
                    for job in group {
                        let image_start = Instant::now();
                        let result = self.download_asset(&job).await;
                        let done = completed.fetch_add(1, Ordering::Relaxed) + 1;
                        match result {
                            Ok(()) => eprintln!(
                                "[images {done}/{total}] Saved {} ({:.2}s)",
                                job.path.display(),
                                image_start.elapsed().as_secs_f64()
                            ),
                            Err(error) => {
                                eprintln!(
                                    "[images {done}/{total}] FAILED {} <- {}: {error:#}",
                                    job.path.display(),
                                    job.url
                                );
                                failures += 1;
                            }
                        }
                    }
                    failures
                }
            })
            .buffer_unordered(self.concurrency)
            .fold(0, |sum, failures| async move { sum + failures })
            .await;
        eprintln!(
            "[images] Finished: {} saved, {failures} failed, {total} total ({:.2}s)",
            total - failures,
            start.elapsed().as_secs_f64()
        );
        failures
    }
}
