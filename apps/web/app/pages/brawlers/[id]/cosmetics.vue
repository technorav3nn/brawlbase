<script setup lang="ts">
import type { ContentTocLink } from "@nuxt/ui";
import BrawlerCosmeticCard from "~/components/features/brawlers/brawler-cosmetic-card.vue";
import BrawlerCosmeticInspector from "~/components/features/brawlers/brawler-cosmetic-inspector.vue";
import BrawlerSectionHeader from "~/components/features/brawlers/brawler-section-header.vue";
import { useBrawlerStore } from "~/components/features/brawlers/brawler-store";
import BrawlerVoicelines from "~/components/features/brawlers/brawler-voicelines.vue";
import { brawlerCosmetics, type BrawlerCosmetic, type BrawlerCosmeticKind } from "~/utils/brawler-cosmetics";
import { brawlerVoicelines } from "~/utils/brawler-voicelines";

const COSMETIC_KINDS = [
	{ value: "skin", icon: "i-lucide-shirt", label: "skins" },
	{ value: "profileIcon", icon: "i-lucide-square-user-round", label: "profile_icons" },
	{ value: "pet", icon: "i-lucide-orbit", label: "companions" },
	{ value: "pin", icon: "i-lucide-smile", label: "pins" },
	{ value: "spray", icon: "i-lucide-spray-can", label: "sprays" },
	{ value: "buffieSkin", icon: "i-lucide-palette", label: "buffie_skins" },
] as const;

const { brawler, brawlerCdnData: data } = storeToRefs(useBrawlerStore());
const { t } = useI18n();
const search = ref("");
const selectedKind = ref<"all" | "voiceLine" | BrawlerCosmeticKind>("all");
const selectedRarity = ref("all");
const inspectedId = ref<string>();
const inspectorOpen = ref(false);

const brawlerName = computed(() => brawler.value?.name ?? t("page.brawler_tips.brawler"));
const cosmetics = computed(() =>
	brawler.value ? brawlerCosmetics(brawler.value.id, brawlerName.value, data.value?.skins ?? [], data.value ?? undefined) : []
);
const voiceLines = computed(() => (brawler.value && data.value ? brawlerVoicelines(brawler.value.id, data.value) : []));
const categories = computed(() =>
	COSMETIC_KINDS.map((kind) => ({
		...kind,
		label: t(`page.brawler_cosmetics.${kind.label}`),
		badge: cosmetics.value.filter((cosmetic) => cosmetic.kind === kind.value).length,
	})).filter((kind) => kind.badge > 0)
);
const categoryItems = computed(() => [
	{ value: "all", label: t("page.brawler_cosmetics.all"), icon: "i-lucide-layout-grid" },
	...categories.value.map(({ value, label, icon }) => ({ value, label, icon })),
	...(voiceLines.value.length
		? [{ value: "voiceLine", label: t("page.brawler_cosmetics.voice_lines"), icon: "i-lucide-mic" }]
		: []),
]);
const rarityItems = computed(() => [
	{ value: "all", label: t("page.brawler_cosmetics.all_rarities") },
	...[...new Set((data.value?.skins ?? []).map((skin) => skin.rarity ?? "other"))].map((rarity) => ({
		value: rarity,
		label: rarity === "other" ? t("page.brawler_cosmetics.default_other") : rarity,
	})),
]);
const query = computed(() => search.value.trim().toLowerCase());
const hasFilters = computed(() => Boolean(query.value) || selectedKind.value !== "all" || selectedRarity.value !== "all");
const visibleCosmetics = computed(() =>
	cosmetics.value.filter(
		(cosmetic) =>
			(selectedKind.value === "all" || cosmetic.kind === selectedKind.value) &&
			(selectedRarity.value === "all" || (cosmetic.skin?.rarity ?? "other") === selectedRarity.value) &&
			[cosmetic.name, cosmetic.skin?.name, cosmetic.skin?.campaign].some((text) =>
				text?.toLowerCase().includes(query.value)
			)
	)
);
const visibleVoiceLines = computed(() =>
	(selectedKind.value === "all" || selectedKind.value === "voiceLine") && selectedRarity.value === "all"
		? voiceLines.value.filter((line) =>
				[line.description, line.trigger, line.variant].some((text) => text?.toLowerCase().includes(query.value))
			)
		: []
);
const totalCount = computed(() => cosmetics.value.length + voiceLines.value.length);
const visibleCount = computed(() => visibleCosmetics.value.length + visibleVoiceLines.value.length);
const groups = computed(() =>
	categories.value
		.map((category) => ({
			...category,
			items: visibleCosmetics.value.filter((cosmetic) => cosmetic.kind === category.value),
		}))
		.filter((group) => group.items.length > 0)
);
const inspectionCollection = computed(() => groups.value.flatMap((group) => group.items));
const inspectedCosmetic = computed(() => cosmetics.value.find((cosmetic) => cosmetic.id === inspectedId.value));
const tocLinks = computed<ContentTocLink[]>(() => [
	...groups.value.map((group) => ({ id: `cosmetics-${group.value}`, depth: 2, text: group.label })),
	...(visibleVoiceLines.value.length
		? [{ id: "cosmetics-voiceLine", depth: 2, text: t("page.brawler_cosmetics.voice_lines") }]
		: []),
]);
const source = computed(() => (data.value?.attribution.startsWith("https://") ? data.value.attribution : undefined));

function inspect(cosmetic: BrawlerCosmetic) {
	inspectedId.value = cosmetic.id;
	inspectorOpen.value = true;
}

function resetFilters() {
	search.value = "";
	selectedKind.value = "all";
	selectedRarity.value = "all";
}

watch(
	() => brawler.value?.id,
	() => {
		resetFilters();
		inspectorOpen.value = false;
		inspectedId.value = undefined;
	}
);
watch(selectedKind, (kind) => {
	if (kind === "voiceLine") selectedRarity.value = "all";
});
useSeoMeta({
	title: () => `${brawlerName.value} ${t("page.brawler_cosmetics.title")} | BrawlBase`,
	description: () => t("page.brawler_cosmetics.description", { name: brawlerName.value }),
});
</script>

<template>
	<div class="pt-3 pb-16" data-testid="cosmetics-page">
		<BrawlerSectionHeader
			:title="t('page.brawler_cosmetics.title')"
			:description="t('page.brawler_cosmetics.description', { name: brawlerName })"
			icon="i-lucide-palette"
		/>

		<div
			v-if="brawler && data"
			class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_10rem] xl:gap-8 xl:grid-cols-[minmax(0,1fr)_11rem]"
		>
			<aside v-if="tocLinks.length" class="min-w-0 lg:sticky lg:top-36 lg:col-start-2 lg:row-start-1">
				<UContentToc
					:links="tocLinks"
					:title="t('page.brawler_info.on_this_page')"
					:aria-label="t('page.brawler_info.on_this_page')"
					trailing-icon="i-lucide-chevron-down"
					highlight
					data-testid="cosmetics-toc"
					:ui="{
						root: 'static mx-0 max-h-none overflow-visible bg-transparent px-0 backdrop-blur-none sm:mx-0 sm:px-0 lg:mx-0',
						container: 'border-0 pt-0 pb-0 sm:pt-0 sm:pb-0 lg:py-0',
						content: 'lg:min-h-0',
						linkText: 'whitespace-normal',
					}"
				/>
			</aside>
			<div class="min-w-0 lg:col-start-1 lg:row-start-1">
				<template v-if="totalCount">
					<UCard variant="subtle" class="mb-7" :ui="{ body: 'flex flex-wrap items-end gap-4 p-4 sm:p-5' }">
						<UFormField :label="t('page.brawler_cosmetics.category')" class="w-full sm:w-56">
							<USelect
								v-model="selectedKind"
								:items="categoryItems"
								trailing-icon="i-lucide-chevron-down"
								selected-icon="i-lucide-check"
								class="w-full"
								data-testid="cosmetic-category-select"
							/>
						</UFormField>
						<UFormField :label="t('page.brawler_cosmetics.search')" class="w-full min-w-0 flex-1 sm:min-w-56">
							<UInput
								v-model="search"
								icon="i-lucide-search"
								:placeholder="t('page.brawler_cosmetics.search_placeholder')"
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
										:aria-label="t('page.brawler_cosmetics.clear_search')"
										@click="search = ''"
									/>
								</template>
							</UInput>
						</UFormField>
						<UFormField :label="t('page.brawler_cosmetics.skin_rarity')" class="w-full sm:w-52">
							<USelect
								v-model="selectedRarity"
								:items="rarityItems"
								:disabled="selectedKind === 'voiceLine'"
								trailing-icon="i-lucide-chevron-down"
								selected-icon="i-lucide-check"
								class="w-full"
								data-testid="cosmetic-rarity"
							/>
						</UFormField>
					</UCard>
					<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
						<p class="text-sm text-muted" role="status" aria-live="polite">
							{{ t("page.brawler_cosmetics.showing", { shown: visibleCount, total: totalCount }) }}
						</p>
						<UButton
							v-if="hasFilters"
							:label="t('page.brawler_cosmetics.reset')"
							trailing-icon="i-lucide-x"
							variant="ghost"
							size="sm"
							data-testid="reset-cosmetic-filters"
							@click="resetFilters"
						/>
					</div>
					<div v-if="visibleCount" class="space-y-10">
						<section
							v-for="group in groups"
							:id="`cosmetics-${group.value}`"
							:key="group.value"
							:aria-label="group.label"
							:data-category="group.value"
							class="scroll-mt-36"
						>
							<header class="mb-4 flex items-center gap-3">
								<h3 class="font-brawlstars text-2xl text-highlighted">{{ group.label }}</h3>
								<UBadge :label="group.items.length" color="neutral" variant="subtle" />
							</header>
							<div
								:class="
									group.value === 'skin' || group.value === 'pet'
										? 'grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
										: 'grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'
								"
							>
								<BrawlerCosmeticCard
									v-for="cosmetic in group.items"
									:key="cosmetic.id"
									:cosmetic="cosmetic"
									@inspect="inspect"
								/>
							</div>
						</section>
						<section
							v-if="visibleVoiceLines.length"
							id="cosmetics-voiceLine"
							:aria-label="t('page.brawler_cosmetics.voice_lines')"
							data-category="voiceLine"
							class="scroll-mt-36"
						>
							<header class="mb-4 flex items-center gap-3">
								<UIcon name="i-lucide-mic" class="size-6 text-primary" aria-hidden="true" />
								<h3 class="font-brawlstars text-2xl text-highlighted">
									{{ t("page.brawler_cosmetics.voice_lines") }}
								</h3>
								<UBadge :label="visibleVoiceLines.length" color="neutral" variant="subtle" />
							</header>
							<BrawlerVoicelines :lines="visibleVoiceLines" />
						</section>
					</div>
					<UEmpty
						v-else
						icon="i-lucide-search-x"
						:title="t('page.brawler_cosmetics.no_matches')"
						:description="t('page.brawler_cosmetics.try_filters')"
						data-testid="cosmetics-empty"
					>
						<template #actions
							><UButton
								:label="t('page.brawler_cosmetics.reset')"
								color="neutral"
								variant="outline"
								@click="resetFilters"
						/></template>
					</UEmpty>
				</template>
				<UEmpty
					v-else
					icon="i-lucide-image"
					:title="t('page.brawler_cosmetics.no_cosmetics')"
					:description="t('page.brawler_cosmetics.not_available', { name: brawlerName })"
				/>

				<UButton
					v-if="source"
					:to="source"
					target="_blank"
					external
					rel="noopener noreferrer"
					:label="t('page.brawler_cosmetics.source')"
					trailing-icon="i-lucide-arrow-up-right"
					color="neutral"
					variant="link"
					size="sm"
					class="mt-6 px-0"
				/>
			</div>
		</div>
		<div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" role="status" aria-busy="true">
			<span class="sr-only">{{ t("page.brawler_cosmetics.loading") }}</span>
			<USkeleton v-for="index in 8" :key="index" class="h-80 rounded-lg" />
		</div>
		<BrawlerCosmeticInspector
			v-if="brawler"
			v-model:open="inspectorOpen"
			:cosmetic="inspectedCosmetic"
			:cosmetics="cosmetics"
			:collection="inspectionCollection"
			:brawler-name="brawlerName"
			@select="inspect"
		/>
	</div>
</template>
