const CDN_ORIGIN = "https://brawlbase-cdn.deathblows.workers.dev";

export function cdnUrl(url: string): string {
	if (!url.startsWith(CDN_ORIGIN)) return url;
	return `/api/cdn${url.slice(CDN_ORIGIN.length)}`;
}
