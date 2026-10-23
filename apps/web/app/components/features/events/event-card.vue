<script setup lang="ts">
import type { RotationEvent } from "#shared/types/events";
import { eventArtwork } from "~/utils/event-artwork";

const props = defineProps<{ event: RotationEvent; upcoming: boolean; now?: number }>();
defineEmits<{ inspect: [event: RotationEvent] }>();
const { t } = useI18n();
const artwork = computed(() => eventArtwork(props.event));
const imageFailed = ref(false);
const rotationTime = computed(() => props.upcoming ? props.event.startTime : props.event.endTime);
const timeRemaining = computed(() => {
	if (props.now === undefined) return undefined;
	const target = Date.parse(rotationTime.value);
	if (!Number.isFinite(target)) return undefined;
	const minutes = Math.max(0, Math.ceil((target - props.now) / 60_000));
	if (minutes < 1) return t("page.events.changing");
	const duration = minutes >= 1440
		? t("page.events.days_hours", { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60) })
		: t("page.events.hours_minutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
	return t(props.upcoming ? "page.events.starts_in" : "page.events.ends_in", { time: duration });
});

watch(() => artwork.value.banner, () => { imageFailed.value = false; });
</script>

<template>
	<UCard
		as="article"
		variant="subtle"
		class="overflow-hidden"
		:ui="{ body: 'p-0 sm:p-0' }"
		data-testid="event-card"
	>
		<div class="relative aspect-[25/8] overflow-hidden bg-muted">
			<!-- Crop the transparent outer pixels present in some source banners. -->
			<img
				v-if="artwork.banner && !imageFailed"
				:src="artwork.banner"
				alt=""
				:width="artwork.width"
				:height="artwork.height"
				loading="lazy"
				class="absolute inset-0 size-full scale-[1.04] object-cover"
				@error="imageFailed = true"
			>
			<div v-else class="grid size-full place-items-center" aria-hidden="true">
				<img v-if="artwork.icon" :src="artwork.icon" alt="" width="64" height="64" class="size-16 object-contain opacity-35" >
				<UIcon v-else name="i-lucide-swords" class="size-12 text-muted" />
			</div>
		</div>
		<div class="p-4 sm:p-5">
			<header class="flex items-center gap-3">
				<div class="grid size-11 shrink-0 place-items-center" data-testid="event-mode-icon">
					<img v-if="artwork.icon" :src="artwork.icon" alt="" width="44" height="44" class="size-11 object-contain" >
					<UIcon v-else name="i-lucide-swords" class="size-7 text-muted" aria-hidden="true" />
				</div>
				<div class="min-w-0">
					<p class="text-xs font-medium leading-5 wrap-anywhere text-muted">{{ event.modeName }}</p>
					<h2 class="font-brawlstars text-[22px] leading-tight wrap-anywhere text-highlighted">{{ event.mapName }}</h2>
				</div>
			</header>
			<div class="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-default pt-2">
				<p class="flex min-w-0 items-center gap-1.5 text-xs tabular-nums text-muted">
					<UIcon name="i-lucide-clock-3" class="size-3.5 shrink-0" aria-hidden="true" />
					<time v-if="timeRemaining" :datetime="rotationTime">{{ timeRemaining }}</time>
					<span v-else>{{ t('page.events.schedule') }}</span>
				</p>
				<UButton
					:label="t('page.events.view_map')"
					:aria-label="t('page.events.inspect_map', { name: event.mapName })"
					icon="i-lucide-map"
					color="neutral"
					variant="ghost"
					size="sm"
					class="-mr-2"
					@click="$emit('inspect', event)"
				/>
			</div>
		</div>
	</UCard>
</template>
