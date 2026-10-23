<script setup lang="ts">
const selected = defineModel<string>({ required: true });
const { t } = useI18n();
const items = computed(() => [
	{ value: "overview", label: t("page.performance.overview"), icon: "i-lucide-swords" },
	{ value: "charts", label: t("page.performance.charts"), icon: "i-lucide-chart-no-axes-combined" },
	{ value: "tier_list", label: t("page.performance.tier_list"), icon: "i-lucide-trophy" },
	{ value: "meta_history", label: t("page.performance.meta_history"), icon: "i-lucide-history" },
]);
</script>
<template>
	<div class="min-w-0 b-1">
		<UTabs
			v-model="selected"
			:ui="{
				list: 'w-full justify-start overflow-x-auto border-default',
				trigger: 'flex-none shrink-0 px-3',
			}"
			:items="items"
			:content="false"
			variant="link"
			size="md"
		/>
	</div>
</template>
