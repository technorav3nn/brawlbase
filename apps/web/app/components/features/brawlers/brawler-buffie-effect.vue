<script setup lang="ts">
import type { Buffie } from "@brawlbase/cdn";
import BrawlerBuffieText from "~/components/features/brawlers/brawler-buffie-text.vue";
import { brawlerBuffieEffect } from "~/utils/brawler-buffies";

defineProps<{ buffie: Buffie }>();
const { t } = useI18n();
</script>

<template>
	<BrawlerBuffieText class="font-semibold" data-testid="buffie-effect">
		{{ " " + (brawlerBuffieEffect(buffie) || t("page.brawler_info.buffie_effect_unavailable")) }}
	</BrawlerBuffieText>
</template>
