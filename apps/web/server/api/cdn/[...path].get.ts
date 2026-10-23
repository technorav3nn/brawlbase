interface CdnServiceBinding {
	fetch(request: Request): Promise<Response>;
}

export default defineEventHandler((event) => {
	const path = getRouterParam(event, "path");
	if (!path) {
		throw createError({ statusCode: 400, statusMessage: "A CDN path is required" });
	}

	const cdn = event.context.cloudflare.env.CDN as CdnServiceBinding | undefined;
	if (!cdn) {
		throw createError({ statusCode: 503, statusMessage: "CDN service binding is unavailable" });
	}

	// Cloudflare Workers provide URL globally; node:url is unavailable in this runtime.
	// eslint-disable-next-line n/prefer-global/url
	const upstreamUrl = new URL(`/${path}`, "https://brawlbase-cdn.internal");
	const requestHeaders = getRequestHeaders(event);
	const headers = new Headers();
	for (const name of ["accept", "if-modified-since", "if-none-match", "range"]) {
		const value = requestHeaders[name];
		if (value) headers.set(name, value);
	}
	const upstreamRequest = new Request(upstreamUrl, {
		method: event.method,
		headers,
	});
	return cdn.fetch(upstreamRequest);
});
