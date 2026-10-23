<script setup lang="ts">
import BrawlerHighlightedText from "~/components/features/brawlers/brawler-highlighted-text.vue";
import BrawlerSectionHeader from "~/components/features/brawlers/brawler-section-header.vue";
import { useBrawlerStore } from "~/components/features/brawlers/brawler-store";
import { groupBrawlerHistory, normalizeBrawlerHistory, type BrawlerChangeKind } from "~/utils/brawler-history";

const KIND_APPEARANCE = {
	Buff: { icon: "i-lucide-trending-up", color: "success", edge: "border-l-success/70", summary: "bg-success/5" },
	Nerf: { icon: "i-lucide-trending-down", color: "error", edge: "border-l-error/70", summary: "bg-error/5" },
	Neutral: { icon: "i-lucide-refresh-cw", color: "secondary", edge: "border-l-secondary/60", summary: "bg-secondary/5" },
} as const;
const SUMMARY_KINDS = ["Buff", "Nerf", "Neutral"] as const;

const { brawler, brawlerCdnData: data } = storeToRefs(useBrawlerStore());
const { t } = useI18n();
const search = ref("");
const selectedKind = ref<"all" | BrawlerChangeKind>("all");
const selectedYear = ref("all");
const visibleDates = ref(8);

const brawlerName = computed(() => brawler.value?.name ?? t("page.brawler_tips.brawler"));
const query = computed(() => search.value.trim());
const changes = computed(() => normalizeBrawlerHistory(data.value?.history ?? []));
const years = computed(() =>
	[...new Set(changes.value.map((change) => change.year))].sort((a, b) =>
		a === "undated" ? 1 : b === "undated" ? -1 : Number(b) - Number(a)
	)
);
const yearItems = computed(() => [
	{ label: t("page.brawler_changes.all_years"), value: "all" },
	...years.value.map((year) => ({
		label: year === "undated" ? t("page.brawler_changes.undated") : year,
		value: year,
	})),
]);
const counts = computed(() => ({
	Buff: changes.value.filter((change) => change.kind === "Buff").length,
	Nerf: changes.value.filter((change) => change.kind === "Nerf").length,
	Neutral: changes.value.filter((change) => change.kind === "Neutral").length,
}));
const kindLabels = computed(() => ({
	Buff: t("page.brawler_changes.buff"),
	Nerf: t("page.brawler_changes.nerf"),
	Neutral: t("page.brawler_changes.rework"),
}));
const kindPluralLabels = computed(() => ({
	Buff: t("page.brawler_changes.buffs"),
	Nerf: t("page.brawler_changes.nerfs"),
	Neutral: t("page.brawler_changes.reworks"),
}));
const kinds = computed(() => [
	{ value: "all", label: t("page.brawler_changes.all"), icon: "i-lucide-list-filter" },
	...SUMMARY_KINDS.map((kind) => ({
		value: kind,
		label: kindPluralLabels.value[kind],
		icon: KIND_APPEARANCE[kind].icon,
	})),
]);
const filteredChanges = computed(() =>
	changes.value.filter((change) =>
		(selectedKind.value === "all" || change.kind === selectedKind.value)
		&& (selectedYear.value === "all" || change.year === selectedYear.value)
		&& change.description.toLowerCase().includes(query.value.toLowerCase())
	)
);
const groups = computed(() => groupBrawlerHistory(filteredChanges.value));
const shownGroups = computed(() => groups.value.slice(0, visibleDates.value));
const shownCount = computed(() => shownGroups.value.reduce((sum, group) => sum + group.changes.length, 0));
const hasFilters = computed(() => selectedKind.value !== "all" || selectedYear.value !== "all" || Boolean(query.value));
const source = computed(() => (data.value?.attribution.startsWith("https://") ? data.value.attribution : undefined));

function setKind(value: string | number) {
	if (value === "all" || value === "Buff" || value === "Nerf" || value === "Neutral") selectedKind.value = value;
}

function resetFilters() {
	search.value = "";
	selectedKind.value = "all";
	selectedYear.value = "all";
	visibleDates.value = 8;
}

watch([search, selectedKind, selectedYear], () => { visibleDates.value = 8; });
watch(() => brawler.value?.id, resetFilters);
useSeoMeta({
	title: () => `${brawlerName.value} ${t("page.brawler_changes.title")} | BrawlBase`,
	description: () => t("page.brawler_changes.description", { name: brawlerName.value }),
});
</script>

<template>
	<div class="pt-3 pb-16" data-testid="changes-page">
		<BrawlerSectionHeader
			:title="t('page.brawler_changes.title')"
			:description="t('page.brawler_changes.description', { name: brawlerName })"
			icon="i-lucide-scale"
		/>
		<template v-if="brawler && data">
			<template v-if="changes.length">
				<dl class="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
					<UCard
						v-for="kind in SUMMARY_KINDS"
						:key="kind"
						variant="subtle"
						:class="KIND_APPEARANCE[kind].summary"
						:ui="{ body: 'px-2.5 py-3.5 sm:px-5 sm:py-4' }"
					>
						<dt class="flex h-12 items-center sm:h-7">
							<UBadge
								:label="kindPluralLabels[kind]"
								:icon="KIND_APPEARANCE[kind].icon"
								:color="KIND_APPEARANCE[kind].color"
								variant="soft"
								size="sm"
								class="max-w-full"
								:ui="{ label: 'whitespace-normal wrap-anywhere', leadingIcon: 'hidden sm:block' }"
							/>
						</dt>
						<dd class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-brawlstars text-4xl tabular-nums text-highlighted">
							{{ counts[kind] }}
							<span class="hidden font-sans text-xs leading-5 text-muted sm:inline">
								{{ t("page.brawler_changes.recorded_changes") }}
							</span>
						</dd>
					</UCard>
				</dl>

				<UCard variant="subtle" :ui="{ body: 'flex flex-wrap items-end gap-4 p-4 sm:p-5' }">
					<UFormField :label="t('page.brawler_changes.change_type')" class="w-full sm:hidden">
						<USelect
							v-model="selectedKind"
							:items="kinds"
							class="w-full"
							trailing-icon="i-lucide-chevron-down"
							selected-icon="i-lucide-check"
							data-testid="change-type-select"
						/>
					</UFormField>
					<UFormField :label="t('page.brawler_changes.change_type')" class="hidden sm:block">
						<UTabs
							:model-value="selectedKind"
							:items="kinds"
							:content="false"
							variant="pill"
							:aria-label="t('page.brawler_changes.change_type')"
							data-testid="change-type-filter"
							@update:model-value="setKind"
						/>
					</UFormField>
					<UFormField :label="t('page.brawler_changes.search_label')" class="w-full min-w-0 flex-1 sm:min-w-56">
						<UInput
							v-model="search"
							icon="i-lucide-search"
							:placeholder="t('page.brawler_changes.search_placeholder')"
							autocomplete="off"
							class="w-full"
							:ui="{ trailing: 'pe-1.5' }"
						>
							<template v-if="search" #trailing>
								<UButton
									icon="i-lucide-x"
									color="neutral"
									variant="ghost"
									size="xs"
									:aria-label="t('page.brawler_changes.clear_search')"
									@click="search = ''"
								/>
							</template>
						</UInput>
					</UFormField>
					<UFormField :label="t('page.brawler_changes.year')" class="w-full sm:w-40">
						<USelect
							v-model="selectedYear"
							:items="yearItems"
							trailing-icon="i-lucide-chevron-down"
							selected-icon="i-lucide-check"
							class="w-full"
							data-testid="year-filter"
						/>
					</UFormField>
				</UCard>
				<div class="mt-5 mb-7 flex flex-wrap items-center justify-between gap-3">
					<p class="text-sm text-muted" role="status" aria-live="polite">
						{{ t("page.brawler_changes.showing", { shown: shownCount, total: filteredChanges.length }) }}
					</p>
					<UButton
						v-if="hasFilters"
						:label="t('page.brawler_changes.reset_filters')"
						trailing-icon="i-lucide-x"
						variant="ghost"
						size="xs"
						data-testid="reset-filters"
						@click="resetFilters"
					/>
				</div>

				<div v-if="shownGroups.length">
					<section
						v-for="group in shownGroups"
						:key="group.key"
						data-testid="change-date"
						class="relative grid grid-cols-1 gap-3.5 pb-6 pl-5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8 md:pl-0"
						:aria-label="t('page.brawler_changes.changes_on', { date: group.label })"
					>
						<div class="absolute top-3.5 -bottom-3.5 left-1 w-px bg-accented md:top-7 md:left-43" aria-hidden="true" />
						<div class="absolute top-3.5 left-1 size-2.5 -translate-x-1/2 rounded-full border-2 border-primary bg-default md:top-7 md:left-43" aria-hidden="true" />
						<header class="flex flex-wrap items-baseline justify-between gap-1.5 pt-2 md:block md:pt-5">
							<time v-if="group.key !== 'undated'" :datetime="group.key" class="text-sm font-bold text-highlighted">{{ group.label }}</time>
							<span v-else class="text-sm font-bold text-highlighted">{{ t("page.brawler_changes.undated") }}</span>
							<p class="text-xs text-muted md:mt-1.5">{{ t("page.brawler_changes.change_count", group.changes.length) }}</p>
						</header>
						<UCard variant="subtle" class="min-w-0" :ui="{ body: 'divide-y divide-default p-0 sm:p-0' }">
							<article
								v-for="change in group.changes"
								:key="change.id"
								data-testid="change-entry"
								:data-kind="change.kind"
								class="grid grid-cols-1 items-start gap-2.5 border-l-3 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4 md:p-5"
								:class="KIND_APPEARANCE[change.kind].edge"
							>
								<UBadge
									:label="kindLabels[change.kind]"
									:icon="KIND_APPEARANCE[change.kind].icon"
									:color="KIND_APPEARANCE[change.kind].color"
									variant="soft"
									size="sm"
									class="mt-1 w-32 justify-center justify-self-start"
								/>
								<p class="min-w-0 text-sm leading-7 wrap-anywhere whitespace-pre-line text-default">
									<BrawlerHighlightedText :text="change.description" :query="query" emphasize />
								</p>
							</article>
						</UCard>
					</section>
				</div>
				<UEmpty
					v-else
					data-testid="changes-empty"
					icon="i-lucide-search-x"
					:title="t('page.brawler_changes.no_matches')"
					:description="t('page.brawler_changes.try_filters')"
					:ui="{ title: 'font-brawlstars text-2xl' }"
				>
					<template #actions>
						<UButton :label="t('page.brawler_changes.show_all')" color="neutral" variant="outline" @click="resetFilters" />
					</template>
				</UEmpty>
				<div v-if="shownGroups.length < groups.length" class="mt-3 flex flex-col items-center gap-3">
					<UButton
						:label="t('page.brawler_changes.load_older')"
						trailing-icon="i-lucide-arrow-down"
						color="neutral"
						variant="outline"
						size="lg"
						data-testid="load-older"
						@click="visibleDates += 8"
					/>
					<p class="text-xs text-muted">{{ t("page.brawler_changes.more_changes", filteredChanges.length - shownCount) }}</p>
				</div>
			</template>
			<UEmpty
				v-else
				icon="i-lucide-history"
				:title="t('page.brawler_changes.no_history')"
				:description="t('page.brawler_changes.not_listed', { name: brawler.name })"
				:ui="{ title: 'font-brawlstars text-2xl' }"
			/>
			<UButton
				v-if="source && changes.length"
				:to="source"
				target="_blank"
				external
				rel="noopener noreferrer"
				:label="t('page.brawler_changes.source')"
				trailing-icon="i-lucide-arrow-up-right"
				color="neutral"
				variant="link"
				size="xs"
				class="mt-8 px-0"
			/>
		</template>
		<div v-else class="space-y-5" role="status" aria-busy="true">
			<span class="sr-only">{{ t("page.brawler_changes.loading") }}</span>
			<USkeleton v-for="index in 4" :key="index" class="h-32 rounded-lg" />
		</div>
	</div>
</template>
