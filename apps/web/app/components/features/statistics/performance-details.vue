<script setup lang="ts">
import { winRateScore, type BrawlerPerformance } from "@brawlbase/tracker";
const props = defineProps<{ performance: BrawlerPerformance }>();
const { t, locale } = useI18n();
const count = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }));
const percent = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
const formatRate = (value: number | null | undefined) => (value == null ? "—" : percent.value.format(value));
const interval = computed(() =>
	props.performance.confidenceLow == null || props.performance.confidenceHigh == null
		? "—"
		: `${formatRate(props.performance.confidenceLow)}–${formatRate(props.performance.confidenceHigh)}`
);
const metrics = computed(() => [
	{
		label: t("page.performance.conservative_score"),
		value: formatRate(winRateScore(props.performance.wins, props.performance.losses)),
	},
	{ label: t("page.performance.confidence"), value: interval.value },
	{
		label: t("page.performance.decisive_results"),
		value: count.value.format(props.performance.wins + props.performance.losses),
	},
	{ label: t("page.performance.draw_rate"), value: formatRate(props.performance.drawRate) },
	{
		label: t("page.performance.average_trophies"),
		value: props.performance.averageTrophies == null ? "—" : count.value.format(props.performance.averageTrophies),
	},
	{ label: t("page.performance.star_rate"), value: formatRate(props.performance.starPlayerRate) },
	{
		label: t("page.performance.average_duration"),
		value:
			props.performance.averageDuration == null
				? "—"
				: t("page.performance.seconds", { count: count.value.format(props.performance.averageDuration) }),
	},
]);
</script>
<template>
	<div class="space-y-3">
		<dl class="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
			<div v-for="metric in metrics" :key="metric.label" class="min-w-0">
				<dt class="text-xs text-muted">{{ metric.label }}</dt>
				<dd class="mt-1 text-lg font-semibold tabular-nums text-highlighted">{{ metric.value }}</dd>
			</div>
		</dl>
		<p class="text-xs leading-5 text-muted">{{ t("page.performance.score_note") }}</p>
		<p class="text-xs leading-5 text-muted">{{ t("page.performance.confidence_note") }}</p>
	</div>
</template>
