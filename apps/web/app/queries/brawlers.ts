export const useBrawlers = defineQuery({
	key: ["brawlers"],
	query: () => $fetch("/api/brawlers"),
	staleTime: 60 * 60,
});

export const useBrawlifyBrawlers = defineQuery({
	key: ["brawlers"],
	query: async () => (await $fetch("/api/brawlers/brawlify")).list,
	staleTime: 60 * 60,
});

export const useBrawlerByIdQuery = defineQueryOptions((id: number) => ({
	key: ["brawlers", id],
	query: async () => await $fetch(`/api/brawlers/${id}`),
	staleTime: 60 * 60,
}));

export const useBrawlerCdnByIdQuery = defineQueryOptions((id: number) => ({
	key: ["brawlers", "cdn", id],
	query: async () => await $fetch(`/api/brawlers/cdn/${id}`),
	staleTime: 60 * 60,
}));
