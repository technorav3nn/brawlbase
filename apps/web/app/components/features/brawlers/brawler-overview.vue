<script setup lang="ts">
import type { BrawlApiBrawler } from "@brawlbase/brawl-api";
import type { CdnBrawler } from "@brawlbase/cdn";
import { routes } from "@brawlbase/cdn";
import { brawlerStatText } from "~/utils/brawler-stats";
import { cdnUrl } from "~/utils/cdn-url";

const props = defineProps<{ brawler: BrawlApiBrawler; data: CdnBrawler }>();
const modelAttempt = ref(0);
const modelUrl = computed(() =>
	cdnUrl(modelAttempt.value === 0 ? routes.brawlers(props.brawler.id).model : routes.brawlify.brawler(props.brawler.id).model)
);
const voiceActor = computed(() => brawlerStatText(props.data.stats.voiceactor ?? "") || "Not listed");
watch(
	() => props.brawler.id,
	() => {
		modelAttempt.value = 0;
	}
);
</script>

<template>
	<UCard
		as="section"
		data-testid="brawler-overview"
		:aria-label="`About ${brawler.name}`"
		variant="subtle"
		class="bg-linear-to-br from-primary/5 to-transparent"
		:ui="{
			body: 'grid grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] items-center gap-x-5 gap-y-5 p-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:p-6 lg:block',
		}"
	>
		<figure class="min-w-0">
			<img
				v-if="modelAttempt < 2"
				:key="modelUrl"
				:src="modelUrl"
				:alt="`${brawler.name}'s default character model`"
				width="240"
				height="320"
				class="h-44 w-full object-contain sm:h-48 lg:h-72 xl:h-80"
				@error="modelAttempt++"
			/>
			<UEmpty v-else icon="i-lucide-image-off" title="Model unavailable" variant="naked" class="h-44 px-0 lg:h-72" />
		</figure>

		<dl class="min-w-0 space-y-5 lg:mt-6">
			<div>
				<dt class="flex items-center gap-2 text-xs text-muted">
					<UIcon name="i-lucide-mic" class="size-3.5" aria-hidden="true" /> Voice actor
				</dt>
				<dd class="mt-1.5 text-sm font-semibold wrap-anywhere text-highlighted">{{ voiceActor }}</dd>
			</div>
			<div>
				<dt class="flex items-center gap-2 text-xs text-muted">
					<UIcon name="i-lucide-hash" class="size-3.5" aria-hidden="true" /> Brawler ID
				</dt>
				<dd class="mt-1.5 text-sm font-medium tabular-nums text-highlighted">{{ brawler.id }}</dd>
			</div>
		</dl>

		<div v-if="data.trait" class="col-span-2 border-t border-default pt-5 lg:mt-6">
			<h2 class="flex items-center gap-2 text-sm font-semibold text-highlighted">
				<UIcon name="i-lucide-fingerprint" class="size-4 text-secondary" aria-hidden="true" /> Trait
			</h2>
			<p class="mt-2 text-sm leading-6 text-muted">{{ data.trait }}</p>
		</div>
	</UCard>
</template>
