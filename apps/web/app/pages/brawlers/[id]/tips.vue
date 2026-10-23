<script setup lang="ts">
import { routes } from "@brawlbase/cdn";
import BrawlerHighlightedText from "~/components/features/brawlers/brawler-highlighted-text.vue";
import { useBrawlerStore } from "~/components/features/brawlers/brawler-store";
import { brawlerStatText } from "~/utils/brawler-stats";
import { cdnUrl } from "~/utils/cdn-url";

const { brawler, brawlerCdnData: data } = storeToRefs(useBrawlerStore());
const { t } = useI18n();
const search = ref("");
const query = computed(() => search.value.trim());
const brawlerName = computed(() => brawler.value?.name ?? t("page.brawler_tips.brawler"));
const accessories = computed(() => [
	...(data.value?.gadgets ?? []).map((gadget) => ({
		id: `gadget-${gadget.id}`,
		name: gadget.name,
		icon: cdnUrl(routes.gadgetIcon(Number(gadget.id))),
	})),
	...(data.value?.starpowers ?? []).map((starPower) => ({
		id: `starpower-${starPower.id}`,
		name: starPower.name,
		icon: cdnUrl(routes.starPowerIcon(Number(starPower.id))),
	})),
]);
const tips = computed(() =>
	(data.value?.tips ?? [])
		.map((text, index) => {
			const plainText = brawlerStatText(text);
			return {
				text: plainText,
				number: index + 1,
				accessories: accessories.value.filter((accessory) =>
					plainText.toLowerCase().includes(accessory.name.toLowerCase())
				),
			};
		})
		.filter((tip) => tip.text)
);
const abilityFilters = computed(() =>
	accessories.value.filter((accessory) => tips.value.some((tip) => tip.accessories.includes(accessory)))
);
const visibleTips = computed(() => tips.value.filter((tip) => tip.text.toLowerCase().includes(query.value.toLowerCase())));
const source = computed(() => (data.value?.attribution.startsWith("https://") ? data.value.attribution : undefined));

function toggleAbility(name: string) {
	search.value = query.value.toLowerCase() === name.toLowerCase() ? "" : name;
}

watch(
	() => brawler.value?.id,
	() => {
		search.value = "";
	}
);
useSeoMeta({
	title: () => `${t("page.brawler_tips.title", { name: brawlerName.value })} | BrawlBase`,
	description: () => t("page.brawler_tips.description", { name: brawlerName.value }),
});
</script>

<template>
	<div class="pt-3 pb-16" data-testid="tips-page">
		<header class="mb-6 flex flex-wrap items-end justify-between gap-0">
			<FeaturesBrawlersBrawlerSectionHeader
				class="w-full"
				:title="t('page.brawler_tips.title', { name: brawlerName })"
				:description="t('page.brawler_tips.description', { name: brawlerName })"
				icon="i-lucide-book-open"
			/>
			<UFormField
				v-if="tips.length"
				:label="t('page.brawler_tips.search_label')"
				class="w-full sm:w-80"
				:ui="{ label: 'sr-only', container: 'mt-0' }"
			>
				<UInput
					v-model="search"
					icon="i-lucide-search"
					:placeholder="t('page.brawler_tips.search_placeholder')"
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
							:aria-label="t('page.brawler_tips.clear_search')"
							@click="search = ''"
						/>
					</template>
				</UInput>
			</UFormField>
		</header>

		<template v-if="brawler && data">
			<div
				v-if="tips.length"
				class="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-y border-default py-4"
			>
				<div
					v-if="abilityFilters.length"
					class="flex min-w-0 flex-wrap items-center gap-2"
					:aria-label="t('page.brawler_tips.ability_filters')"
				>
					<UButton
						:label="t('page.brawler_tips.all_tips')"
						:color="!query ? 'primary' : 'neutral'"
						:variant="!query ? 'solid' : 'soft'"
						:aria-pressed="!query"
						size="sm"
						class="h-11"
						@click="search = ''"
					/>
					<UButton
						v-for="ability in abilityFilters"
						:key="ability.id"
						:label="ability.name"
						:color="query.toLowerCase() === ability.name.toLowerCase() ? 'primary' : 'neutral'"
						:variant="query.toLowerCase() === ability.name.toLowerCase() ? 'solid' : 'soft'"
						:aria-pressed="query.toLowerCase() === ability.name.toLowerCase()"
						size="sm"
						data-testid="tip-ability-filter"
						class="max-w-full text-left whitespace-normal"
						:ui="{ label: 'wrap-anywhere' }"
						@click="toggleAbility(ability.name)"
					>
						<template #leading>
							<img :src="ability.icon" alt="" width="28" height="28" class="size-7 shrink-0 object-contain" >
						</template>
					</UButton>
				</div>
				<p class="shrink-0 text-sm text-muted" role="status" aria-live="polite">
					{{
						query
							? t("page.brawler_tips.matching_count", { shown: visibleTips.length, total: tips.length })
							: t("page.brawler_tips.tip_count", tips.length)
					}}
				</p>
			</div>

			<UPageColumns v-if="visibleTips.length" class="gap-5 space-y-5 md:columns-1 lg:columns-2">
				<UCard
					v-for="tip in visibleTips"
					:key="tip.number"
					as="article"
					variant="subtle"
					data-testid="tip-card"
					:ui="{ body: 'p-5 sm:p-6' }"
				>
					<div v-if="tip.accessories.length" class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
						<span
							v-for="accessory in tip.accessories"
							:key="accessory.id"
							class="flex min-w-0 items-center gap-2 text-sm font-semibold text-highlighted"
						>
							<img
								:src="accessory.icon"
								alt=""
								width="32"
								height="32"
								loading="lazy"
								class="size-8 shrink-0 object-contain"
							>
							{{ accessory.name }}
						</span>
					</div>
					<p data-testid="tip-text" class="text-base leading-7 wrap-anywhere whitespace-pre-line text-default">
						<BrawlerHighlightedText :text="tip.text" :query="query" emphasize />
					</p>
				</UCard>
			</UPageColumns>
			<UEmpty
				v-else
				data-testid="tips-empty"
				:icon="tips.length ? 'i-lucide-search-x' : 'i-lucide-book-open'"
				:title="tips.length ? t('page.brawler_tips.no_matches') : t('page.brawler_tips.no_tips')"
				:description="
					tips.length ? t('page.brawler_tips.try_search') : t('page.brawler_tips.not_listed', { name: brawlerName })
				"
			>
				<template v-if="query" #actions>
					<UButton :label="t('page.brawler_tips.show_all')" color="neutral" variant="outline" @click="search = ''" />
				</template>
			</UEmpty>
			<UButton
				v-if="source && tips.length"
				:to="source"
				target="_blank"
				external
				rel="noopener noreferrer"
				:label="t('page.brawler_tips.source')"
				trailing-icon="i-lucide-arrow-up-right"
				color="neutral"
				variant="link"
				size="sm"
				class="mt-6 px-0"
			/>
		</template>
		<div v-else class="grid gap-5 lg:grid-cols-2" role="status" aria-busy="true">
			<span class="sr-only">{{ t("page.brawler_tips.loading") }}</span>
			<USkeleton v-for="index in 4" :key="index" class="h-56 rounded-lg" />
		</div>
	</div>
</template>
