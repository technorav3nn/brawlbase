export default defineCachedEventHandler(() => useBrawlStarsApi().brawlers.getBrawlers(), {
	maxAge: 60 * 60 * 24, // 24 hours
});
