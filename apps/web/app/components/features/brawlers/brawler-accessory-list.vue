<script setup lang="ts">
import type { Accessory, Buffie } from "@brawlbase/cdn";
import { routes } from "@brawlbase/cdn";
import BrawlerBuffieEffect from "~/components/features/brawlers/brawler-buffie-effect.vue";
import BrawlerBuffieText from "~/components/features/brawlers/brawler-buffie-text.vue";
import BrawlerBuffieToggle from "~/components/features/brawlers/brawler-buffie-toggle.vue";
import BrawlerUpgradeIcon from "~/components/features/brawlers/brawler-upgrade-icon.vue";
import { brawlerAbilityBuffie } from "~/utils/brawler-buffies";
import { brawlerLevelStats } from "~/utils/brawler-stats";

const props = withDefaults(
	defineProps<{
		items: Accessory[];
		kind: "gadget" | "starpower";
		level: number;
		brawlerId: number;
		buffies?: Buffie[];
	}>(),
	{ buffies: () => [] }
);
const { t } = useI18n();
const buffied = ref(false);
const failedImages = ref<Record<string, boolean>>({});
const title = computed(() => t(props.kind === "gadget" ? "page.brawler_info.gadgets" : "page.brawler_info.star_powers"));
const entries = computed(() =>
	props.items.map((item) => ({ ...item, buffie: brawlerAbilityBuffie(props.buffies, props.kind, item.name) }))
);
const sectionBuffie = computed(() => entries.value.find((item) => item.buffie)?.buffie);
const hasBuffies = computed(() => Boolean(sectionBuffie.value));
const icon = computed(() => (props.kind === "gadget" ? "i-lucide-wrench" : "i-lucide-star"));
function imageUrl(id: string) {
	return props.kind === "gadget" ? routes.gadgetIcon(Number(id)) : routes.starPowerIcon(Number(id));
}
watch(
	() => [props.brawlerId, props.kind],
	() => {
		buffied.value = false;
		failedImages.value = {};
	}
);
</script>

<template>
	<section class="min-w-0" :data-testid="`${kind}-list`">
		<header class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-2.5">
				<img
					:src="
						kind === 'gadget'
							? '/icons/player/brawler-powers/gadget-big.png'
							: '/icons/player/brawler-powers/starpower-big.png'
					"
					alt=""
					width="32"
					height="32"
					class="size-8 object-contain"
				/>
				<h2 class="font-brawlstars text-2xl text-highlighted">{{ title }}</h2>
			</div>
			<BrawlerBuffieToggle
				v-if="hasBuffies"
				v-model="buffied"
				:label="title"
				:kind="kind"
				:buffie="sectionBuffie"
				:brawler-id="brawlerId"
			/>
		</header>
		<div class="space-y-3">
			<UCard
				v-for="item in entries"
				:key="item.id"
				as="article"
				variant="subtle"
				:class="
					kind === 'gadget'
						? 'bg-linear-to-br from-success/5 to-transparent'
						: 'bg-linear-to-br from-warning/5 to-transparent'
				"
				:ui="{ body: 'p-5' }"
			>
				<header class="flex items-center gap-3">
					<div class="grid size-11 shrink-0 place-items-center" aria-hidden="true">
						<BrawlerUpgradeIcon
							v-model:failed="failedImages[item.id]"
							:src="imageUrl(item.id)"
							:upgraded="buffied && Boolean(item.buffie)"
						>
							<UIcon :name="icon" class="size-6" :class="kind === 'gadget' ? 'text-success' : 'text-warning'" />
						</BrawlerUpgradeIcon>
					</div>
					<h3 class="min-w-0 font-brawlstars text-[22px] leading-tight wrap-anywhere text-highlighted">
						<BrawlerBuffieText v-if="buffied && item.buffie">{{ item.name }}</BrawlerBuffieText>
						<span v-else>{{ item.name }}</span>
					</h3>
				</header>
				<p class="mt-3 text-sm leading-6 text-muted">
					{{ item.description }}
					<BrawlerBuffieEffect v-if="buffied && item.buffie" :buffie="item.buffie" />
				</p>
				<p v-if="buffied && !item.buffie" class="mt-3 text-xs text-muted">
					{{ t("page.brawler_info.no_ability_buffie") }}
				</p>
				<dl
					v-if="item.cooldown || item.statsByLevel.length"
					class="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-default pt-3 text-xs"
				>
					<div v-if="item.cooldown" class="flex flex-wrap items-baseline gap-1.5">
						<dt class="text-muted">Cooldown</dt>
						<dd class="font-semibold text-highlighted">{{ item.cooldown }}</dd>
					</div>
					<div
						v-for="stat in brawlerLevelStats(item.statsByLevel, level)"
						:key="stat.label"
						class="flex flex-wrap items-baseline gap-1.5"
					>
						<dt class="text-muted">{{ stat.label }}</dt>
						<dd class="font-semibold text-highlighted">{{ stat.value }}</dd>
					</div>
				</dl>
			</UCard>
			<UEmpty
				v-if="!items.length"
				:icon="icon"
				:title="`No ${title.toLowerCase()} listed yet`"
				variant="subtle"
				size="sm"
			/>
		</div>
	</section>
</template>
