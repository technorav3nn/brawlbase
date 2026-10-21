export default defineCachedEventHandler(
	(event) => {
		const id = Number(getRouterParam(event, "id"));
		return useBrawlApi().brawlers.getBrawlerById(id);
	},
	{
		maxAge: 60 * 60 * 24, // 24 hours
	}
);
