<script setup lang="ts">
import BrawlerCosmeticImage from "~/components/features/brawlers/brawler-cosmetic-image.vue";
import { brawlerSkinCollections, brawlerSkinRarity, type BrawlerCosmetic } from "~/utils/brawler-cosmetics";

const props = defineProps<{ cosmetic: BrawlerCosmetic }>();
const emit = defineEmits<{ inspect: [cosmetic: BrawlerCosmetic] }>();
const { t } = useI18n();
const isModel = computed(() => props.cosmetic.kind === "skin" || props.cosmetic.kind === "pet");
const rarity = computed(() => brawlerSkinRarity(props.cosmetic.rarity));
const collections = computed(() => props.cosmetic.skin ? brawlerSkinCollections(props.cosmetic.skin) : []);
</script>

<template>
	<UCard
		as="article"
		variant="subtle"
		class="group relative min-w-0 overflow-hidden"
		:ui="{ body: 'p-0 sm:p-0' }"
		data-testid="cosmetic-card"
		:data-kind="cosmetic.kind"
	>
		<div class="relative bg-linear-to-b from-primary/5 to-transparent p-4" :class="isModel ? 'h-48 sm:h-64' : 'h-28 sm:h-36'">
			<BrawlerCosmeticImage
				:src="cosmetic.imageUrl"
				:fallback-src="cosmetic.fallbackUrl"
				:alt="cosmetic.name"
				class="size-full motion-safe:transition-transform motion-safe:group-hover:scale-105"
			/>
			<div v-if="cosmetic.kind === 'skin' && (cosmetic.skin?.exclusive || cosmetic.skin?.seasonal)" class="absolute top-3 right-3 flex gap-1.5">
				<img v-if="cosmetic.skin?.exclusive" src="/icons/cosmetics/exclusive-skin-icon.png" :alt="t('page.brawler_cosmetics.exclusive')" width="24" height="24" class="size-6 object-contain">
				<img v-if="cosmetic.skin?.seasonal" src="/icons/cosmetics/seasonal-skin-icon.png" :alt="t('page.brawler_cosmetics.seasonal')" width="24" height="24" class="size-6 object-contain">
			</div>
		</div>
		<div class="border-t border-default p-3 sm:p-4">
			<div v-if="cosmetic.kind === 'skin'" class="mb-2 flex min-h-6 items-center gap-1.5 text-xs text-muted">
				<img v-if="rarity" :src="rarity.icon" alt="" width="24" height="24" class="size-6 shrink-0 object-contain">
				<span>{{ cosmetic.rarity || t(cosmetic.skin?.name === "Default" ? "page.brawler_cosmetics.default_skin" : "page.brawler_cosmetics.other_rarity") }}</span>
			</div>
			<UBadge v-if="cosmetic.kind !== 'skin' && cosmetic.rarity" :label="cosmetic.rarity" color="neutral" variant="subtle" size="sm" class="mb-2" />
			<h3 class="pr-5 font-brawlstars leading-tight wrap-anywhere text-highlighted" :class="isModel ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'">
				{{ cosmetic.name }}
			</h3>
			<dl v-if="cosmetic.kind === 'skin' && collections.length" class="mt-3 space-y-1.5" data-testid="skin-collections">
				<dt class="text-xs text-muted">{{ t("page.brawler_cosmetics.collections") }}</dt>
				<dd class="flex flex-wrap gap-1.5">
					<UBadge v-for="collection in collections" :key="collection" :label="collection" color="neutral" variant="subtle" size="sm" :ui="{ label: 'whitespace-normal wrap-anywhere' }" />
				</dd>
			</dl>
			<p v-if="cosmetic.kind === 'skin' && cosmetic.skin?.cost" class="mt-2 text-xs leading-5 wrap-anywhere text-muted">{{ cosmetic.skin?.cost }}</p>
			<UIcon name="i-lucide-expand" class="absolute right-3 bottom-4 size-4 text-dimmed sm:right-4" aria-hidden="true" />
		</div>
		<UButton
			:aria-label="t('page.brawler_cosmetics.inspect', { name: cosmetic.name })"
			color="neutral"
			variant="ghost"
			class="absolute inset-0 z-10 rounded-[inherit] p-0 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
			@click="emit('inspect', cosmetic)"
		/>
	</UCard>
</template>
