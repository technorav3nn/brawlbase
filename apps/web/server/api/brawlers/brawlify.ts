export default defineCachedEventHandler(() => useBrawlApi().brawlers.getAllBrawlers(), {
	maxAge: 60 * 60 * 24, // 24 hours
});
