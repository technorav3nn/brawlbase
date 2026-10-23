<script setup lang="ts">
import type { Buffie, Hypercharge } from "@brawlbase/cdn";
import { routes } from "@brawlbase/cdn";
import BrawlerBuffieEffect from "~/components/features/brawlers/brawler-buffie-effect.vue";
import BrawlerBuffieText from "~/components/features/brawlers/brawler-buffie-text.vue";
import BrawlerBuffieToggle from "~/components/features/brawlers/brawler-buffie-toggle.vue";
import BrawlerUpgradeIcon from "~/components/features/brawlers/brawler-upgrade-icon.vue";
import { brawlerAbilityBuffie } from "~/utils/brawler-buffies";
import { brawlerStatText } from "~/utils/brawler-stats";

const BOOSTS = [
	{ label: "Speed", translation: "page.brawler_info.speed", icon: "/icons/speed-icon.png" },
	{ label: "Damage", translation: "page.brawler_info.damage", icon: "/icons/damage-icon.png" },
	{ label: "Shield", translation: "page.brawler_info.shield", icon: "/icons/shield-icon.png" },
];

const props = withDefaults(defineProps<{ hypercharge?: Hypercharge; brawlerId: number; buffies?: Buffie[] }>(), {
	hypercharge: undefined,
	buffies: () => [],
});
const { t } = useI18n();
const buffied = ref(false);
const buffie = computed(() =>
	props.hypercharge ? brawlerAbilityBuffie(props.buffies, "hypercharge", props.hypercharge.name) : undefined
);
const imageFailed = ref(false);
const multiplier = computed(() => props.hypercharge?.stats.find((stat) => /multiplier/i.test(stat.label)));
const boosts = computed(() =>
	BOOSTS.flatMap((boost) => {
		const stat = props.hypercharge?.stats.find((stat) => stat.label.toLowerCase() === boost.label.toLowerCase());
		return stat ? [{ ...boost, value: brawlerStatText(stat.value) }] : [];
	})
);
const otherStats = computed(() =>
	(props.hypercharge?.stats ?? []).filter(
		(stat) => stat !== multiplier.value && !BOOSTS.some((boost) => boost.label.toLowerCase() === stat.label.toLowerCase())
	)
);

watch(
	() => props.brawlerId,
	() => {
		imageFailed.value = false;
		buffied.value = false;
	}
);
</script>

<template>
	<UCard
		as="article"
		data-testid="hypercharge"
		variant="subtle"
		class="@container bg-linear-to-br from-primary/5 to-transparent"
		:ui="{ body: 'p-5 sm:p-6' }"
	>
		<div class="grid gap-5" :class="multiplier ? '@2xl:grid-cols-[minmax(0,1fr)_12rem] @2xl:items-start' : ''">
			<div class="min-w-0">
				<header class="flex items-center gap-3">
					<div class="grid size-14 shrink-0 place-items-center text-primary" aria-hidden="true">
						<BrawlerUpgradeIcon v-if="hypercharge" v-model:failed="imageFailed" :src="routes.hyperchargeIcon(brawlerId)" :upgraded="buffied && Boolean(buffie)" :size="56">
							<UIcon name="i-lucide-zap" class="size-8" />
						</BrawlerUpgradeIcon>
						<UIcon v-else name="i-lucide-zap" class="size-8" />
					</div>
					<div class="min-w-0">
						<p class="font-brawlstars text-base text-primary">{{ t("page.brawler_info.hypercharge") }}</p>
						<h3 class="mt-1 font-brawlstars text-xl leading-tight wrap-anywhere text-highlighted">
							<BrawlerBuffieText v-if="buffied && buffie">{{ hypercharge?.name }}</BrawlerBuffieText>
							<span v-else>{{ hypercharge?.name || t("page.brawler_info.no_hypercharge") }}</span>
						</h3>
					</div>
				</header>
				<BrawlerBuffieToggle
					v-if="buffie"
					v-model="buffied"
					:label="t('page.brawler_info.hypercharge')"
					kind="hypercharge"
					:buffie="buffie"
					:brawler-id="brawlerId"
					class="mt-4"
				/>
				<p class="mt-3 text-sm leading-6 text-muted">
					{{ hypercharge?.description || t("page.brawler_info.hypercharge_unavailable") }}
					<BrawlerBuffieEffect v-if="buffied && buffie" :buffie="buffie" />
				</p>
			</div>
			<dl
				v-if="multiplier"
				data-testid="hypercharge-multiplier"
				class="flex flex-wrap items-center justify-between gap-3 rounded-r-lg border-l-4 border-primary bg-primary/5 p-4 @2xl:block"
			>
				<dt class="text-xs font-medium leading-5 text-muted">{{ t("page.brawler_info.hypercharge_multiplier") }}</dt>
				<dd class="font-brawlstars text-4xl tabular-nums wrap-anywhere text-primary @2xl:mt-2">
					{{ brawlerStatText(multiplier.value) }}
				</dd>
			</dl>
		</div>

		<dl v-if="boosts.length" class="mt-5 grid grid-cols-3 divide-x divide-default border-t border-default pt-4">
			<div v-for="boost in boosts" :key="boost.label" class="min-w-0 px-3 first:pl-0 last:pr-0">
				<dt
					class="flex min-h-14 flex-col items-start justify-between gap-2 text-xs text-muted @lg:min-h-8 @lg:flex-row @lg:items-center @lg:justify-start"
				>
					<img :src="boost.icon" alt="" width="32" height="32" class="size-8 object-contain" >
					{{ t(boost.translation) }}
				</dt>
				<dd class="mt-2 font-brawlstars text-2xl tabular-nums text-highlighted">{{ boost.value }}</dd>
			</div>
		</dl>
		<dl v-if="otherStats.length" class="mt-4 space-y-2 border-t border-default pt-3">
			<div v-for="stat in otherStats" :key="stat.label" class="flex flex-wrap justify-between gap-2 text-xs">
				<dt class="text-muted">{{ stat.label }}</dt>
				<dd class="font-semibold text-highlighted">{{ brawlerStatText(stat.value) }}</dd>
			</div>
		</dl>
	</UCard>
</template>
