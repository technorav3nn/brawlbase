<script setup lang="ts">
import type { BrawlApiBrawler } from "@brawlbase/brawl-api";
import { routes } from "@brawlbase/cdn";
import type { StatsFilters } from "@brawlbase/tracker";
import { useEquipmentPerformanceQuery } from "~/queries/equipment-performance";
import { cdnUrl } from "~/utils/cdn-url";
const props = defineProps<{ brawlerId: number; brawler: BrawlApiBrawler | null; filters: StatsFilters }>();
const { t, locale } = useI18n();
const { data, error, refresh } = useQuery(() =>
	useEquipmentPerformanceQuery({ brawlerId: props.brawlerId, filters: props.filters })
);
const failed = ref(new Set<number>());
const rate = computed(() => new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 1 }));
const count = computed(() => new Intl.NumberFormat(locale.value));
const items = computed(() =>
	(data.value?.items ?? []).map((row) => ({
		...row,
		name:
			(row.kind === "gadget"
				? props.brawler?.gadgets
				: row.kind === "starPower"
					? props.brawler?.starPowers
					: undefined
			)?.find((item) => item.id === row.equipmentId)?.name ??
			t("page.performance.equipment_id", { kind: t(`page.performance.equipment_${row.kind}`), id: row.equipmentId }),
		image:
			row.kind === "gadget"
				? cdnUrl(routes.gadgetIcon(row.equipmentId))
				: row.kind === "starPower"
					? cdnUrl(routes.starPowerIcon(row.equipmentId))
					: undefined,
	}))
);
await refresh();
</script>
<template>
	<section class="space-y-4" data-testid="equipment-performance">
		<div class="flex flex-wrap items-center gap-3">
			<h3 class="font-brawlstars text-2xl text-highlighted">{{ t("page.performance.equipment_title") }}</h3>
			<UBadge color="warning" variant="soft">{{ t("page.performance.profile_inferred") }}</UBadge>
		</div>
		<p class="max-w-3xl text-xs leading-5 text-muted">{{ t("page.performance.equipment_method") }}</p>
		<p v-if="error" class="text-sm text-muted">{{ t("page.performance.equipment_unavailable") }}</p>
		<div v-else-if="items.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			<UCard
				v-for="item in items"
				:key="`${item.kind}:${item.equipmentId}`"
				variant="subtle"
				class="bg-elevated"
				:ui="{ body: 'space-y-3 p-4 sm:p-4' }"
			>
				<div class="flex items-center gap-3">
					<img
						v-if="item.image && !failed.has(item.equipmentId)"
						:src="item.image"
						alt=""
						width="40"
						height="40"
						class="size-10 object-contain"
						@error="failed.add(item.equipmentId)"
					><UIcon v-else name="i-lucide-settings-2" class="size-8 text-muted" />
					<div class="min-w-0">
						<p class="text-xs text-muted">{{ t(`page.performance.equipment_${item.kind}`) }}</p>
						<h4 class="font-semibold text-highlighted">{{ item.name }}</h4>
					</div>
				</div>
				<dl class="grid grid-cols-2 gap-3">
					<div>
						<dt class="text-xs text-muted">{{ t("page.brawler_stats.win_rate") }}</dt>
						<dd class="font-brawlstars text-2xl text-primary">
							{{ item.winRate === null ? "—" : rate.format(item.winRate) }}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">{{ t("page.performance.inferred_use_rate") }}</dt>
						<dd class="font-brawlstars text-2xl text-highlighted">{{ rate.format(item.useRate) }}</dd>
					</div>
				</dl>
				<p class="text-xs text-muted">
					{{ t("page.performance.inferred_samples", { count: count.format(item.picks) }) }}
				</p>
			</UCard>
		</div>
		<UEmpty
			v-else
			icon="i-lucide-settings-2"
			:title="t('page.performance.no_equipment_samples')"
			:description="t('page.performance.no_equipment_description')"
		/>
	</section>
</template>
