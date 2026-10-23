<script setup lang="ts">
import type { ContentTocLink } from "@nuxt/ui";
import BrawlerAbilityCard from "~/components/features/brawlers/brawler-ability-card.vue";
import BrawlerAccessoryList from "~/components/features/brawlers/brawler-accessory-list.vue";
import BrawlerHyperchargeCard from "~/components/features/brawlers/brawler-hypercharge-card.vue";
import BrawlerOverview from "~/components/features/brawlers/brawler-overview.vue";
import { useBrawlerStore } from "~/components/features/brawlers/brawler-store";
import { brawlerAbilityStats, brawlerMovementProfiles, brawlerStatNumber, brawlerStatText } from "~/utils/brawler-stats";

const KIT_ITEMS = [
	{ value: "primary", label: "Primary kit", icon: "i-lucide-crosshair" },
	{ value: "alternate", label: "Alternate kit", icon: "i-lucide-repeat-2" },
];

const store = useBrawlerStore();
const { brawler, brawlerCdnData: data, level } = storeToRefs(store);
const { t } = useI18n();

const selectedKit = ref("primary");
const tocLinks = computed<ContentTocLink[]>(() => [
	{ id: "important-stats", depth: 2, text: t("page.brawler_info.important_stats") },
	{ id: "attack", depth: 2, text: t("page.brawler_info.attack") },
	{ id: "super", depth: 2, text: t("page.brawler_info.super") },
	...(data.value?.hypercharge ? [{ id: "hypercharge", depth: 2, text: t("page.brawler_info.hypercharge") }] : []),
	...(data.value?.gadgets.length ? [{ id: "gadgets", depth: 2, text: t("page.brawler_info.gadgets") }] : []),
	...(data.value?.starpowers.length ? [{ id: "star-powers", depth: 2, text: t("page.brawler_info.star_powers") }] : []),
]);
const powerLevels = computed(() =>
	Array.from({ length: 11 }, (_, index) => ({
		label: t("page.brawler_info.power_option", { level: index + 1 }),
		value: index + 1,
	}))
);

const health = computed(() => brawlerStatNumber(data.value?.healthByLevel[level.value - 1]));
const movementSpeeds = computed(() => brawlerMovementProfiles(data.value?.stats.movementspeed ?? ""));

const hasAlternateKit = computed(() => Boolean(data.value?.altAttack || data.value?.altSuper));
const attack = computed(() =>
	selectedKit.value === "alternate" && data.value?.altAttack ? data.value.altAttack : data.value?.attack
);

const attackStats = computed(() => (attack.value ? brawlerAbilityStats(attack.value, level.value) : []));
const damageStat = computed(() => attackStats.value.find((stat) => /damage/i.test(stat.label)) ?? attackStats.value[0]);
const damageChangesWithLevel = computed(() =>
	Boolean(attack.value?.statsByLevel.some((stat) => stat.name === damageStat.value?.label))
);
const attackStat = (pattern: RegExp) =>
	brawlerStatText(attack.value?.stats.find((stat) => pattern.test(stat.label))?.value ?? "") || "—";

// used for the attack range and reload speed stats
const attackRange = computed(() => attackStat(/range/i));
const reloadSpeed = computed(() => attackStat(/reload/i));

const superAbility = computed(() =>
	selectedKit.value === "alternate" && data.value?.altSuper ? data.value.altSuper : data.value?.super
);

watch(
	() => brawler.value?.id,
	() => (selectedKit.value = "primary")
);
useSeoMeta({
	title: () => `${brawler.value?.name ?? "Brawler"} abilities & upgrades | BrawlBase`,
	description: () => data.value?.shortDescription || brawler.value?.description,
});
</script>

<template>
	<div class="pt-3 pb-16" data-testid="brawler-info">
		<div
			v-if="brawler && data"
			class="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_9rem] xl:grid-cols-[18rem_minmax(0,1fr)_10rem] 2xl:grid-cols-[19rem_minmax(0,1fr)_11rem]"
		>
			<aside class="min-w-0 lg:sticky lg:top-36 lg:col-start-1 lg:row-start-1 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:pr-1 lg:pb-2">
				<BrawlerOverview :brawler="brawler" :data="data" />
			</aside>
			<aside class="min-w-0 lg:sticky lg:top-36 lg:col-start-3 lg:row-start-1" data-testid="info-toc-rail">
				<UContentToc
					:links="tocLinks"
					:title="t('page.brawler_info.on_this_page')"
					:aria-label="t('page.brawler_info.on_this_page')"
					trailing-icon="i-lucide-chevron-down"
					highlight
					data-testid="info-toc"
					:ui="{
						root: 'static mx-0 max-h-none overflow-visible bg-transparent px-0 backdrop-blur-none sm:mx-0 sm:px-0 lg:mx-0',
						container: 'border-0 pt-0 pb-0 sm:pt-0 sm:pb-0 lg:py-0',
						content: 'lg:min-h-0',
						linkText: 'whitespace-normal',
					}"
				/>
			</aside>

			<div class="min-w-0 space-y-9 lg:col-start-2 lg:row-start-1">
				<section id="important-stats" class="scroll-mt-36" :aria-label="t('page.brawler_info.important_stats')" data-testid="combat-stats">
					<UCard variant="subtle" class="bg-linear-to-br from-primary/5 to-transparent" :ui="{ body: 'p-5 sm:p-6' }">
						<header class="mb-6 flex flex-wrap items-center justify-between gap-3">
							<h2 class="font-brawlstars text-2xl text-highlighted">{{ t("page.brawler_info.important_stats") }}</h2>
							<UFormField
								:label="t('page.brawler_info.power_level')"
								data-testid="power-control"
								:ui="{ label: 'sr-only', container: 'mt-0' }"
							>
								<USelect
									v-model="level"
									:items="powerLevels"
									icon="i-lucide-chevrons-up"
									trailing-icon="i-lucide-chevron-down"
									selected-icon="i-lucide-check"
									class="w-36"
									variant="subtle"
								/>
							</UFormField>
						</header>

						<dl class="grid grid-cols-2 gap-x-5 gap-y-4">
							<div class="min-w-0">
								<dt class="flex min-h-8 items-center gap-2 text-xs text-muted">
									<img src="/icons/shield-icon.png" alt="" width="28" height="28" class="size-7 shrink-0 object-contain">
									{{ t("page.brawler_info.health") }}
								</dt>
								<dd
									data-testid="health-stat"
									class="mt-1 font-brawlstars text-3xl tabular-nums text-highlighted sm:text-4xl"
								>
									<UTooltip
										:text="t('page.brawler_info.level_hint')"
										:ui="{ content: 'h-auto max-w-64 py-2', text: 'whitespace-normal' }"
									>
										<span
											tabindex="0"
											class="cursor-help underline decoration-primary/60 decoration-dotted underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
										>
											{{ health }}
										</span>
									</UTooltip>
								</dd>
							</div>
							<div class="min-w-0 border-l border-default pl-5">
								<dt class="flex min-h-8 items-center gap-2 text-xs text-muted">
									<img src="/icons/damage-icon.png" alt="" width="28" height="28" class="size-7 shrink-0 object-contain">
									{{ damageStat?.label || t("page.brawler_info.attack_damage") }}
								</dt>
								<dd class="mt-1 font-brawlstars text-3xl tabular-nums wrap-anywhere whitespace-pre-line text-highlighted sm:text-4xl">
									<UTooltip
										v-if="damageChangesWithLevel"
										:text="t('page.brawler_info.level_hint')"
										:ui="{ content: 'h-auto max-w-64 py-2', text: 'whitespace-normal' }"
									>
										<span
											tabindex="0"
											class="cursor-help underline decoration-primary/60 decoration-dotted underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
										>
											{{ damageStat?.value }}
										</span>
									</UTooltip>
									<span v-else>{{ damageStat?.value || "—" }}</span>
								</dd>
							</div>
						</dl>

						<dl class="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-default pt-4">
							<div class="min-w-0">
								<dt class="text-xs text-muted">{{ t("page.brawler_info.attack_range") }}</dt>
								<dd class="mt-1 text-sm font-semibold leading-6 wrap-anywhere whitespace-pre-line text-highlighted">{{ attackRange }}</dd>
							</div>
							<div class="min-w-0 border-l border-default pl-5">
								<dt class="text-xs text-muted">{{ t("page.brawler_info.reload") }}</dt>
								<dd class="mt-1 text-sm font-semibold leading-6 wrap-anywhere whitespace-pre-line text-highlighted">{{ reloadSpeed }}</dd>
							</div>
						</dl>

						<section
							class="mt-5 border-t border-default pt-4"
							:aria-label="t('page.brawler_info.movement_speed')"
							data-testid="movement-speeds"
						>
							<h3 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
								<img src="/icons/speed-icon.png" alt="" width="28" height="28" class="size-7 object-contain">
								{{ t("page.brawler_info.movement_speed") }}
							</h3>
							<dl class="mt-2 divide-y divide-default">
								<div
									v-for="profile in movementSpeeds"
									:key="`${profile.value}-${profile.condition}`"
									class="flex items-baseline justify-between gap-4 py-2"
								>
									<dt class="min-w-0 text-xs leading-5 wrap-anywhere text-muted">{{ profile.condition }}</dt>
									<dd class="max-w-[45%] shrink-0 text-right font-brawlstars text-xl tabular-nums wrap-anywhere text-highlighted">{{ profile.value }}</dd>
								</div>
							</dl>
						</section>
					</UCard>
				</section>

				<section aria-label="Attack and Super">
					<UTabs
						v-if="hasAlternateKit"
						v-model="selectedKit"
						:items="KIT_ITEMS"
						:content="false"
						size="sm"
						class="mb-4 w-full sm:w-80"
						aria-label="Ability form"
					/>
					<div class="flex flex-col gap-4">
						<BrawlerAbilityCard id="attack" class="scroll-mt-36" :ability="attack" kind="attack" :level="level" />
						<BrawlerAbilityCard id="super" class="scroll-mt-36" :ability="superAbility" kind="super" :level="level" />
					</div>
					<div class="mt-4">
						<BrawlerHyperchargeCard id="hypercharge" class="scroll-mt-36" :hypercharge="data.hypercharge" :brawler-id="brawler.id" :buffies="data.buffies" />
					</div>
				</section>

				<section v-if="data.gadgets.length || data.starpowers.length" aria-label="Gadgets and Star Powers">
					<div class="grid items-start gap-x-6 gap-y-8 md:grid-cols-2">
						<BrawlerAccessoryList id="gadgets" class="scroll-mt-36" :items="data.gadgets" kind="gadget" :level="level" :brawler-id="brawler.id" :buffies="data.buffies" />
						<BrawlerAccessoryList id="star-powers" class="scroll-mt-36" :items="data.starpowers" kind="starpower" :level="level" :brawler-id="brawler.id" :buffies="data.buffies" />
					</div>
				</section>
			</div>
		</div>
		<div v-else class="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]" role="status" aria-busy="true">
			<span class="sr-only">Loading brawler abilities…</span><USkeleton class="h-96 rounded-2xl" />
			<div class="space-y-5"><USkeleton class="h-32 rounded-xl" /><USkeleton class="h-80 rounded-xl" /></div>
		</div>
	</div>
</template>
