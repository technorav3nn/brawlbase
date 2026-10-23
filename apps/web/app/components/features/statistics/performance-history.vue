<script setup lang="ts">
import type { DailyPerformance } from "@brawlbase/tracker";
import type { TableColumn } from "@nuxt/ui";
import type { PerformanceBrawler } from "#shared/types/performance";

const props = defineProps<{ history: DailyPerformance[]; brawlers: PerformanceBrawler[]; focusBrawlerId?: number }>();
const { t, locale } = useI18n();

const selected = ref<number>();
const options = computed(() =>
	props.brawlers
		.filter((row) => props.history.some((point) => point.brawlerId === row.id))
		.map((row) => ({ label: row.name, value: row.id }))
);
const selectedId = computed(() => props.focusBrawlerId ?? selected.value ?? options.value[0]?.value);
watch(options, (items) => {
	if (selected.value !== undefined && !items.some((item) => item.value === selected.value)) selected.value = undefined;
});
const rows = computed(() =>
	props.history.filter((point) => point.brawlerId === selectedId.value).toSorted((a, b) => b.day - a.day)
);
const columns = computed<TableColumn<DailyPerformance>[]>(() => [
	{ accessorKey: "day", header: t("page.performance.date") },
	{ accessorKey: "winRate", header: t("page.brawler_stats.win_rate") },
	{ accessorKey: "pickRate", header: t("page.performance.use_rate") },
	{ accessorKey: "picks", header: t("page.brawler_stats.picks") },
	{ accessorKey: "wins", header: t("page.performance.wins_short") },
	{ accessorKey: "losses", header: t("page.performance.losses_short") },
	{ accessorKey: "draws", header: t("page.performance.draws_short") },
]);
const date = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: "medium", timeZone: "UTC" }));
const percent = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
</script>
<template>
	<section class="min-w-0 space-y-4" data-testid="performance-history">
		<h3 class="font-brawlstars text-2xl text-highlighted">{{ t("page.performance.meta_history") }}</h3>
		<p class="max-w-3xl text-sm leading-6 text-muted">{{ t("page.performance.history_description") }}</p>
		<UFormField v-if="!focusBrawlerId && options.length" :label="t('page.performance.chart_brawler')">
			<USelectMenu v-model="selected" :items="options" value-key="value" :placeholder="options[0]?.label" class="w-52" />
		</UFormField>
		<UTable v-if="rows.length" :data="rows" :columns="columns" :get-row-id="(row) => String(row.day)" class="max-w-full">
			<template #day-cell="{ row }">{{ date.format(row.original.day) }}</template>
			<template #winRate-cell="{ row }">{{
				row.original.winRate === null ? "—" : percent.format(row.original.winRate)
			}}</template>
			<template #pickRate-cell="{ row }">{{
				row.original.pickRate === null ? "—" : percent.format(row.original.pickRate)
			}}</template>
		</UTable>
		<UEmpty v-else icon="i-lucide-calendar-days" :title="t('page.performance.no_history')" />
	</section>
</template>
