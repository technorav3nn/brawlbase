<script setup lang="ts">
const props = defineProps<{ text: string; query?: string; emphasize?: boolean }>();

const segments = computed(() => {
	const query = props.query?.trim() ?? "";
	const patterns: string[] = [];
	if (query) patterns.push(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	if (props.emphasize) patterns.push("\\b(?:Hypercharge|Star Powers?|Gadgets?|Super)\\b");
	if (!patterns.length) return [{ text: props.text, highlight: false, emphasis: false }];

	const result: { text: string; highlight: boolean; emphasis: boolean }[] = [];
	let offset = 0;
	for (const match of props.text.matchAll(new RegExp(patterns.join("|"), "gi"))) {
		const index = match.index!;
		if (index > offset) result.push({ text: props.text.slice(offset, index), highlight: false, emphasis: false });
		const highlight = Boolean(query) && match[0].toLowerCase() === query.toLowerCase();
		result.push({ text: match[0], highlight, emphasis: !highlight });
		offset = index + match[0].length;
	}
	if (offset < props.text.length) result.push({ text: props.text.slice(offset), highlight: false, emphasis: false });
	return result;
});
</script>

<template>
	<template v-for="(segment, index) in segments" :key="index">
		<mark
			v-if="segment.highlight"
			class="rounded-sm bg-warning/25 text-highlighted underline decoration-warning decoration-2 underline-offset-2"
			>{{ segment.text }}</mark
		>
		<strong v-else-if="segment.emphasis" class="font-semibold text-highlighted">{{ segment.text }}</strong>
		<template v-else>{{ segment.text }}</template>
	</template>
</template>
