<script setup lang="ts">
const { t } = useI18n();
</script>
<template>
	<UCollapsible class="rounded-lg border border-default bg-elevated/50">
		<UButton
			:label="t('page.brawler_stats.sample_title')"
			icon="i-lucide-info"
			trailing-icon="i-lucide-chevron-down"
			color="neutral"
			variant="ghost"
			size="sm"
			class="w-full justify-between text-left"
		/>
		<template #content>
			<div class="space-y-2 px-4 pt-1 pb-4 text-xs leading-5 text-muted">
				<p>{{ t("page.brawler_stats.sample_description") }}</p>
				<p>{{ t("page.brawler_stats.win_definition") }} {{ t("page.brawler_stats.pick_definition") }}</p>
				<p>{{ t("page.performance.score_note") }}</p>
				<p>{{ t("page.performance.read_method") }}</p>
			</div>
		</template>
	</UCollapsible>
</template>
