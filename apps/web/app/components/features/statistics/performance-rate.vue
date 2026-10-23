<script setup lang="ts">
const props = defineProps<{
	label: string;
	value: number | null | undefined;
	kind: "win" | "use";
}>();
const { locale } = useI18n();
const formatted = computed(() =>
	props.value == null
		? "—"
		: new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }).format(props.value)
);
const color = computed(() => (props.kind === "use" ? "secondary" : (props.value ?? 0) >= 0.5 ? "success" : "warning"));
</script>
<template>
	<div class="min-w-0 space-y-1.5">
		<div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
			<span class="text-[11px] leading-4 text-muted">{{ label }}</span>
			<span class="font-brawlstars text-xl leading-none tabular-nums text-highlighted">{{ formatted }}</span>
		</div>
		<UProgress v-if="value != null" :model-value="value * 100" :max="100" :color="color" size="2xs" :aria-label="label" />
		<div v-else class="h-0.5 rounded-full bg-accented/50" aria-hidden="true" />
	</div>
</template>
