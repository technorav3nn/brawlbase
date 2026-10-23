<script setup lang="ts">
import { MIN_TIER_RESULTS, type MapPerformance, type StatsFilters } from "@brawlbase/tracker";
import { useBrawlerStore } from "~/components/features/brawlers/brawler-store";
import MapPerformanceCard from "~/components/features/maps/map-performance-card.vue";
import EquipmentPerformance from "~/components/features/statistics/equipment-performance.vue";
import PerformanceCharts from "~/components/features/statistics/performance-charts.vue";
import PerformanceDetails from "~/components/features/statistics/performance-details.vue";
import PerformanceFilters from "~/components/features/statistics/performance-filters.vue";
import PerformanceHistory from "~/components/features/statistics/performance-history.vue";
import PerformanceMethodology from "~/components/features/statistics/performance-methodology.vue";
import PerformanceTabs from "~/components/features/statistics/performance-tabs.vue";
import PerformanceTierList from "~/components/features/statistics/performance-tier-list.vue";
import { useBrawlerPerformanceQuery } from "~/queries/brawler-performance";
import { useBrawlers } from "~/queries/brawlers";
import { useMapCatalog } from "~/queries/maps";
import { joinPerformanceBrawlers } from "~/utils/performance";

const { t, locale } = useI18n();
const route = useRoute();
const { brawler } = storeToRefs(useBrawlerStore());
const brawlerId = computed(() => Number(route.params.id));
const controls = usePerformanceFilters();
const { days, mode, trophyRange, endDate } = controls;
const activeTab = ref("overview");

const selectedMapId = ref<number>();
function resetSelectedMap() {
	const id = Number(route.query.eventId);
	selectedMapId.value = Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? id : undefined;
}
resetSelectedMap();
watch(() => route.fullPath, resetSelectedMap);
const filters = computed<StatsFilters>(() => ({
	...controls.filters.value,
	...(selectedMapId.value ? { eventId: selectedMapId.value } : {}),
}));
const { data, error, asyncStatus, refresh, refetch } = useQuery(() =>
	useBrawlerPerformanceQuery({ brawlerId: brawlerId.value, filters: filters.value })
);
const { data: mapCatalog, refresh: refreshMapCatalog } = useMapCatalog();
const { data: brawlerCatalog, refresh: refreshBrawlers } = useBrawlers();
const allBrawlers = computed(() =>
	joinPerformanceBrawlers(brawlerCatalog.value, data.value?.brawlers, (id) => t("page.map_stats.unknown_brawler", { id }))
);
const mapsById = computed(() => new Map(mapCatalog.value?.map((map) => [map.id, map])));
const selectedMap = computed(() =>
	selectedMapId.value
		? {
				id: selectedMapId.value,
				name:
					mapsById.value.get(selectedMapId.value)?.name ?? t("page.map_stats.unknown_map", { id: selectedMapId.value }),
			}
		: undefined
);
const loading = computed(() => asyncStatus.value === "loading");
const performance = computed(() => data.value?.brawlers.find((row) => row.brawlerId === brawlerId.value));
const numberFormat = computed(() => new Intl.NumberFormat(locale.value));
const percentFormat = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
const formatRate = (value: number | null | undefined) => (value == null ? "—" : percentFormat.value.format(value));
const formatCount = (value: number) => numberFormat.value.format(value);
const updatedAt = computed(() =>
	data.value?.updatedAt
		? new Intl.DateTimeFormat(locale.value, {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: "UTC",
			}).format(data.value.updatedAt)
		: null
);
const lowSample = computed(
	() => performance.value !== undefined && performance.value.wins + performance.value.losses < MIN_TIER_RESULTS
);

function filterMap(map: MapPerformance) {
	selectedMapId.value = map.eventId;
}

useSeoMeta({
	title: () => `${t("page.brawler_stats.title", { name: brawler.value?.name ?? "Brawler" })} | BrawlBase`,
	description: () => t("page.brawler_stats.description"),
});
await Promise.all([refresh(), refreshMapCatalog(), refreshBrawlers()]);
</script>

<template>
	<section class="space-y-6 pt-3 pb-16" data-testid="brawler-performance" :aria-busy="loading">
		<header class="flex flex-wrap items-start justify-between gap-4">
			<div class="min-w-0">
				<h2 class="font-brawlstars text-3xl text-highlighted">
					{{ t("page.brawler_stats.title", { name: brawler?.name ?? "" }) }}
				</h2>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-muted">{{ t("page.brawler_stats.description") }}</p>
			</div>
			<UButton
				icon="i-lucide-refresh-cw"
				:label="t('page.brawler_stats.refresh')"
				:loading="loading"
				color="neutral"
				variant="subtle"
				@click="refetch()"
			/>
		</header>
		<PerformanceFilters v-model:days="days" v-model:mode="mode" v-model:trophy-range="trophyRange" v-model:end-date="endDate">
			<UButton v-if="selectedMap" icon="i-lucide-x" color="neutral" variant="soft" @click="selectedMapId = undefined">{{
				t("page.brawler_stats.clear_map", { name: selectedMap.name })
			}}</UButton>
		</PerformanceFilters>
		<UAlert
			v-if="error"
			icon="i-lucide-cloud-off"
			color="warning"
			:title="t('page.brawler_stats.unavailable')"
			:description="t('page.brawler_stats.try_again')"
		/>
		<div v-else-if="loading && !data" role="status" class="space-y-3">
			<p class="text-sm text-muted">{{ t("page.brawler_stats.loading") }}</p>
			<USkeleton class="h-48 w-full" />
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
				<UCard v-if="performance" variant="subtle" class="bg-elevated" :ui="{ body: 'space-y-4 p-4 sm:p-5' }">
					<dl class="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
						<div class="min-w-0">
							<dt class="text-sm text-muted">{{ t("page.performance.observed_win_rate") }}</dt>
							<dd class="mt-1 font-brawlstars text-4xl text-highlighted tabular-nums">
								{{ formatRate(performance.winRate) }}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="text-sm text-muted">{{ t("page.brawler_stats.pick_rate") }}</dt>
							<dd class="mt-1 font-brawlstars text-4xl text-highlighted tabular-nums">
								{{ formatRate(performance.pickRate) }}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="text-sm text-muted">{{ t("page.brawler_stats.picks") }}</dt>
							<dd class="mt-1 font-brawlstars text-4xl text-highlighted tabular-nums">
								{{ formatCount(performance.picks) }}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="text-sm text-muted">{{ t("page.brawler_stats.results") }}</dt>
							<dd class="mt-2 space-y-1 text-sm tabular-nums">
								<p>{{ t("page.brawler_stats.wins", { count: formatCount(performance.wins) }) }}</p>
								<p>{{ t("page.brawler_stats.losses", { count: formatCount(performance.losses) }) }}</p>
								<p>{{ t("page.brawler_stats.draws", { count: formatCount(performance.draws) }) }}</p>
							</dd>
						</div>
					</dl>
					<UCollapsible class="border-t border-default pt-2">
						<UButton
							:label="t('page.performance.details')"
							icon="i-lucide-chart-no-axes-combined"
							trailing-icon="i-lucide-chevron-down"
							color="neutral"
							variant="ghost"
							size="sm"
							class="w-full justify-between"
						/>
						<template #content><PerformanceDetails :performance="performance" class="pt-4" /></template>
					</UCollapsible>
					<p v-if="lowSample" class="flex items-start gap-2 text-sm text-warning">
						<UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						{{ t("page.brawler_stats.low_sample") }}
					</p>
				</UCard>
				<UEmpty
					v-else
					icon="i-lucide-chart-no-axes-combined"
					:title="t('page.brawler_stats.empty')"
					:description="t('page.brawler_stats.empty_description')"
				/>
				<EquipmentPerformance :brawler-id="brawlerId" :brawler="brawler" :filters="filters" />
				<section v-if="data.maps.length" class="min-w-0" :aria-label="t('page.brawler_stats.by_map')">
					<h3 class="font-brawlstars text-2xl text-highlighted">{{ t("page.brawler_stats.by_map") }}</h3>
					<p class="mt-1 mb-4 text-sm text-muted">{{ t("page.brawler_stats.map_hint") }}</p>
					<div class="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
						<MapPerformanceCard
							v-for="map in data.maps"
							:key="`${map.eventId}:${map.mode}`"
							:map="map"
							:image-url="mapsById.get(map.eventId)?.imageUrl"
							:days="days"
							:trophy-range="trophyRange"
							:end-date="endDate"
							@filter="filterMap"
						/>
					</div>
				</section>
			</template>
			<PerformanceCharts
				v-else-if="activeTab === 'charts'"
				:history="data.history"
				:distribution="data.maps"
				:window-start="data.windowStart"
				:days="days"
				:brawlers="allBrawlers"
				:focus-brawler-id="brawlerId"
				kind="maps"
			/>
			<PerformanceTierList
				v-else-if="activeTab === 'tier_list'"
				:brawlers="allBrawlers"
				:filters="filters"
				@select-trophy-range="trophyRange = $event"
			/>
			<PerformanceHistory v-else :history="data.history" :brawlers="allBrawlers" :focus-brawler-id="brawlerId" />
			<PerformanceMethodology />
			<footer class="space-y-2 border-t border-default pt-4 text-xs leading-5 text-muted">
				<p>
					{{
						t("page.brawler_stats.coverage", {
							matches: formatCount(data.sampleMatches),
							players: formatCount(data.trackedPlayers),
						})
					}}
				</p>
				<p v-if="updatedAt">{{ t("page.brawler_stats.updated", { time: updatedAt }) }}</p>
				<p v-if="data.possibleGaps">{{ t("page.brawler_stats.gaps", { count: formatCount(data.possibleGaps) }) }}</p>
				<p>{{ t("page.brawler_stats.source") }}</p>
			</footer>
		</template>
	</section>
</template>
