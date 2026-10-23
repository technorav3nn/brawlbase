<script setup lang="ts">
import BrawlerVoiceline from "~/components/features/brawlers/brawler-voiceline.vue";
import type { BrawlerVoiceline as VoiceLine } from "~/utils/brawler-voicelines";

const props = defineProps<{ lines: VoiceLine[] }>();
const { t } = useI18n();
const selectedVariant = ref("all");
const selectedTrigger = ref("all");
const variants = computed(() => [
	{ value: "all", label: t("page.brawler_cosmetics.all_voices") },
	...[...new Set(props.lines.map((line) => line.variant || "Normal"))].map((variant) => ({
		value: variant,
		label: variant === "Normal" ? t("page.brawler_info.normal") : variant,
	})),
]);
const variantLines = computed(() => props.lines.filter((line) =>
	selectedVariant.value === "all" || (line.variant || "Normal") === selectedVariant.value
));
const triggerItems = computed(() => [
	{ value: "all", label: t("page.brawler_cosmetics.all_triggers") },
	...[...new Set(variantLines.value.map((line) => line.trigger || t("page.brawler_cosmetics.other_voices")))].map((trigger) => ({ value: trigger, label: trigger })),
]);
const groups = computed(() => {
	const triggers = new Map<string, VoiceLine[]>();
	for (const line of variantLines.value) {
		const trigger = line.trigger || t("page.brawler_cosmetics.other_voices");
		if (selectedTrigger.value !== "all" && trigger !== selectedTrigger.value) continue;
		const entries = triggers.get(trigger) ?? [];
		entries.push(line);
		triggers.set(trigger, entries);
	}
	return [...triggers].map(([label, lines]) => ({ label, value: label, lines }));
});

function triggerIcon(trigger: string) {
	if (/start|begin|spawn|lead/i.test(trigger)) return "i-lucide-flag";
	if (/defeat|kill|win|victory/i.test(trigger)) return "i-lucide-trophy";
	if (/hurt|hit|damage/i.test(trigger)) return "i-lucide-heart-pulse";
	if (/super|ability/i.test(trigger)) return "i-lucide-zap";
	if (/laugh|happy/i.test(trigger)) return "i-lucide-smile";
	if (/die|death|dying/i.test(trigger)) return "i-lucide-skull";
	return "i-lucide-message-circle";
}
watch(variants, (items) => {
	if (!items.some((item) => item.value === selectedVariant.value)) selectedVariant.value = "all";
});
watch(triggerItems, (items) => {
	if (!items.some((item) => item.value === selectedTrigger.value)) selectedTrigger.value = "all";
});
</script>

<template>
	<div data-testid="voicelines-panel">
		<div class="mb-7 flex flex-wrap items-end justify-between gap-4">
			<p class="max-w-sm text-sm leading-6 text-muted">{{ t('page.brawler_cosmetics.voice_description') }}</p>
			<div class="flex w-full flex-wrap items-end gap-3 sm:w-auto">
				<UFormField v-if="variants.length > 2" :label="t('page.brawler_cosmetics.voice_variant')" class="w-full sm:w-44">
					<USelect v-model="selectedVariant" :items="variants" icon="i-lucide-mic" trailing-icon="i-lucide-chevron-down" selected-icon="i-lucide-check" class="w-full" data-testid="voice-variant" />
				</UFormField>
				<UFormField :label="t('page.brawler_cosmetics.voice_trigger')" class="w-full sm:w-52">
					<USelectMenu v-model="selectedTrigger" :items="triggerItems" value-key="value" icon="i-lucide-list-filter" trailing-icon="i-lucide-chevron-down" selected-icon="i-lucide-check" class="w-full" data-testid="voice-trigger" />
				</UFormField>
			</div>
		</div>
		<div class="space-y-8">
			<section v-for="group in groups" :key="group.value" :aria-label="group.label">
				<header class="mb-3 flex items-center gap-3">
					<span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon :name="triggerIcon(group.label)" class="size-4" aria-hidden="true" /></span>
					<h4 class="font-brawlstars text-xl leading-tight text-highlighted">{{ group.label }}</h4>
					<span class="min-w-4 flex-1 border-t border-default" aria-hidden="true" />
					<span class="text-xs tabular-nums text-muted">{{ group.lines.length }}</span>
				</header>
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					<BrawlerVoiceline v-for="line in group.lines" :key="line.id" :line="line" :show-variant="selectedVariant === 'all' && variants.length > 2" tile />
				</div>
			</section>
		</div>
	</div>
</template>
