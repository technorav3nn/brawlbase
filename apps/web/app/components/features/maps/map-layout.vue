<script setup lang="ts">
const props = defineProps<{ imageUrl?: string; name: string }>();
const { t } = useI18n();
const imageFailed = ref(false);
watch(
	() => props.imageUrl,
	() => {
		imageFailed.value = false;
	}
);
</script>

<template>
	<div class="relative flex items-center justify-center overflow-hidden bg-muted/50">
		<img
			v-if="imageUrl && !imageFailed"
			:src="imageUrl"
			:alt="t('page.events.map_layout', { name })"
			width="420"
			height="660"
			loading="lazy"
			class="absolute inset-0 size-full object-contain p-2"
			@error="imageFailed = true"
		/>
		<div v-else class="flex flex-col items-center gap-2 px-3 text-center text-muted">
			<UIcon name="i-lucide-map" class="size-8" aria-hidden="true" />
			<p class="text-xs">{{ t("page.events.map_unavailable") }}</p>
		</div>
	</div>
</template>
