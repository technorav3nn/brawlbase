<script setup lang="ts">
import type { Attack } from "@brawlbase/cdn";
import { brawlerAbilityStats } from "~/utils/brawler-stats";

const props = defineProps<{ ability?: Attack; kind: "attack" | "super"; level: number }>();
const label = computed(() => (props.kind === "attack" ? "Attack" : "Super"));
const stats = computed(() => {
	if (!props.ability) return [];
	const levelStatCount = props.ability.statsByLevel.length;
	return brawlerAbilityStats(props.ability, props.level).map((stat, index) => ({
		...stat,
		levelDependent: index < levelStatCount,
	}));
});
</script>

<template>
	<UCard
		as="article"
		:data-testid="`ability-${kind}`"
		variant="subtle"
		:class="
			kind === 'attack' ? 'bg-linear-to-br from-error/5 to-transparent' : 'bg-linear-to-br from-warning/5 to-transparent'
		"
		:ui="{ body: 'p-5 sm:p-6' }"
	>
		<header>
			<p
				class="flex items-center gap-2 text-base font-brawlstars uppercase"
				:class="kind === 'attack' ? 'text-error' : 'text-warning'"
			>
				<img
					:src="kind === 'attack' ? '/icons/damage-icon.png' : '/icons/super-icon-2.png'"
					alt=""
					width="50"
					height="50"
					class="size-9 object-contain"
				/>
				{{ label }}
			</p>
			<h3 class="mt-2 font-brawlstars text-xl leading-tight wrap-anywhere text-highlighted">
				{{ ability?.name || label }}
			</h3>
		</header>
		<p class="mt-3 text-sm leading-6 text-muted">{{ ability?.description || "Ability details are not available yet." }}</p>
		<dl v-if="stats.length" class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-default pt-3 sm:grid-cols-3">
			<div v-for="stat in stats" :key="stat.label" class="min-w-0">
				<dt class="text-[11px] leading-4 text-muted">{{ stat.label }}</dt>
				<dd class="mt-0.5 text-xs font-semibold leading-4 wrap-anywhere whitespace-pre-line text-highlighted">
					<UTooltip v-if="stat.levelDependent" text="This value changes with the Power level dropdown.">
						<span tabindex="0" class="underline decoration-dotted underline-offset-2">
							{{ stat.value }}
						</span>
					</UTooltip>
					<span v-else>{{ stat.value }}</span>
				</dd>
			</div>
		</dl>
	</UCard>
</template>
