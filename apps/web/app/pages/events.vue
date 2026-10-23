<script setup lang="ts">
import type { RotationEvent } from "#shared/types/events";
import EventCard from "~/components/features/events/event-card.vue";
import EventMapPreview from "~/components/features/events/event-map-preview.vue";
import { useEventRotation } from "~/queries/events";

const { t } = useI18n();
const { data: rotation, status, asyncStatus, refresh, refetch } = useEventRotation();
const selectedRotation = ref("active");
const selectedMode = ref("all");
const query = ref("");
const inspectedEvent = ref<RotationEvent>();
const mapOpen = ref(false);
const now = ref<number>();
const rotationItems = computed(() => [
	{ value: "active", label: t("page.events.current"), icon: "i-lucide-swords", badge: rotation.value?.active.length ?? 0 },
	{ value: "upcoming", label: t("page.events.upcoming"), icon: "i-lucide-calendar-clock", badge: rotation.value?.upcoming.length ?? 0 },
]);
const events = computed(() => selectedRotation.value === "active" ? rotation.value?.active ?? [] : rotation.value?.upcoming ?? []);
const modeItems = computed(() => [
	{ value: "all", label: t("page.events.all_modes") },
	...[...new Map(events.value.map((event) => [event.modeHash, { value: event.modeHash, label: event.modeName }])).values()],
]);
const searchTerm = computed(() => query.value.trim().toLowerCase());
const hasFilters = computed(() => selectedMode.value !== "all" || Boolean(searchTerm.value));
const filteredEvents = computed(() => events.value.filter((event) => {
	const matchesMode = selectedMode.value === "all" || event.modeHash === selectedMode.value;
	const matchesSearch = `${event.mapName} ${event.modeName}`.toLowerCase().includes(searchTerm.value);
	return matchesMode && matchesSearch;
}));
const loading = computed(() => asyncStatus.value === "loading");

function inspect(event: RotationEvent) {
	inspectedEvent.value = event;
	mapOpen.value = true;
}

function resetFilters() {
	selectedMode.value = "all";
	query.value = "";
}

watch(selectedRotation, () => { selectedMode.value = "all"; });
watch(modeItems, (items) => {
	if (!items.some((item) => item.value === selectedMode.value)) selectedMode.value = "all";
});
onMounted(() => { now.value = Date.now(); });
useIntervalFn(() => {
	now.value = Date.now();
	void refresh();
}, 60_000);

useSeoMeta({
	title: () => `${t("page.events.title")} | BrawlBase`,
	description: () => t("page.events.description"),
});
await refresh();
</script>

<template>
	<UContainer class="py-6 sm:py-8" data-testid="events-page">
		<header class="mb-6 flex items-center justify-between gap-5">
			<div class="min-w-0">
				<h1 class="font-brawlstars text-3xl leading-tight text-pretty text-highlighted sm:text-4xl">{{ t('page.events.title') }}</h1>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-muted">{{ t('page.events.description') }}</p>
			</div>
			<UTooltip :text="t('page.events.refresh')">
				<UButton icon="i-lucide-refresh-cw" :aria-label="t('page.events.refresh')" :loading="loading" color="neutral" variant="subtle" @click="refetch()" />
			</UTooltip>
		</header>
		<UCard variant="subtle" class="mb-6" :ui="{ body: 'flex flex-wrap items-end gap-4 p-4 sm:p-5' }">
			<UFormField :label="t('page.events.rotation')" class="w-full sm:w-auto">
				<UTabs v-model="selectedRotation" :items="rotationItems" :content="false" size="sm" class="w-full sm:w-80" />
			</UFormField>
			<UFormField :label="t('page.events.search')" class="min-w-0 basis-full sm:basis-56 sm:flex-1">
				<UInput v-model="query" :placeholder="t('page.events.search')" icon="i-lucide-search" class="w-full" />
			</UFormField>
			<UFormField :label="t('page.events.filter_mode')" class="w-full sm:w-52">
				<USelect v-model="selectedMode" :items="modeItems" icon="i-lucide-list-filter" trailing-icon="i-lucide-chevron-down" selected-icon="i-lucide-check" class="w-full" />
			</UFormField>
		</UCard>
		<div v-if="status === 'pending'" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-busy="true">
			<span class="sr-only">{{ t('page.events.loading') }}</span>
			<USkeleton v-for="slot in 6" :key="slot" class="h-64 rounded-lg" />
		</div>
		<UEmpty v-else-if="status === 'error' && !rotation" icon="i-lucide-wifi-off" :title="t('page.events.unavailable')" :description="t('page.events.try_again')">
			<template #actions><UButton :label="t('page.events.refresh')" icon="i-lucide-refresh-cw" :loading="loading" @click="refetch()" /></template>
		</UEmpty>
		<template v-else>
			<UAlert v-if="status === 'error'" icon="i-lucide-wifi-off" color="warning" variant="subtle" :title="t('page.events.stale')" class="mb-5" />
			<div v-if="filteredEvents.length" class="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="events-grid">
				<EventCard v-for="event in filteredEvents" :key="event.id" :event="event" :upcoming="selectedRotation === 'upcoming'" :now="now" @inspect="inspect" />
			</div>
			<UEmpty v-else-if="hasFilters && events.length" icon="i-lucide-search" :title="t('page.events.no_matches')" :description="t('page.events.no_matches_description')">
				<template #actions><UButton :label="t('page.events.reset')" color="neutral" variant="subtle" @click="resetFilters" /></template>
			</UEmpty>
			<UEmpty
				v-else
				icon="i-lucide-calendar-clock"
				:title="t(selectedRotation === 'upcoming' ? 'page.events.no_upcoming' : 'page.events.no_current')"
				:description="t(selectedRotation === 'upcoming' ? 'page.events.upcoming_description' : 'page.events.empty_description')"
			/>
		</template>
		<p class="mt-8 text-xs leading-5 text-muted">
			{{ t('page.events.attribution') }}
			<NuxtLink to="https://github.com/tailsjs/brawl-stars-assets" target="_blank" external rel="noopener noreferrer" class="underline decoration-default underline-offset-4 hover:text-default">tailsjs</NuxtLink>,
			<NuxtLink to="https://github.com/Statscell/brawl-assets" target="_blank" external rel="noopener noreferrer" class="underline decoration-default underline-offset-4 hover:text-default">Statscell</NuxtLink>
			{{ t('page.events.and') }}
			<NuxtLink to="https://brawlify.com" target="_blank" external rel="noopener noreferrer" class="underline decoration-default underline-offset-4 hover:text-default">Brawlify</NuxtLink>.
		</p>
		<EventMapPreview v-model:open="mapOpen" :event="inspectedEvent" />
	</UContainer>
</template>
