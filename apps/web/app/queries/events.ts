export const useEventRotation = defineQuery({
	key: ["events", "rotation"],
	query: () => $fetch("/api/events"),
	staleTime: 60_000,
});
