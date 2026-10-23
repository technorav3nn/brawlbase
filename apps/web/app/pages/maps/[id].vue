<script setup lang="ts">
import { MIN_TIER_RESULTS, winRateScore } from "@brawlbase/tracker";
import MapLayout from "~/components/features/maps/map-layout.vue";
import BrawlerPerformanceCard from "~/components/features/statistics/brawler-performance-card.vue";
import PerformanceCharts from "~/components/features/statistics/performance-charts.vue";
import PerformanceFilters from "~/components/features/statistics/performance-filters.vue";
import PerformanceHistory from "~/components/features/statistics/performance-history.vue";
import PerformanceMethodology from "~/components/features/statistics/performance-methodology.vue";
import PerformanceTabs from "~/components/features/statistics/performance-tabs.vue";
import PerformanceTierList from "~/components/features/statistics/performance-tier-list.vue";
import { useBrawlers } from "~/queries/brawlers";
import { useMapCatalog, useMapPerformanceQuery } from "~/queries/maps";
import { joinPerformanceBrawlers } from "~/utils/performance";

const route = useRoute();
const { t, locale } = useI18n();
const mapId = computed(() => Number(route.params.id));
const controls = usePerformanceFilters();
const { days, mode, trophyRange, endDate, filters } = controls;
const activeTab = ref("overview");
const mapOpen = ref(false);

const search = ref("");
const sort = ref("score");
const showUnmeasured = ref(false);
const brawlerFilters = computed(() => ({ ...filters.value, eventId: mapId.value }));

const { data, error, asyncStatus, refresh, refetch } = useQuery(() =>
	useMapPerformanceQuery({ mapId: mapId.value, filters: filters.value })
);
const { data: catalog, refresh: refreshCatalog } = useMapCatalog();
const { data: brawlerCatalog, refresh: refreshBrawlers } = useBrawlers();
const map = computed(() => catalog.value?.find((entry) => entry.id === mapId.value));
const mapName = computed(() => data.value?.map.name ?? map.value?.name ?? t("page.map_stats.unknown_map", { id: mapId.value }));
const loading = computed(() => asyncStatus.value === "loading");
const numberFormat = computed(() => new Intl.NumberFormat(locale.value));
const formatCount = (value: number) => numberFormat.value.format(value);
const sortItems = computed(() => [
	{ label: t("page.map_stats.most_picked"), value: "picks" },
	{ label: t("page.performance.ranked_win_rate"), value: "score" },
	{ label: t("page.performance.observed_win_rate"), value: "winRate" },
	{ label: t("page.map_stats.name"), value: "name" },
]);
const modes = computed(() =>
	data.value?.map.modes.length
		? data.value.map.modes.map((value) => t(`page.brawler_stats.modes.${value}`)).join(", ")
		: map.value?.gameMode.name
);
const allBrawlers = computed(() =>
	joinPerformanceBrawlers(brawlerCatalog.value, data.value?.brawlers, (id) => t("page.map_stats.unknown_brawler", { id }))
);
const hasRankedBrawlers = computed(() =>
	allBrawlers.value.some((row) => row.performance && winRateScore(row.performance.wins, row.performance.losses) !== null)
);
const brawlers = computed(() => {
	const term = search.value.trim().toLocaleLowerCase(locale.value);
	return [...allBrawlers.value]
		.filter(
			(row) =>
				(showUnmeasured.value || (row.performance?.picks ?? 0) > 0) &&
				row.name.toLocaleLowerCase(locale.value).includes(term)
		)
		.sort((a, b) => {
			if (sort.value === "name") return a.name.localeCompare(b.name, locale.value);
			if (sort.value === "winRate") {
				const rateDifference = (b.performance?.winRate ?? -1) - (a.performance?.winRate ?? -1);
				return rateDifference || a.name.localeCompare(b.name, locale.value);
			}
			if (sort.value === "score") {
				const score = (row: typeof a) =>
					row.performance ? winRateScore(row.performance.wins, row.performance.losses) : null;
				return (
					(score(b) ?? -1) - (score(a) ?? -1) ||
					(b.performance?.picks ?? 0) - (a.performance?.picks ?? 0) ||
					a.name.localeCompare(b.name, locale.value)
				);
			}
			return (b.performance?.picks ?? 0) - (a.performance?.picks ?? 0) || a.name.localeCompare(b.name, locale.value);
		});
});
const updatedAt = computed(() =>
	data.value?.updatedAt
		? new Intl.DateTimeFormat(locale.value, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
				data.value.updatedAt
			)
		: null
);
watch(mapId, () => {
	search.value = "";
});
useSeoMeta({ title: () => `${mapName.value} | BrawlBase`, description: () => t("page.map_stats.description") });
await Promise.all([refresh(), refreshCatalog(), refreshBrawlers()]);
</script>

<template>
	<UContainer class="py-6 sm:py-8" data-testid="map-stats-page">
		<UBreadcrumb :items="[{ label: t('page.events.title'), to: '/events' }, { label: mapName }]" class="mb-6" />
		<div class="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:gap-8">
			<aside class="hidden min-w-0 lg:sticky lg:top-24 lg:block">
				<UCard variant="subtle" class="overflow-hidden bg-elevated" :ui="{ body: 'p-0 sm:p-0' }">
					<MapLayout :image-url="map?.imageUrl" :name="mapName" class="aspect-[21/33]" />
					<div class="space-y-2 border-t border-default p-4">
						<p class="font-brawlstars text-xl text-highlighted">{{ mapName }}</p>
						<p v-if="modes" class="text-sm text-muted">{{ modes }}</p>
						<p class="text-xs text-muted">{{ t("page.map_stats.artwork_source") }}</p>
					</div>
				</UCard>
			</aside>
			<section class="min-w-0 space-y-6" :aria-busy="loading">
				<header class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0">
						<h1 class="font-brawlstars text-4xl leading-tight text-highlighted wrap-anywhere sm:text-5xl">
							{{ mapName }}
						</h1>
						<p class="mt-2 max-w-2xl text-sm leading-6 text-muted">{{ t("page.map_stats.description") }}</p>
					</div>
					<UButton
						:label="t('page.brawler_stats.refresh')"
						icon="i-lucide-refresh-cw"
						color="neutral"
						variant="subtle"
						:loading="loading"
						@click="refetch()"
					/>
				</header>
				<UButton
					:label="t('page.map_stats.view_map')"
					icon="i-lucide-map"
					color="neutral"
					variant="subtle"
					class="lg:hidden"
					@click="mapOpen = true"
				/>
				<PerformanceFilters
					v-model:days="days"
					v-model:mode="mode"
					v-model:trophy-range="trophyRange"
					v-model:end-date="endDate"
				/>
				<UAlert
					v-if="error"
					icon="i-lucide-cloud-off"
					color="warning"
					:title="t('page.brawler_stats.unavailable')"
					:description="t('page.brawler_stats.try_again')"
				/>
				<div v-else-if="loading && !data" role="status" class="grid gap-4 sm:grid-cols-2">
					<span class="sr-only">{{ t("page.brawler_stats.loading") }}</span
					><USkeleton v-for="slot in 6" :key="slot" class="h-48" />
				</div>
				<template v-else-if="data">
					<UAlert
						v-if="trophyRange !== 'all' && data.unclassifiedPicks"
						color="warning"
						variant="subtle"
						icon="i-lucide-info"
						:title="t('page.performance.enrichment_title')"
						:description="t('page.performance.enrichment_note', { count: formatCount(data.unclassifiedPicks) })"
					/>
					<PerformanceTabs v-model="activeTab" />
					<template v-if="activeTab === 'overview'">
						<div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-default pb-4">
							<h2 class="font-brawlstars text-2xl text-highlighted">{{ t("page.map_stats.brawlers") }}</h2>
							<p class="text-sm text-muted">
								{{ t("page.map_stats.match_count", { count: formatCount(data.sampleMatches) }) }}
							</p>
						</div>
						<div class="flex flex-wrap items-end gap-3 rounded-xl border border-default bg-elevated/60 p-3">
							<UFormField :label="t('page.map_stats.search')" class="min-w-0 flex-1 basis-44"
								><UInput
									v-model="search"
									icon="i-lucide-search"
									:placeholder="t('page.map_stats.search')"
									class="w-full"
							/></UFormField>
							<UFormField :label="t('page.map_stats.sort')"
								><USelect v-model="sort" :items="sortItems" class="w-44"
							/></UFormField>
						</div>
						<div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
							<p>
								{{
									sort === "score" && !hasRankedBrawlers
										? t("page.performance.score_pending", { count: MIN_TIER_RESULTS })
										: t("page.map_stats.no_data_hint")
								}}
							</p>
							<USwitch v-model="showUnmeasured" :label="t('page.performance.show_unmeasured')" size="sm" />
						</div>
						<UEmpty
							v-if="!data.sampleMatches"
							icon="i-lucide-chart-no-axes-combined"
							:title="t('page.map_stats.empty')"
							:description="t('page.brawler_stats.empty_description')"
						/>
						<div
							v-if="brawlers.length"
							class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
							data-testid="map-brawler-grid"
						>
							<BrawlerPerformanceCard
								v-for="(brawler, index) in brawlers"
								:key="brawler.id"
								:brawler="brawler"
								:rank="index + 1"
								:filters="brawlerFilters"
							/>
						</div>
						<UEmpty
							v-else-if="data.sampleMatches"
							icon="i-lucide-search"
							:title="t('page.map_stats.no_search_results')"
						/>
					</template>
					<PerformanceCharts
						v-else-if="activeTab === 'charts'"
						:history="data.history"
						:distribution="data.brawlers"
						:window-start="data.windowStart"
						:days="days"
						:brawlers="allBrawlers"
						kind="brawlers"
					/>
					<PerformanceTierList
						v-else-if="activeTab === 'tier_list'"
						:brawlers="allBrawlers"
						:filters="brawlerFilters"
						@select-trophy-range="trophyRange = $event"
					/>
					<PerformanceHistory v-else :history="data.history" :brawlers="allBrawlers" />
					<PerformanceMethodology />
					<footer class="space-y-2 border-t border-default pt-4 text-xs leading-5 text-muted">
						<p v-if="updatedAt">{{ t("page.brawler_stats.updated", { time: updatedAt }) }}</p>
						<p>{{ t("page.brawler_stats.source") }}</p>
					</footer>
				</template>
			</section>
		</div>
		<UModal v-model:open="mapOpen" :title="mapName" :description="modes" :ui="{ content: 'max-w-xl' }"
			><template #body><MapLayout :image-url="map?.imageUrl" :name="mapName" class="h-[70vh]" /></template
		></UModal>
	</UContainer>
</template>
