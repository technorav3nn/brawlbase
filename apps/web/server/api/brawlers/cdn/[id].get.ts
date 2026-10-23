interface CdnServiceBinding {
	fetch(request: Request | string): Promise<Response>;
}

export default defineCachedEventHandler(
	async (event) => {
		const id = Number(getRouterParam(event, "id"));
		const cdn = event.context.cloudflare.env.CDN as CdnServiceBinding | undefined;
		if (!cdn) {
			throw createError({ statusCode: 503, statusMessage: "CDN service binding is unavailable" });
		}
		const response = await cdn.fetch(`https://brawlbase-cdn.internal/brawlers/${id}/data.json`);
		if (!response.ok) {
			throw createError({ statusCode: response.status, statusMessage: "Failed to fetch brawler CDN data" });
		}
		return response.json();
	},
	{
		name: "brawler-cdn-v2",
		maxAge: 60 * 60 * 24, // 24 hours
	}
);
