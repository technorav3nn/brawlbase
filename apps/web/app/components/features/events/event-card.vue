<script setup lang="ts">
import { routes } from "@brawlbase/cdn";
import { DEFAULT_STATS_TROPHY_RANGE, type StatsFilters } from "@brawlbase/tracker";
import type { RotationEvent } from "#shared/types/events";
import type { PerformanceBrawler } from "#shared/types/performance";
import { cdnUrl } from "~/utils/cdn-url";
import { eventArtwork } from "~/utils/event-artwork";
import { brawlerPerformanceLink } from "~/utils/performance";

const props = defineProps<{ event: RotationEvent; upcoming: boolean; now?: number; bestPicks?: PerformanceBrawler[] }>();
const { t, locale } = useI18n();
const failedIcons = ref(new Set<number>());
const rate = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
const artwork = computed(() => eventArtwork(props.event));
const statsFilters = computed<StatsFilters>(() => ({
	days: 7,
	eventId: props.event.mapId,
	trophyRange: DEFAULT_STATS_TROPHY_RANGE,
}));
const mapLink = computed(() => ({ path: `/maps/${props.event.mapId}`, query: { trophyRange: DEFAULT_STATS_TROPHY_RANGE } }));
const imageFailed = ref(false);
const rotationTime = computed(() => (props.upcoming ? props.event.startTime : props.event.endTime));
const timeRemaining = computed(() => {
	if (props.now === undefined) return undefined;
	const target = Date.parse(rotationTime.value);
	if (!Number.isFinite(target)) return undefined;
	const minutes = Math.max(0, Math.ceil((target - props.now) / 60_000));
	if (minutes < 1) return t("page.events.changing");
	const duration =
		minutes >= 1440
			? t("page.events.days_hours", { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60) })
			: t("page.events.hours_minutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
	return t(props.upcoming ? "page.events.starts_in" : "page.events.ends_in", { time: duration });
});

watch(
	() => artwork.value.banner,
	() => {
		imageFailed.value = false;
	}
);
</script>

<template>
	<UCard
		as="article"
		variant="subtle"
		class="group/event overflow-hidden bg-elevated"
		:ui="{ body: 'p-0 sm:p-0' }"
		data-testid="event-card"
	>
		<NuxtLink
			:to="mapLink"
			:aria-label="t('page.map_stats.open_map', { name: event.mapName })"
			class="relative block aspect-[4/1] overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary"
			data-testid="event-map-link"
		>
			<!-- Crop the transparent outer pixels present in some source banners. -->
			<img
				v-if="artwork.banner && !imageFailed"
				:src="artwork.banner"
				alt=""
				:width="artwork.width"
				:height="artwork.height"
				loading="lazy"
				class="absolute inset-0 size-full scale-[1.04] object-cover"
				@error="imageFailed = true"
			/>
			<div v-else class="grid size-full place-items-center" aria-hidden="true">
				<img
					v-if="artwork.icon"
					:src="artwork.icon"
					alt=""
					width="64"
					height="64"
					class="size-16 object-contain opacity-35"
				/>
				<UIcon v-else name="i-lucide-swords" class="size-12 text-muted" />
			</div>
		</NuxtLink>
		<div class="p-3">
			<header class="flex items-center gap-2.5">
				<div class="grid size-9 shrink-0 place-items-center" data-testid="event-mode-icon">
					<img v-if="artwork.icon" :src="artwork.icon" alt="" width="36" height="36" class="size-9 object-contain" />
					<UIcon v-else name="i-lucide-swords" class="size-7 text-muted" aria-hidden="true" />
				</div>
				<div class="min-w-0">
					<p class="text-[11px] font-medium leading-4 wrap-anywhere text-muted">{{ event.modeName }}</p>
					<h2 class="font-brawlstars text-xl leading-tight wrap-anywhere text-highlighted">
						<NuxtLink
							:to="mapLink"
							class="rounded transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
							>{{ event.mapName }}</NuxtLink
						>
					</h2>
				</div>
			</header>
			<section class="mt-2.5 border-t border-default pt-2" :aria-label="t('page.performance.best_picks')">
				<div class="mb-1.5 flex items-center justify-between gap-2">
					<h3 class="text-xs font-semibold text-highlighted">{{ t("page.performance.best_picks") }}</h3>
					<NuxtLink :to="mapLink" class="text-xs text-primary hover:underline">{{
						t("page.brawler_stats.tab")
					}}</NuxtLink>
				</div>
				<div v-if="bestPicks?.length" class="grid grid-cols-5 gap-1.5">
					<UTooltip v-for="brawler in bestPicks" :key="brawler.id" :text="brawler.name">
						<NuxtLink
							:to="brawlerPerformanceLink(brawler.id, statsFilters)"
							class="flex min-w-0 flex-col items-center gap-0.5 rounded-md bg-primary/10 p-1 ring-1 ring-inset ring-primary/15 transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
							:aria-label="brawler.name"
						>
							<img
								v-if="!failedIcons.has(brawler.id)"
								:src="cdnUrl(routes.brawlers(brawler.id).icon)"
								alt=""
								width="40"
								height="40"
								loading="lazy"
								class="size-8 rounded object-contain"
								@error="failedIcons.add(brawler.id)"
							/>
							<UIcon v-else name="i-lucide-user-round" class="size-8 text-muted" />
							<span class="text-xs font-semibold tabular-nums text-primary">{{
								brawler.performance?.winRate == null ? "—" : rate.format(brawler.performance.winRate)
							}}</span>
						</NuxtLink>
					</UTooltip>
				</div>
				<p v-else class="text-xs text-muted">{{ t("page.performance.no_top_picks") }}</p>
				<p v-if="bestPicks?.length" class="mt-1.5 text-[10px] leading-4 text-muted">
					{{ t("page.performance.best_picks_note", { range: DEFAULT_STATS_TROPHY_RANGE }) }}
				</p>
			</section>
			<div class="mt-2 flex items-center border-t border-default pt-2">
				<p class="flex min-w-0 items-center gap-1.5 text-xs tabular-nums text-muted">
					<UIcon name="i-lucide-clock-3" class="size-3.5 shrink-0" aria-hidden="true" />
					<time v-if="timeRemaining" :datetime="rotationTime">{{ timeRemaining }}</time>
					<span v-else>{{ t("page.events.schedule") }}</span>
				</p>
			</div>
		</div>
	</UCard>
</template>
