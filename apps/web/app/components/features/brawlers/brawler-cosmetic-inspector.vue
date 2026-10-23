<script setup lang="ts">
import BrawlerCosmeticImage from "~/components/features/brawlers/brawler-cosmetic-image.vue";
import {
	brawlerCosmeticSource,
	brawlerSkinCollections,
	brawlerSkinName,
	brawlerSkinRarity,
	type BrawlerCosmetic,
} from "~/utils/brawler-cosmetics";

const props = defineProps<{
	cosmetic?: BrawlerCosmetic;
	cosmetics: BrawlerCosmetic[];
	collection: BrawlerCosmetic[];
	brawlerName: string;
}>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ select: [cosmetic: BrawlerCosmetic] }>();
const { t } = useI18n();
const previewId = ref("");
const zoomed = ref(false);
const returnFocus = shallowRef<HTMLElement>();

const related = computed(() => props.cosmetics.filter((cosmetic) => cosmetic.family === props.cosmetic?.family));
const preview = computed(() => related.value.find((cosmetic) => cosmetic.id === previewId.value) ?? props.cosmetic);
const skin = computed(() => preview.value?.skin);
const detailName = computed(() => skin.value ? brawlerSkinName(skin.value, props.brawlerName) : preview.value?.name ?? "");
const rarity = computed(() => brawlerSkinRarity(skin.value?.rarity));
const collections = computed(() => skin.value ? brawlerSkinCollections(skin.value) : []);
const originalUrl = computed(() => preview.value ? brawlerCosmeticSource(preview.value.asset) : undefined);
const currentIndex = computed(() => props.collection.findIndex((cosmetic) => cosmetic.id === props.cosmetic?.id));

function selectAdjacent(direction: -1 | 1) {
	const cosmetic = props.collection[currentIndex.value + direction];
	if (cosmetic) emit("select", cosmetic);
}

function restoreFocus(event: Event) {
	event.preventDefault();
	if (returnFocus.value?.isConnected) returnFocus.value.focus({ preventScroll: true });
}

watch(open, (isOpen) => {
	if (isOpen && import.meta.client && document.activeElement instanceof HTMLElement) {
		returnFocus.value = document.activeElement;
	}
});
watch(
	() => [props.cosmetic?.id, open.value],
	() => {
		previewId.value = props.cosmetic?.id ?? "";
		zoomed.value = false;
	}
);
watch(previewId, () => { zoomed.value = false; });
</script>

<template>
	<UModal
		v-model:open="open"
		:title="preview?.name || t('page.brawler_cosmetics.title')"
		:description="t('page.brawler_cosmetics.inspect_description', { name: brawlerName })"
		:content="{ onCloseAutoFocus: restoreFocus }"
		close-icon="i-lucide-x"
		:ui="{
			content: 'max-w-5xl',
			header: 'pr-16',
			title: 'font-brawlstars text-2xl wrap-anywhere',
			body: 'p-0 sm:p-0',
			footer: 'justify-between gap-3',
		}"
	>
		<template #close>
			<UButton
				icon="i-lucide-x"
				:aria-label="t('page.brawler_cosmetics.close')"
				color="neutral"
				variant="ghost"
				class="absolute top-4 right-4"
			/>
		</template>
		<template #body>
			<div v-if="cosmetic && preview" class="grid min-w-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" data-testid="cosmetic-inspector">
				<div class="min-w-0 border-b border-default bg-linear-to-b from-primary/5 to-transparent lg:border-r lg:border-b-0">
					<div class="h-80 overflow-auto sm:h-112 lg:h-128" data-testid="cosmetic-preview">
						<BrawlerCosmeticImage
							:src="preview.imageUrl"
							:fallback-src="preview.fallbackUrl"
							:alt="preview.name"
							loading="eager"
							:class="zoomed ? 'h-192 w-192 max-w-none p-8' : 'size-full p-6 sm:p-8'"
						/>
					</div>
					<div class="flex items-center justify-between gap-2 px-4 pb-4">
						<UButton
							:icon="zoomed ? 'i-lucide-zoom-out' : 'i-lucide-zoom-in'"
							:label="t(zoomed ? 'page.brawler_cosmetics.zoom_out' : 'page.brawler_cosmetics.zoom_in')"
							:aria-pressed="zoomed"
							color="neutral"
							variant="soft"
							size="sm"
							data-testid="cosmetic-zoom"
							@click="zoomed = !zoomed"
						/>
						<UButton
							v-if="originalUrl"
							:to="originalUrl"
							target="_blank"
							external
							rel="noopener noreferrer"
							:label="t('page.brawler_cosmetics.original')"
							trailing-icon="i-lucide-arrow-up-right"
							color="neutral"
							variant="link"
							size="sm"
						/>
					</div>
				</div>

				<div class="min-w-0 space-y-6 p-5 sm:p-6">
					<div>
						<p class="text-xs font-medium text-muted">{{ t(skin ? "page.brawler_cosmetics.skin_details" : "page.brawler_cosmetics.cosmetic_details") }}</p>
						<h3 class="mt-2 font-brawlstars text-2xl wrap-anywhere text-highlighted">{{ detailName }}</h3>
						<div class="mt-3 flex flex-wrap items-center gap-2">
							<UBadge v-if="rarity" :color="rarity.color" variant="subtle" size="lg">
								<template #leading><img :src="rarity.icon" alt="" width="24" height="24" class="size-6 object-contain"></template>
								{{ skin?.rarity }}
								</UBadge>
							<UBadge v-if="!skin && preview.rarity" :label="preview.rarity" color="neutral" variant="subtle" />
							<UBadge v-if="skin?.name === 'Default'" :label="t('page.brawler_cosmetics.default_skin')" color="neutral" variant="subtle" />
							<UBadge v-if="skin?.exclusive" :label="t('page.brawler_cosmetics.exclusive')" color="warning" variant="subtle" />
							<UBadge v-if="skin?.seasonal" :label="t('page.brawler_cosmetics.seasonal')" color="secondary" variant="subtle" />
						</div>
					</div>
					<section v-if="collections.length" :aria-label="t('page.brawler_cosmetics.collections')">
						<h4 class="mb-2 text-xs text-muted">{{ t("page.brawler_cosmetics.collections") }}</h4>
						<div class="flex flex-wrap gap-2">
							<UBadge v-for="collectionName in collections" :key="collectionName" :label="collectionName" color="neutral" variant="subtle" :ui="{ label: 'whitespace-normal wrap-anywhere' }" />
						</div>
					</section>
					<dl v-if="skin" class="space-y-4 border-y border-default py-5">
						<div>
							<dt class="text-xs text-muted">{{ t("page.brawler_cosmetics.cost") }}</dt>
							<dd class="mt-1.5 flex items-start gap-2 text-sm font-semibold leading-6 wrap-anywhere text-highlighted">
								<img v-if="skin?.cost?.includes('Gems')" src="/icons/cosmetics/gems-icon.png" alt="" width="24" height="24" class="size-6 shrink-0 object-contain">
								<img v-else-if="skin?.cost?.includes('Coins')" src="/icons/coins.webp" alt="" width="24" height="24" class="size-6 shrink-0 object-contain">
								{{ skin?.cost || t(skin?.name === "Default" ? "page.brawler_cosmetics.included" : "page.brawler_cosmetics.not_listed") }}
							</dd>
						</div>
					</dl>

					<section v-if="related.length > 1" :aria-label="t('page.brawler_cosmetics.related')">
						<h4 class="mb-3 text-sm font-semibold text-highlighted">{{ t("page.brawler_cosmetics.related") }}</h4>
						<div class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
							<UTooltip v-for="item in related" :key="item.id" :text="item.name">
								<UButton
									:aria-label="t('page.brawler_cosmetics.preview', { name: item.name })"
									:aria-pressed="preview.id === item.id"
									:color="preview.id === item.id ? 'primary' : 'neutral'"
									variant="subtle"
									class="aspect-square min-w-0 justify-center p-2"
									data-testid="related-cosmetic"
									@click="previewId = item.id"
								>
									<BrawlerCosmeticImage :src="item.imageUrl" :fallback-src="item.fallbackUrl" :alt="item.name" class="size-full" />
								</UButton>
							</UTooltip>
						</div>
					</section>
				</div>
			</div>
		</template>
		<template #footer>
			<UButton
				:label="t('page.brawler_cosmetics.previous')"
				icon="i-lucide-chevron-left"
				color="neutral"
				variant="ghost"
				:disabled="currentIndex <= 0"
				data-testid="previous-cosmetic"
				@click="selectAdjacent(-1)"
			/>
			<span class="text-xs tabular-nums text-muted" role="status" aria-live="polite">{{ currentIndex + 1 }} / {{ collection.length }}</span>
			<UButton
				:label="t('page.brawler_cosmetics.next')"
				trailing-icon="i-lucide-chevron-right"
				color="neutral"
				variant="ghost"
				:disabled="currentIndex < 0 || currentIndex >= collection.length - 1"
				data-testid="next-cosmetic"
				@click="selectAdjacent(1)"
			/>
		</template>
	</UModal>
</template>
