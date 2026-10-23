<script setup lang="ts">
import type { RotationEvent } from "#shared/types/events";

const props = defineProps<{ event?: RotationEvent }>();
const open = defineModel<boolean>("open", { default: false });
const { t } = useI18n();
const imageFailed = ref(false);
const mapLink = computed(() =>
	props.event && props.event.mapId > 0 ? `https://brawlify.com/maps/${props.event.mapId}` : undefined
);
watch(
	() => [props.event?.id, open.value],
	() => {
		imageFailed.value = false;
	}
);
</script>

<template>
	<UModal
		v-model:open="open"
		:title="event?.mapName"
		:description="event?.modeName"
		:close="{ icon: 'i-lucide-x' }"
		:ui="{ content: 'max-w-2xl', body: 'p-4 sm:p-6', footer: 'justify-end' }"
	>
		<template #body>
			<img
				v-if="event?.mapImageUrl && !imageFailed"
				:src="event.mapImageUrl"
				:alt="t('page.events.map_layout', { name: event?.mapName })"
				loading="eager"
				width="512"
				height="512"
				class="h-[60vh] w-full rounded-lg bg-muted/50 object-contain p-3"
				@error="imageFailed = true"
			/>
			<UEmpty v-else icon="i-lucide-map" :title="t('page.events.map_unavailable')" />
		</template>
		<template #footer>
			<UButton
				v-if="event && event.mapId > 0"
				:to="`/maps/${event.mapId}`"
				:label="t('page.map_stats.view_map')"
				icon="i-lucide-chart-no-axes-combined"
				color="neutral"
				variant="subtle"
			/>
			<UButton
				v-if="mapLink"
				:to="mapLink"
				:label="t('page.events.map_details')"
				trailing-icon="i-lucide-arrow-up-right"
				target="_blank"
				external
				rel="noopener noreferrer"
				color="neutral"
				variant="subtle"
			/>
		</template>
	</UModal>
</template>
