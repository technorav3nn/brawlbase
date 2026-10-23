<script setup lang="ts">
import { routes } from "@brawlbase/cdn";
import {
	MIN_TIER_RESULTS,
	S_TIER_WIN_RATE,
	TROPHY_RANGES,
	winRateScore,
	winRateTier,
	type StatsFilters,
	type TrophyRange,
	type WinRateTier,
} from "@brawlbase/tracker";
import type { PerformanceBrawler } from "#shared/types/performance";
import { cdnUrl } from "~/utils/cdn-url";
import { brawlerPerformanceLink } from "~/utils/performance";
const props = defineProps<{ brawlers: PerformanceBrawler[]; filters: StatsFilters }>();
defineEmits<{ selectTrophyRange: [range: TrophyRange] }>();
const { t, locale } = useI18n();
const failedIcons = ref(new Set<number>());
const rate = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
const definitions: {
	tier: WinRateTier;
	threshold: string;
	color: "primary" | "secondary" | "success" | "info" | "warning" | "error";
}[] = [
	{ tier: "S", threshold: `≥${S_TIER_WIN_RATE * 100}%`, color: "primary" },
	{ tier: "A", threshold: `55–<${S_TIER_WIN_RATE * 100}%`, color: "secondary" },
	{ tier: "B", threshold: "50–<55%", color: "success" },
	{ tier: "C", threshold: "45–<50%", color: "info" },
	{ tier: "D", threshold: "40–<45%", color: "warning" },
	{ tier: "F", threshold: "<40%", color: "error" },
];
const sorted = computed(() => {
	if (!props.filters.trophyRange) return [];
	return props.brawlers
		.map((brawler) => ({
			...brawler,
			score: brawler.performance ? winRateScore(brawler.performance.wins, brawler.performance.losses) : null,
			tier: brawler.performance ? winRateTier(brawler.performance.wins, brawler.performance.losses) : null,
		}))
		.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name, locale.value));
});
const tiers = computed(() =>
	props.filters.trophyRange
		? definitions.map((definition) => ({
				...definition,
				brawlers: sorted.value.filter((row) => row.tier === definition.tier),
			}))
		: []
);
const unrated = computed(() => sorted.value.filter((row) => row.tier === null));
</script>
<template>
	<section class="space-y-4" data-testid="performance-tier-list">
		<div class="flex flex-wrap items-center gap-3">
			<h3 class="font-brawlstars text-2xl text-highlighted">{{ t("page.performance.tier_list") }}</h3>
			<UBadge v-if="filters.trophyRange" color="neutral" variant="subtle">{{ filters.trophyRange }}</UBadge>
		</div>
		<UEmpty
			v-if="!filters.trophyRange"
			icon="i-lucide-trophy"
			:title="t('page.performance.choose_trophy_range')"
			:description="t('page.performance.tier_range_note')"
			data-testid="tier-range-required"
		>
			<template #actions>
				<UButton
					v-for="range in TROPHY_RANGES"
					:key="range"
					:label="range"
					color="neutral"
					variant="subtle"
					@click="$emit('selectTrophyRange', range)"
				/>
			</template>
		</UEmpty>
		<p v-else class="max-w-3xl text-sm leading-6 text-muted">
			{{ t("page.performance.tier_method", { count: MIN_TIER_RESULTS, sThreshold: S_TIER_WIN_RATE * 100 }) }}
		</p>
		<UCard
			v-for="tier in tiers"
			:key="tier.tier"
			variant="subtle"
			class="bg-elevated"
			:ui="{ body: 'flex flex-wrap gap-3 p-3 sm:p-3' }"
		>
			<div class="flex w-16 shrink-0 flex-col items-start gap-1">
				<UBadge :color="tier.color" size="lg" class="font-brawlstars text-2xl">{{ tier.tier }}</UBadge
				><span class="text-[10px] text-muted">{{ tier.threshold }}</span>
			</div>
			<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
				<NuxtLink
					v-for="brawler in tier.brawlers"
					:key="brawler.id"
					:to="brawlerPerformanceLink(brawler.id, filters)"
					class="flex w-20 flex-col items-center gap-0.5 rounded-lg bg-default/40 p-1.5 text-center transition-colors hover:bg-accented focus-visible:outline-2 focus-visible:outline-primary"
				>
					<img
						v-if="!failedIcons.has(brawler.id)"
						:src="cdnUrl(routes.brawlers(brawler.id).icon)"
						alt=""
						width="40"
						height="40"
						loading="lazy"
						class="size-10 rounded object-contain"
						@error="failedIcons.add(brawler.id)"
					>
					<UIcon v-else name="i-lucide-user-round" class="size-10 text-muted" aria-hidden="true" />
					<span class="w-full truncate text-[11px] font-semibold">{{ brawler.name }}</span
					><span class="text-xs font-semibold tabular-nums text-highlighted">{{
						brawler.score == null ? "—" : rate.format(brawler.score)
					}}</span>
					<span class="text-[9px] tabular-nums text-muted">{{
						t("page.performance.observed_rate_value", {
							rate: brawler.performance?.winRate == null ? "—" : rate.format(brawler.performance.winRate),
						})
					}}</span>
				</NuxtLink>
				<p v-if="!tier.brawlers.length" class="self-center text-sm text-muted">{{ t("page.performance.empty_tier") }}</p>
			</div>
		</UCard>
		<UCard v-if="unrated.length" variant="subtle" class="bg-elevated" :ui="{ body: 'space-y-3 p-4 sm:p-5' }">
			<h4 class="font-brawlstars text-xl text-highlighted">{{ t("page.performance.unrated") }} ({{ unrated.length }})</h4>
			<p class="text-sm text-muted">{{ t("page.performance.unrated_description", { count: MIN_TIER_RESULTS }) }}</p>
			<div class="flex flex-wrap gap-2">
				<UButton
					v-for="brawler in unrated"
					:key="brawler.id"
					:to="brawlerPerformanceLink(brawler.id, filters)"
					:label="brawler.name"
					color="neutral"
					variant="soft"
					size="xs"
				/>
			</div>
		</UCard>
	</section>
</template>
