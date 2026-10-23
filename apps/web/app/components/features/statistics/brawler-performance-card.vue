<script setup lang="ts">
import { routes } from "@brawlbase/cdn";
import { MIN_TIER_RESULTS, winRateScore, winRateTier, type StatsFilters } from "@brawlbase/tracker";
import PerformanceDetails from "./performance-details.vue";
import PerformanceRate from "./performance-rate.vue";
import type { PerformanceBrawler } from "#shared/types/performance";
import { cdnUrl } from "~/utils/cdn-url";
import { brawlerPerformanceLink } from "~/utils/performance";
const props = defineProps<{ brawler: PerformanceBrawler; rank: number; filters: StatsFilters }>();
const { t, locale } = useI18n();
const failed = ref(false);
const tier = computed(() =>
	props.filters.trophyRange && props.brawler.performance
		? winRateTier(props.brawler.performance.wins, props.brawler.performance.losses)
		: null
);
const score = computed(() =>
	props.brawler.performance ? winRateScore(props.brawler.performance.wins, props.brawler.performance.losses) : null
);
const rate = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
const count = computed(() => new Intl.NumberFormat(locale.value));
const formatRate = (value: number | null | undefined) => (value == null ? "—" : rate.value.format(value));
const palettes = {
	S: { color: "primary", stripe: "bg-primary", portrait: "bg-primary/15", rate: "text-primary" },
	A: { color: "secondary", stripe: "bg-secondary", portrait: "bg-secondary/15", rate: "text-secondary" },
	B: { color: "success", stripe: "bg-success", portrait: "bg-success/15", rate: "text-success" },
	C: { color: "info", stripe: "bg-info", portrait: "bg-info/15", rate: "text-info" },
	D: { color: "warning", stripe: "bg-warning", portrait: "bg-warning/15", rate: "text-warning" },
	F: { color: "error", stripe: "bg-error", portrait: "bg-error/15", rate: "text-error" },
	unrated: { color: "neutral", stripe: "bg-accented", portrait: "bg-muted", rate: "text-highlighted" },
} as const;
const palette = computed(() => palettes[tier.value ?? "unrated"]);
</script>
<template>
	<UCard
		as="article"
		variant="subtle"
		class="relative min-w-0 overflow-hidden bg-elevated"
		:ui="{ body: 'p-0 sm:p-0' }"
		data-testid="brawler-performance-card"
	>
		<div class="absolute inset-x-0 top-0 h-0.5" :class="palette.stripe" aria-hidden="true" />
		<NuxtLink
			:to="brawlerPerformanceLink(brawler.id, filters)"
			class="group flex min-w-0 items-center gap-2.5 px-3 pt-3 pb-2.5 focus-visible:outline-2 focus-visible:outline-primary"
		>
			<div class="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg" :class="palette.portrait">
				<img
					v-if="!failed"
					:src="cdnUrl(routes.brawlers(brawler.id).icon)"
					alt=""
					width="44"
					height="44"
					loading="lazy"
					class="size-11 object-contain transition-transform group-hover:scale-105"
					@error="failed = true"
				>
				<UIcon v-else name="i-lucide-user-round" class="size-8 text-muted" />
			</div>
			<div class="min-w-0 flex-1">
				<div class="mb-0.5 flex items-center justify-between gap-2">
					<span v-if="brawler.performance?.picks" class="text-xs tabular-nums text-muted">#{{ rank }}</span>
					<UBadge v-if="tier" :color="palette.color" variant="soft" size="sm" class="font-brawlstars">{{
						tier
					}}</UBadge>
				</div>
				<h3 class="font-brawlstars text-lg leading-tight wrap-anywhere text-highlighted group-hover:text-primary">
					{{ brawler.name }}
				</h3>
				<p class="mt-0.5 text-[11px] leading-4 text-muted">
					{{
						brawler.performance
							? t("page.map_stats.pick_count", { count: count.format(brawler.performance.picks) })
							: t("page.map_stats.no_picks")
					}}
				</p>
			</div>
		</NuxtLink>
		<div class="grid grid-cols-2 gap-4 border-y border-default bg-default/20 px-3 py-2.5">
			<PerformanceRate :label="t('page.brawler_stats.win_rate')" :value="brawler.performance?.winRate" kind="win" />
			<PerformanceRate :label="t('page.performance.use_rate')" :value="brawler.performance?.pickRate" kind="use" />
		</div>
		<div class="flex items-baseline justify-between gap-2 px-3 pt-2 text-[11px]" data-testid="conservative-score">
			<span class="text-muted">{{ t("page.performance.conservative_score") }}</span>
			<span class="font-semibold tabular-nums text-highlighted">{{ formatRate(score) }}</span>
		</div>
		<div class="px-2 py-1">
			<UCollapsible v-if="brawler.performance">
				<UButton
					:label="
						brawler.performance.wins + brawler.performance.losses < MIN_TIER_RESULTS
							? t('page.map_stats.small_sample')
							: t('page.performance.details')
					"
					icon="i-lucide-chart-no-axes-combined"
					color="neutral"
					variant="ghost"
					size="xs"
					trailing-icon="i-lucide-chevron-down"
					class="w-full justify-between py-1"
				/>
				<template #content><PerformanceDetails :performance="brawler.performance" class="py-3" /></template>
			</UCollapsible>
			<p v-else class="py-1 text-xs text-muted">{{ t("page.performance.unrated") }}</p>
		</div>
	</UCard>
</template>
