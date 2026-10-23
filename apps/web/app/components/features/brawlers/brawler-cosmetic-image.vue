<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		src?: string;
		fallbackSrc?: string;
		alt: string;
		loading?: "lazy" | "eager";
	}>(),
	{ src: undefined, fallbackSrc: undefined, loading: "lazy" }
);
const attempt = ref(0);
const imageUrls = computed(() =>
	[props.src, props.fallbackSrc].filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index)
);
const imageUrl = computed(() => imageUrls.value[attempt.value]);

watch(
	() => [props.src, props.fallbackSrc],
	() => {
		attempt.value = 0;
	}
);
</script>

<template>
	<span class="flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
		<img
			v-if="imageUrl"
			:key="imageUrl"
			:src="imageUrl"
			:alt="alt"
			width="512"
			height="512"
			:loading="loading"
			referrerpolicy="no-referrer"
			class="size-full min-h-0 min-w-0 object-contain"
			@error="attempt++"
		/>
		<span v-else class="flex flex-col items-center gap-2 p-3 text-center text-xs text-muted" role="img" :aria-label="alt">
			<UIcon name="i-lucide-image-off" class="size-8" aria-hidden="true" />
			{{ $t("page.brawler_cosmetics.image_unavailable") }}
		</span>
	</span>
</template>
