import { routes, type CdnBrawler } from "@brawlbase/cdn";

export default defineCachedEventHandler(
	(event) => {
		const id = Number(getRouterParam(event, "id"));
		return $fetch<CdnBrawler>(routes.brawlers(id).data);
	},
	{
		maxAge: 60 * 60 * 24, // 24 hours
	}
);
