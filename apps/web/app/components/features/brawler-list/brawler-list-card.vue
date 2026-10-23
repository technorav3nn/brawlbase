<script setup lang="ts">
import type { BrawlApiBrawler } from "@brawlbase/brawl-api";
import { routes } from "@brawlbase/cdn";
import type { BrawlerPerformance } from "@brawlbase/tracker";
import { cdnUrl } from "~/utils/cdn-url";

const props = defineProps<{ brawler: BrawlApiBrawler; showRarity?: boolean; performance?: BrawlerPerformance }>();

const { t, locale } = useI18n();
const percentage = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
const formatRate = (value: number | null | undefined) => (value == null ? "—" : percentage.value.format(value));
const rarityToColor = /* ui */ {
	"Ultra Legendary":
		"ring-1 ring-inset dark:ring-[#9dffd5]/40! ring-[#9dffd5]/70! bg-[#9dffd5]/10 text-[#9dffd5]! transition-all duration-200",
	Mythic: "ring-1 ring-inset dark:ring-red-400/40! ring-red-400/60 text-red-400! bg-red-400/10",
	Legendary:
		"ring-1 ring-inset dark:ring-yellow-400/40 ring-yellow-400/60 dark:text-yellow-400 text-yellow-600/85 bg-yellow-400/10",
	Epic: "ring-1 ring-inset dark:ring-purple-400/40 ring-purple-400/60 text-purple-400 bg-purple-400/10",
	Rare: "ring-1 ring-inset dark:ring-green-400/40 ring-green-400/60 dark:text-green-400 text-green-600/80 bg-green-400/10",
	"Super Rare": "ring-1 ring-inset dark:ring-blue-400/40 ring-blue-400/60 text-blue-400 bg-blue-400/10",
	Common: "ring-1 ring-inset dark:ring-neutral-400/40 ring-neutral-400/60 text-neutral-400 bg-neutral-400/10",
};

const rarityToNormalColor = {
	// base:  bg-[linear-gradient(135deg,color-mix(in_srgb,var(--rarity)_22%,transparent),color-mix(in_srgb,var(--rarity)_4%,transparent))]
	"Ultra Legendary": "ultra-legendary-card-gradient-bg-light dark:ultra-legendary-card-gradient-bg-dark bg-gradient-to-br",
	Mythic: "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-red-400)_22%,transparent),color-mix(in_srgb,#ff0000_4%,transparent))]",
	Legendary:
		"bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-yellow-400)_22%,transparent),color-mix(in_srgb,#ffff00_4%,transparent))]",
	Epic: "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-purple-400)_22%,transparent),color-mix(in_srgb,var(--color-purple-400)_4%,transparent))]",
	Rare: "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-green-400)_22%,transparent),color-mix(in_srgb,var(--color-green-400)_4%,transparent))]",
	"Super Rare":
		"bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-blue-400)_22%,transparent),color-mix(in_srgb,var(--color-blue-400)_4%,transparent))]",
	Common: "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-neutral-400)_22%,transparent),color-mix(in_srgb,var(--color-neutral-400)_4%,transparent))]",
};

const rarityToRingColor = {
	"Ultra Legendary": "dark:ring-[#9dffd5]/30 dark:hover:ring-[#9dffd5]/50 ring-[#520f81]/30 hover:ring-[#520f81]/50",
	Mythic: "ring-red-400/30 hover:ring-red-400/50",
	Legendary: "ring-yellow-400/30 hover:ring-yellow-400/50",
	Epic: "ring-purple-400/30 hover:ring-purple-400/50",
	Rare: "ring-green-400/30 hover:ring-green-400/50",
	"Super Rare": "ring-blue-400/30 hover:ring-blue-400/50",
	Common: "ring-neutral-400/30 hover:ring-neutral-400/50",
};

const rarity = computed(() => props.brawler.rarity.name);
const color = computed(() => {
	return rarityToColor[rarity.value as keyof typeof rarityToColor];
});
const normalColor = computed(() => {
	return rarityToNormalColor[rarity.value as keyof typeof rarityToNormalColor];
});
const ringColor = computed(() => {
	return rarityToRingColor[rarity.value as keyof typeof rarityToRingColor];
});
</script>

<template>
	<UPageCard
		:class="`brawl-roster-card w-full overflow-hidden ${normalColor} ${ringColor}`"
		:ui="{
			container: 'p-0!',
			header: 'mb-0 mb-1 !  w-full! overflow-hidden rounded-t-md',
			wrapper: 'min-w-0 w-full',
			body: 'min-w-0 w-full',
			title: 'min-w-0 w-full',
		}"
		:to="`/brawlers/${props.brawler.id}`"
		variant="subtle"
	>
		<template #header>
			<NuxtImg
				:src="cdnUrl(routes.brawlers(props.brawler.id).icon)"
				loading="lazy"
				class="rounded-sm! w-full! h-full! object-cover"
				:alt="brawler.name"
				width="150"
				height="150"
			/>
		</template>

		<template #title>
			<div class="flex min-w-0 w-full flex-col justify-start px-2 pb-2">
				<p class="overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">
					{{ props.brawler.name }}
				</p>
				<div>
					<p class="text-xs font-medium text-ellipsis line-clamp-1 text-dimmed">
						{{ props.brawler.class.name }}
					</p>
					<UBadge
						v-if="props.brawler.rarity.name !== 'Ultra Legendary'"
						:class="color"
						class="mt-1 h-5 w-max px-1.5 text-[0.7rem]"
					>
						{{ props.brawler.rarity.name }}
					</UBadge>
					<div v-else class="mt-1 flex min-h-5 w-full! flex-row items-center rounded-sm">
						<div
							style="animation-duration: 15s !important"
							class="relative inline-block p-px rounded-sm ultra-legendary-gradient-bg"
						>
							<div
								style="animation-duration: 15s !important"
								class="ultra-legendary-gradient-bg absolute inset-0 w-full scale-x-[0.99] scale-y-[0.90] rounded-sm opacity-20"
							/>
							<span class="flex items-center justify-center rounded-sm bg-default px-1.5 font-semibold text-white">
								<span
									style="animation-duration: 15s !important"
									class="ultra-legendary-gradient-text text-[0.7rem]!"
								>
									Ultra Legendary
								</span>
							</span>
						</div>
					</div>
				</div>
				<div class="mt-2 space-y-1 border-t border-default pt-2 tabular-nums" data-testid="directory-brawler-stats">
					<div class="flex items-center justify-between gap-1">
						<p class="min-w-0 text-[9px] leading-tight text-muted">{{ t("page.brawler_stats.win_rate") }}</p>
						<p class="shrink-0 font-brawlstars text-sm text-primary">{{ formatRate(performance?.winRate) }}</p>
					</div>
					<div class="flex items-center justify-between gap-1">
						<p class="min-w-0 text-[9px] leading-tight text-muted">{{ t("page.performance.use_rate") }}</p>
						<p class="shrink-0 font-brawlstars text-sm text-highlighted">{{ formatRate(performance?.pickRate) }}</p>
					</div>
				</div>
			</div>
		</template>
	</UPageCard>
</template>

<style scoped>
/* Text gradient animation */
.ultra-text {
	background-image: linear-gradient(115deg, var(--color1), var(--color2), var(--color3), var(--color4), var(--color1));

	animation: gradient 8s linear infinite;
	color: transparent;
	background-size: 300%;
	background-clip: text;
}

@keyframes gradient {
	0% {
		background-position: 0% 50%;
	}
	100% {
		background-position: 300% 50%;
	}
}
/*
.ultra-background {
	background-image: linear-gradient(115deg, var(--color1), var(--color2), var(--color3), var(--color4), var(--color1));
	width: 100%;
	height: 200px;
	display: flex;
	justify-content: center;
	align-items: center;
	background-size: 300%;
	animation: animatedgradient 6s ease infinite alternate;
}

.animate-gradient {
	background-size: 300%;
	-webkit-animation: animatedgradient 6s ease infinite alternate;
	-moz-animation: animatedgradient 6s ease infinite alternate;
	animation: animatedgradient 6s ease infinite alternate;
}

@keyframes animatedgradient {
	0% {
		background-position: 0% 50%;
	}
	50% {
		background-position: 100% 50%;
	}
	100% {
		background-position: 0% 50%;
	}
}

@keyframes textGradientFlow {
	0% {
		background-position: 0% 50%;
	}
	100% {
		background-position: 300% 50%;
	}
}

@keyframes backgroundGradientFlow {
	0% {
		background-position: 300% 50%;
	}
	100% {
		background-position: 0% 50%;
	}
} */
</style>
