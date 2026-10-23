<script setup lang="ts">
import { SUPPORTED_MODES, TROPHY_RANGES, type StatsFilters, type TrophyRange } from "@brawlbase/tracker";
const days = defineModel<StatsFilters["days"]>("days", { required: true });
const mode = defineModel<string>("mode", { required: true });
const trophyRange = defineModel<TrophyRange | "all">("trophyRange", { required: true });
const endDate = defineModel<string>("endDate", { required: true });
const { t } = useI18n();
const today = useState("performance-today", () => new Date().toISOString().slice(0, 10));
const periods = computed(() => [
	{ label: t("page.brawler_stats.today"), value: 1 },
	{ label: t("page.brawler_stats.days", { count: 7 }), value: 7 },
	{ label: t("page.brawler_stats.days", { count: 30 }), value: 30 },
]);
const modes = computed(() => [
	{ label: t("page.brawler_stats.all_modes"), value: "all" },
	...SUPPORTED_MODES.map((value) => ({ label: t(`page.brawler_stats.modes.${value}`), value })),
]);
const trophies = computed(() => [
	{ label: t("page.performance.all_ranges"), value: "all" as const },
	...TROPHY_RANGES.map((value) => ({ label: value, value })),
]);
</script>
<template>
	<div class="flex flex-wrap items-end gap-3 rounded-xl border border-default bg-elevated p-3">
		<UFormField :label="t('page.performance.trophy_range')" class="min-w-0 grow basis-64">
			<div role="group" :aria-label="t('page.performance.trophy_range')" class="flex gap-1 rounded-lg bg-muted p-1">
				<UButton
					v-for="option in trophies"
					:key="option.value"
					:label="option.label"
					:aria-pressed="trophyRange === option.value"
					:color="trophyRange === option.value ? 'primary' : 'neutral'"
					:variant="trophyRange === option.value ? 'soft' : 'ghost'"
					size="xs"
					class="shrink-0 grow justify-center px-2 whitespace-nowrap"
					@click="trophyRange = option.value"
				/>
			</div>
		</UFormField>
		<UFormField :label="t('page.brawler_stats.period')" class="min-w-0 grow basis-32">
			<USelect v-model="days" :items="periods" class="w-full" />
		</UFormField>
		<UFormField :label="t('page.brawler_stats.mode')" class="min-w-0 grow basis-40">
			<USelect v-model="mode" :items="modes" class="w-full" />
		</UFormField>
		<UFormField :label="t('page.performance.period_ending')" class="min-w-0 grow basis-40">
			<UInput v-model="endDate" type="date" :max="today" class="w-full" />
		</UFormField>
		<UTooltip :text="t('page.performance.trophy_note')">
			<UButton icon="i-lucide-info" :aria-label="t('page.performance.trophy_range')" color="neutral" variant="ghost" />
		</UTooltip>
		<slot />
	</div>
</template>
