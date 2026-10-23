<script setup lang="ts">
import { DAY_MS, type BrawlerPerformance, type DailyPerformance } from "@brawlbase/tracker";
import type { PerformanceBrawler } from "#shared/types/performance";
const props = defineProps<{
	history: DailyPerformance[];
	distribution: BrawlerPerformance[];
	windowStart: number;
	days: number;
	brawlers: PerformanceBrawler[];
	focusBrawlerId?: number;
	kind: "maps" | "brawlers";
}>();
const { t, locale } = useI18n();
const selected = ref<number>();
const candidates = computed(() =>
	props.brawlers
		.filter((row) => props.history.some((point) => point.brawlerId === row.id))
		.map((row) => ({ label: row.name, value: row.id }))
);
const selectedId = computed(() => props.focusBrawlerId ?? selected.value ?? candidates.value[0]?.value);
watch(candidates, (items) => {
	if (selected.value !== undefined && !items.some((item) => item.value === selected.value)) selected.value = undefined;
});
const date = computed(() => new Intl.DateTimeFormat(locale.value, { month: "short", day: "numeric", timeZone: "UTC" }));
const percent = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
const formatPercent = (value: number) => percent.value.format(value / 100);
const points = computed(() =>
	Array.from({ length: props.days }, (_value, index) => {
		const day = props.windowStart + index * DAY_MS;
		const row = props.history.find((point) => point.day === day && point.brawlerId === selectedId.value);
		return {
			date: date.value.format(day),
			winRate: row?.winRate == null ? null : row.winRate * 100,
			pickRate: row?.pickRate == null ? null : row.pickRate * 100,
			picks: row?.picks ?? null,
		};
	})
);
const hasWinHistory = computed(() => points.value.some((point) => point.winRate !== null));
const hasHistory = computed(() => points.value.some((point) => point.winRate !== null || point.pickRate !== null));
const trendCategories = computed(() => ({
	win: [{ key: "winRate" as const, label: t("page.brawler_stats.win_rate") }],
	use: [{ key: "pickRate" as const, label: t("page.performance.use_rate") }],
}));
function createHistogram(metric: "winRate" | "pickRate", edges: number[]) {
	return edges.slice(0, -1).map((start, index) => {
		const end = edges[index + 1] ?? 100;
		return {
			band: `${start}–${end}%`,
			count: props.distribution.filter((row) => {
				const rate = row[metric];
				if (rate === null) return false;
				const value = rate * 100;
				return value >= start && (index === edges.length - 2 ? value <= end : value < end);
			}).length,
		};
	});
}
const winDistribution = computed(() => createHistogram("winRate", [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]));
const useDistribution = computed(() => createHistogram("pickRate", [0, 1, 2, 5, 10, 20, 100]));
const distributionCategories = computed(() => [
	{ key: "count" as const, label: t(props.kind === "maps" ? "page.performance.map_count" : "page.performance.brawler_count") },
]);
</script>
<template>
	<section class="space-y-4" data-testid="performance-charts">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h3 class="font-brawlstars text-2xl text-highlighted">{{ t("page.performance.daily_trends") }}</h3>
				<p class="mt-1 text-xs text-muted">{{ t("page.performance.history_note") }}</p>
			</div>
			<UFormField v-if="!focusBrawlerId && candidates.length" :label="t('page.performance.chart_brawler')"
				><USelectMenu
					v-model="selected"
					:items="candidates"
					value-key="value"
					class="w-52"
					:placeholder="candidates[0]?.label"
			/></UFormField>
		</div>
		<div v-if="hasHistory" class="grid gap-4 xl:grid-cols-2">
			<UCard variant="subtle" class="min-w-0 bg-elevated" :ui="{ body: 'space-y-3 p-4 sm:p-5' }"
				><h4 class="font-semibold text-highlighted">{{ t("page.brawler_stats.win_rate") }}</h4>
				<UChart
					v-if="hasWinHistory"
					type="line"
					:data="points"
					index="date"
					:categories="trendCategories.win"
					:height="240"
					:format="formatPercent"
					:colors="['primary']"
					points
					:aria-label="t('page.performance.win_trend')" /><UEmpty
					v-else
					:title="t('page.performance.no_decisive_results')"
			/></UCard>
			<UCard variant="subtle" class="min-w-0 bg-elevated" :ui="{ body: 'space-y-3 p-4 sm:p-5' }"
				><h4 class="font-semibold text-highlighted">{{ t("page.performance.use_rate") }}</h4>
				<UChart
					type="line"
					:data="points"
					index="date"
					:categories="trendCategories.use"
					:height="240"
					:format="formatPercent"
					:colors="['secondary']"
					points
					:aria-label="t('page.performance.use_trend')"
			/></UCard>
		</div>
		<UEmpty v-else icon="i-lucide-chart-line" :title="t('page.performance.no_history')" />
		<div class="grid gap-4 xl:grid-cols-2">
			<UCard variant="subtle" class="min-w-0 bg-elevated" :ui="{ body: 'space-y-3 p-4 sm:p-5' }"
				><h4 class="font-semibold text-highlighted">{{ t("page.performance.win_distribution") }}</h4>
				<UChart
					type="bar"
					:data="winDistribution"
					index="band"
					:categories="distributionCategories"
					:height="250"
					:colors="['primary']"
					:aria-label="t('page.performance.win_distribution')"
			/></UCard>
			<UCard variant="subtle" class="min-w-0 bg-elevated" :ui="{ body: 'space-y-3 p-4 sm:p-5' }"
				><h4 class="font-semibold text-highlighted">{{ t("page.performance.use_distribution") }}</h4>
				<UChart
					type="bar"
					:data="useDistribution"
					index="band"
					:categories="distributionCategories"
					:height="250"
					:colors="['secondary']"
					:aria-label="t('page.performance.use_distribution')"
			/></UCard>
		</div>
		<p class="text-xs leading-5 text-muted">
			{{ t(kind === "maps" ? "page.performance.map_distribution_note" : "page.performance.brawler_distribution_note") }}
		</p>
	</section>
</template>
