<script setup lang="ts">
import type { BrawlApiBrawler } from "@brawlbase/brawl-api";

const props = defineProps<{ brawler: BrawlApiBrawler; showRarity?: boolean }>();

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
		:class="`w-full overflow-hidden ${normalColor} ${ringColor}`"
		:ui="{
			container: 'p-0!',
			header: 'mb-0 p-1.5',
		}"
		:to="`/brawlers/${props.brawler.id}`"
		variant="subtle"
	>
		<template #header>
			<NuxtImg
				:src="props.brawler.imageUrl2"
				loading="lazy"
				class="rounded-md!"
				:alt="brawler.name"
				width="150"
				height="150"
			/>
		</template>

		<template #title>
			<div class="flex flex-col justify-start px-2 pb-2">
				<p class="overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">
					{{ props.brawler.name }}
				</p>
				<div>
					<UBadge
						v-if="props.brawler.rarity.name !== 'Ultra Legendary'"
						:class="color"
						class="mt-1 h-5 w-max rounded-full px-1.5 text-[0.7rem]"
					>
						{{ props.brawler.rarity.name }}
					</UBadge>
					<div v-else class="mt-1 flex h-5 w-full! flex-row items-center rounded-full">
						<div
							style="animation-duration: 15s !important"
							class="relative inline-block p-px rounded-full ultra-legendary-gradient-bg"
						>
							<div
								style="animation-duration: 15s !important"
								class="ultra-legendary-gradient-bg absolute inset-0 w-full scale-x-[0.99] scale-y-[0.90] rounded-full opacity-20"
							/>
							<span
								class="flex items-center justify-center rounded-full bg-default px-1.5 font-semibold text-white"
							>
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
