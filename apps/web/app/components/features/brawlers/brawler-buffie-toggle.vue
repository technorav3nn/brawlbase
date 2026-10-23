<script setup lang="ts">
import { routes, type Buffie } from "@brawlbase/cdn";
import BrawlerCosmeticImage from "~/components/features/brawlers/brawler-cosmetic-image.vue";
import { brawlerCosmeticSource } from "~/utils/brawler-cosmetics";

const props = defineProps<{
	label: string;
	kind: "gadget" | "starpower" | "hypercharge";
	buffie?: Buffie;
	brawlerId: number;
}>();
const enabled = defineModel<boolean>({ default: false });
const { t } = useI18n();
const colors = { gadget: "success", starpower: "warning", hypercharge: "primary" } as const;
const color = computed(() => colors[props.kind]);
const selectedMode = computed({
	get: () => (enabled.value ? "buffied" : "normal"),
	set: (value: string | number) => {
		enabled.value = value === "buffied";
	},
});
const items = computed(() => [
	{ value: "normal", label: t("page.brawler_info.normal") },
	{ value: "buffied", label: t("page.brawler_info.buffied") },
]);
const selectorUi = computed(() => ({
	list: "rounded-lg border border-default bg-muted/60 p-1 shadow-none!",
	trigger: [
		"h-6 flex-1 gap-1 rounded-md px-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
		enabled.value ? "data-[state=active]:text-primary-950" : "data-[state=active]:text-inverted",
	].join(" "),
	indicator: enabled.value
		? "rounded-md bg-linear-to-r from-primary-200 via-warning-100 to-success-200 shadow-none"
		: "rounded-md shadow-none",
}));
</script>

<template>
	<UTabs
		v-model="selectedMode"
		:aria-label="t('page.brawler_info.buffie_mode', { name: label })"
		:items="items"
		:color="color"
		:content="false"
		:ui="selectorUi"
		role="group"
		size="sm"
		class="w-48 max-w-full shrink-0"
		data-testid="buffie-toggle"
	>
		<template #leading="{ item }">
			<template v-if="item.value === 'buffied'">
				<BrawlerCosmeticImage
					v-if="buffie?.asset"
					:src="routes.brawlers(brawlerId).buffie(buffie.asset.filename)"
					:fallback-src="brawlerCosmeticSource(buffie.asset)"
					alt=""
					class="size-4 shrink-0"
				/>
				<UIcon v-else name="i-lucide-sparkles" class="size-4 shrink-0" aria-hidden="true" />
			</template>
		</template>
	</UTabs>
</template>
