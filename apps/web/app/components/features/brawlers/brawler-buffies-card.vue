<script setup lang="ts">
const props = defineProps<{ brawlerId: number }>();
const selected = ref("gadget");

// Stable placeholder effects keep SSR and hydration in sync until the CDN supplies Buffies.
const buffies = computed(() => {
	const variation = Math.abs(props.brawlerId) % 3;
	return [
		{
			value: "gadget",
			label: "Gadget",
			icon: "i-lucide-wrench",
			name: "Quick recharge",
			amount: `−${10 + variation * 5}%`,
			stat: "Gadget cooldown",
			description: "Keep your tricks ready. Using your Super reduces the cooldown of your next Gadget.",
			metricClass: "text-success",
		},
		{
			value: "star",
			label: "Star Power",
			icon: "i-lucide-star",
			name: "Second wind",
			amount: `+${10 + variation * 5}%`,
			stat: "Movement speed",
			description: `Stay in the fight. Your Star Power grants a burst of movement speed for ${
				2 + variation
			} seconds after a takedown.`,
			metricClass: "text-warning",
		},
		{
			value: "hyper",
			label: "Hyper",
			icon: "i-lucide-zap",
			name: "Overdrive",
			amount: `+${1 + variation}s`,
			stat: "Hypercharge duration",
			description: "Make the moment count. Landing your Super extends your active Hypercharge for a little longer.",
			metricClass: "text-primary",
		},
	];
});
const activeBuffie = computed(() => buffies.value.find((buffie) => buffie.value === selected.value) ?? buffies.value[0]!);
</script>

<template>
	<section data-testid="buffies" class="border-t border-default pt-7" aria-label="Buffie previews">
		<header class="mb-4 flex flex-wrap items-center gap-3">
			<h2 class="font-brawlstars text-2xl text-highlighted">Buffies</h2>
			<UBadge label="Preview data" icon="i-lucide-flask-conical" color="neutral" variant="subtle" size="sm" />
		</header>
		<UCard variant="subtle" class="bg-linear-to-br from-primary/5 to-transparent" :ui="{ body: 'p-5 sm:p-6' }">
			<UTabs
				v-model="selected"
				:items="buffies"
				:content="false"
				size="sm"
				class="w-full sm:max-w-sm"
				aria-label="Choose a Buffie preview"
				:ui="{ list: 'w-full', trigger: 'min-w-0 px-2 py-2', leadingIcon: 'size-4' }"
			/>
			<div class="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" aria-live="polite">
				<div>
					<h3 class="text-sm font-semibold text-highlighted">{{ activeBuffie.name }}</h3>
					<p class="mt-1.5 text-sm leading-6 text-muted">{{ activeBuffie.description }}</p>
				</div>
				<dl>
					<dt class="text-[11px] text-muted">{{ activeBuffie.stat }}</dt>
					<dd class="mt-1 font-brawlstars text-3xl whitespace-nowrap" :class="activeBuffie.metricClass">
						{{ activeBuffie.amount }}
					</dd>
				</dl>
			</div>
			<p class="mt-5 flex items-start gap-1.5 text-xs leading-5 text-muted">
				<UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0" /> Sample effects for preview. These are not live
				game stats.
			</p>
		</UCard>
	</section>
</template>
