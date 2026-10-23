<script setup lang="ts">
import type { BrawlerVoiceline } from "~/utils/brawler-voicelines";

const props = defineProps<{ line: BrawlerVoiceline; showVariant?: boolean; tile?: boolean }>();
const { t } = useI18n();
const audio = useTemplateRef("audio");
const playing = ref(false);
const failed = ref(false);
const sourceIndex = ref(0);
const wantsPlayback = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const sources = computed(() => [
	...new Set([props.line.url, props.line.fallbackUrl].filter((url): url is string => Boolean(url))),
]);
const playbackLabel = computed(() => t(
	playing.value ? "page.brawler_cosmetics.pause_voice" : "page.brawler_cosmetics.play_voice",
	{ quote: props.line.description || props.line.trigger }
));
const progress = computed(() => duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0);

function updateTime() {
	currentTime.value = audio.value?.currentTime ?? 0;
	const audioDuration = audio.value?.duration;
	duration.value = audioDuration && Number.isFinite(audioDuration) ? audioDuration : 0;
}

function formatTime(seconds: number) {
	return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

async function play() {
	failed.value = false;
	try {
		if (audio.value?.error) audio.value.load();
		await audio.value?.play();
	} catch {
		// The error event retries the original source when a CDN file is unavailable.
		if (wantsPlayback.value && sourceIndex.value === sources.value.length - 1) failed.value = true;
	}
}

function togglePlayback() {
	if (!audio.value) return;
	if (!audio.value.paused) {
		audio.value.pause();
		return;
	}
	wantsPlayback.value = true;
	void play();
}

function started() {
	playing.value = true;
	// Voice clips should never overlap, including clips in the skin inspector.
	document.querySelectorAll("audio").forEach((other) => {
		if (other !== audio.value) other.pause();
	});
}

function stopped() {
	playing.value = false;
	wantsPlayback.value = false;
}

async function retrySource() {
	if (sourceIndex.value + 1 >= sources.value.length) {
		failed.value = true;
		stopped();
		return;
	}
	sourceIndex.value += 1;
	await nextTick();
	if (wantsPlayback.value) await play();
}

onBeforeUnmount(() => audio.value?.pause());
</script>

<template>
	<div class="group min-w-0" :class="tile ? 'h-full' : 'flex items-center gap-3 py-3'" data-testid="voiceline">
		<UCard
			v-if="tile"
			as="article"
			variant="subtle"
			class="h-full transition-colors"
			:class="playing ? 'border-primary! bg-primary/5' : 'bg-elevated/50 hover:bg-elevated'"
			:ui="{ body: 'flex h-full flex-col p-4 sm:p-4' }"
		>
			<p v-if="showVariant" class="mb-2 text-xs text-muted">{{ line.variant === "Normal" ? t("page.brawler_info.normal") : line.variant }}</p>
			<blockquote v-if="line.description" class="flex-1 text-sm leading-6 text-highlighted">
				{{ line.description }}
			</blockquote>
			<p v-else class="flex-1 text-sm leading-6 text-muted">{{ t("page.brawler_cosmetics.no_transcript") }}</p>
			<div class="mt-4 flex items-center justify-between gap-3">
				<UButton
					:icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
					:label="t(playing ? 'page.brawler_cosmetics.pause_clip' : 'page.brawler_cosmetics.play_clip')"
					:aria-label="playbackLabel"
					:aria-pressed="playing"
					:disabled="!sources.length"
					:variant="playing ? 'solid' : 'soft'"
					size="xs"
					class="brawl-button-quiet"
					data-testid="voice-play"
					@click="togglePlayback"
				/>
				<span v-if="duration" class="text-xs tabular-nums text-muted">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
				<UIcon v-else name="i-lucide-audio-lines" class="size-5 text-dimmed" aria-hidden="true" />
			</div>
			<UProgress v-if="duration" :model-value="progress" :aria-label="t('page.brawler_cosmetics.audio_progress')" size="2xs" class="mt-3" />
			<p v-if="failed || !sources.length" class="mt-2 text-xs text-muted" role="status">{{ t("page.brawler_cosmetics.audio_unavailable") }}</p>
		</UCard>
		<template v-else>
			<UButton
				:icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
				:aria-label="playbackLabel"
				:aria-pressed="playing"
				:disabled="!sources.length"
				:color="playing ? 'primary' : 'neutral'"
				variant="ghost"
				size="sm"
				class="brawl-button-quiet size-10 shrink-0 justify-center"
				data-testid="voice-play"
				@click="togglePlayback"
			/>
			<div class="min-w-0 flex-1">
				<p class="text-sm leading-6 wrap-anywhere" :class="playing ? 'text-primary' : 'text-default'">
					{{ line.description || t("page.brawler_cosmetics.no_transcript") }}
				</p>
				<p v-if="showVariant" class="mt-0.5 text-xs text-muted">{{ line.variant === "Normal" ? t("page.brawler_info.normal") : line.variant }}</p>
				<p v-if="failed || !sources.length" class="mt-1 text-xs text-muted" role="status">
					{{ t("page.brawler_cosmetics.audio_unavailable") }}
				</p>
			</div>
		</template>
		<audio
			v-if="sources.length"
			ref="audio"
			:src="sources[sourceIndex]"
			preload="none"
			@play="started"
			@pause="stopped"
			@ended="stopped"
			@error="retrySource"
			@loadedmetadata="updateTime"
			@durationchange="updateTime"
			@timeupdate="updateTime"
		/>
	</div>
</template>
