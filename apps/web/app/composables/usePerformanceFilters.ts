import {
	DEFAULT_STATS_TROPHY_RANGE,
	SUPPORTED_MODES,
	TROPHY_RANGES,
	type StatsFilters,
	type TrophyRange,
} from "@brawlbase/tracker";

export function usePerformanceFilters() {
	const route = useRoute();
	const today = useState("performance-today", () => new Date().toISOString().slice(0, 10));
	const days = ref<StatsFilters["days"]>(7);
	const mode = ref("all");
	const trophyRange = ref<TrophyRange | "all">(DEFAULT_STATS_TROPHY_RANGE);
	const endDate = ref(today.value);
	function reset() {
		const value = Number(route.query.days);
		days.value = value === 1 || value === 30 ? value : 7;
		mode.value = SUPPORTED_MODES.find((value) => value === route.query.mode) ?? "all";
		trophyRange.value =
			route.query.trophyRange === "all"
				? "all"
				: (TROPHY_RANGES.find((value) => value === route.query.trophyRange) ?? DEFAULT_STATS_TROPHY_RANGE);
		endDate.value =
			typeof route.query.endDate === "string" &&
			/^\d{4}-\d{2}-\d{2}$/.test(route.query.endDate) &&
			route.query.endDate <= today.value
				? route.query.endDate
				: today.value;
	}
	reset();
	watch(() => route.fullPath, reset);
	const filters = computed<StatsFilters>(() => ({
		days: days.value,
		...(mode.value !== "all" ? { mode: mode.value } : {}),
		...(trophyRange.value !== "all" ? { trophyRange: trophyRange.value } : {}),
		...(endDate.value ? { endDate: endDate.value } : {}),
	}));
	return { days, mode, trophyRange, endDate, today, filters };
}
