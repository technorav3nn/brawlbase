export default defineCachedEventHandler(
	async () => {
		try {
			const maps = await useBrawlApi().maps.getAllMaps();
			// Catalog artwork and names only; performance always comes from our collected sample.
			return maps.list.map(({ id, name, imageUrl, gameMode }) => ({
				id,
				name,
				imageUrl,
				gameMode: { name: gameMode.name },
			}));
		} catch {
			throw createError({ statusCode: 503, statusMessage: "Map catalog is unavailable" });
		}
	},
	{ maxAge: 60 * 60 * 24 }
);
