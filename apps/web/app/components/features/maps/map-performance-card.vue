<script setup lang="ts">
import { MIN_TIER_RESULTS, type MapPerformance, type StatsFilters, type TrophyRange } from "@brawlbase/tracker";
import PerformanceRate from "../statistics/performance-rate.vue";
import MapLayout from "./map-layout.vue";
const props = defineProps<{
	map: MapPerformance;
	imageUrl?: string;
	days: StatsFilters["days"];
	trophyRange: TrophyRange | "all";
	endDate?: string;
}>();
defineEmits<{ filter: [map: MapPerformance] }>();
const { t, locale } = useI18n();
const count = computed(() => new Intl.NumberFormat(locale.value));
const mapLink = computed(() => ({
	path: `/maps/${props.map.eventId}`,
	query: {
		days: props.days,
		mode: props.map.mode,
		trophyRange: props.trophyRange,
		...(props.endDate ? { endDate: props.endDate } : {}),
	},
}));
</script>
<template>
	<UCard
		as="article"
		variant="subtle"
		class="group relative min-w-0 overflow-hidden bg-elevated"
		:ui="{ body: 'p-0 sm:p-0' }"
		data-testid="map-performance-card"
	>
		<div class="absolute inset-x-0 top-0 h-0.5 bg-primary" aria-hidden="true" />
		<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 p-3">
			<NuxtLink
				:to="mapLink"
				class="block self-stretch overflow-hidden rounded-lg bg-primary/5 ring-1 ring-primary/15 transition-colors group-hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				:aria-label="t('page.map_stats.open_map', { name: map.map })"
			>
				<MapLayout :image-url="imageUrl" :name="map.map" class="aspect-[21/33] h-full bg-transparent" />
			</NuxtLink>
			<div class="min-w-0 space-y-2">
				<header>
					<p class="text-[11px] leading-4 text-muted">{{ t(`page.brawler_stats.modes.${map.mode}`) }}</p>
					<h4 class="mt-0.5 font-brawlstars text-xl leading-tight text-highlighted wrap-anywhere">
						<NuxtLink
							:to="mapLink"
							class="rounded hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
							>{{ map.map }}</NuxtLink
						>
					</h4>
				</header>
				<div class="space-y-3 border-y border-default py-2.5">
					<PerformanceRate :label="t('page.brawler_stats.win_rate')" :value="map.winRate" kind="win" />
					<PerformanceRate :label="t('page.performance.use_rate')" :value="map.pickRate" kind="use" />
				</div>
				<p class="text-[11px] leading-4 text-muted">
					{{ t("page.map_stats.pick_count", { count: count.format(map.picks) }) }}
				</p>
				<UBadge v-if="map.wins + map.losses < MIN_TIER_RESULTS" color="warning" variant="subtle" size="xs">{{
					t("page.map_stats.small_sample")
				}}</UBadge>
			</div>
		</div>
		<div class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-2 py-1">
			<UButton
				:to="mapLink"
				:label="t('page.map_stats.view_map')"
				trailing-icon="i-lucide-arrow-right"
				color="neutral"
				variant="ghost"
				size="xs"
			/>
			<UButton
				:label="t('page.map_stats.filter_map')"
				icon="i-lucide-list-filter"
				:aria-label="t('page.map_stats.filter_named_map', { name: map.map })"
				color="neutral"
				variant="ghost"
				size="xs"
				@click="$emit('filter', map)"
			/>
		</div>
	</UCard>
</template>
