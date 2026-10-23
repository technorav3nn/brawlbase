<script setup lang="ts">
defineProps<{ src: string; upgraded: boolean; size?: number }>();
const failed = defineModel<boolean>("failed", { default: false });
</script>

<template>
	<span class="relative grid size-full place-items-center" aria-hidden="true">
		<img
			v-if="!failed"
			:src="src"
			alt=""
			:width="size || 44"
			:height="size || 44"
			loading="lazy"
			class="relative size-full object-contain"
			:class="
				upgraded
					? '[filter:drop-shadow(0_1px_0_#fff5b5)_drop-shadow(1px_0_0_#a9f4e5)_drop-shadow(0_-1px_0_#ffb5f7)_drop-shadow(-1px_0_0_#d3b6ff)]'
					: ''
			"
			@error="failed = true"
		/>
		<slot v-else />
	</span>
</template>
