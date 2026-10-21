<script setup lang="ts">
import { LazyAppProfileSlideover } from "#components";
import { en, es } from "@nuxt/ui/locale";

const { t, locale, setLocale } = useI18n();
const localeOptions = [
	{ label: "English", value: "en" as const },
	{ label: "Español", value: "es" as const },
];

function onLocaleChange(value: string) {
	if (value === "en" || value === "es") setLocale(value);
}

const { data: session } = await authClient.useSession(useFetch);

const overlay = useOverlay();
function onProfileClick() {
	for (const o of overlay.overlays) overlay.close(o.id);
	overlay.create(LazyAppProfileSlideover).open();
}

const links = computed<any[]>(() => [
	{
		label: t("nav.brawlers"),
		icon: "i-lucide-star",
		to: "/brawlers",
	},
	{
		label: t("nav.events"),
		icon: "i-lucide-calendar-days",
		to: "/events",
	},
	{
		label: t("nav.players"),
		icon: "i-lucide-users",
		to: "/players",
	},
	{
		label: t("nav.leaderboards"),
		icon: "i-lucide-chart-column-decreasing",
		to: "/leaderboards",
		children: [
			{
				label: t("nav.players"),
				to: "/leaderboards/players",
				description: t("nav.players_description"),
				icon: "i-lucide-users",
			},
			{
				label: t("nav.clubs"),
				to: "/leaderboards/clubs",
				description: t("nav.clubs_description"),
				icon: "i-lucide-shield-user",
			},
			{
				label: t("nav.brawlers"),
				to: "/leaderboards/brawlers",
				description: t("nav.brawlers_description"),
				class: "w-full",
				icon: "i-lucide-star",
			},
		],
	},
	{
		label: t("nav.more"),
		icon: "i-lucide-circle-ellipsis",
		children: [
			{
				label: t("nav.clubs"),
				icon: "i-lucide-shield-user",
				to: "/clubs",
				description: t("nav.club_search_description"),
			},
			{
				label: t("nav.inbox"),
				icon: "i-lucide-inbox",
				to: "/inbox",
				description: t("nav.inbox_description"),
			},
		],
	},
]);
const route = useRoute();

const mobileLinks = computed(() =>
	links.value.map((link) => ({
		...link,
		defaultOpen: link.children && route.path.startsWith(link.to as string),
	}))
);
const linksWithoutIcons = computed(() => links.value.map((link) => ({ ...link, icon: undefined })));
</script>

<template>
	<UHeader>
		<template #left>
			<NuxtLink to="/" class="flex items-center">
				<NuxtImg src="/favicon.png" width="25" height="25" />
				<p class="ml-1 text-xl font-bold dark:text-primary-200 text-primary-500">BrawlBase</p>
			</NuxtLink>
		</template>

		<template #right>
			<ULocaleSelect :model-value="locale" :locales="[en, es]" @update:model-value="onLocaleChange" />

			<UButton v-if="!session" color="neutral" variant="ghost" class="hidden sm:block" to="/login">{{
				t("action.login")
			}}</UButton>
			<UButton v-if="!session" class="hidden sm:block" to="/signup">{{ t("action.signup") }}</UButton>
			<UButton v-if="!session" class="sm:hidden" color="primary" to="/login" icon="i-lucide-log-out" square />
			<UButton
				v-if="session"
				:ui="{ base: 'gap-x-[0.095rem]' }"
				variant="ghost"
				color="neutral"
				class="px-1.5"
				@click="onProfileClick"
			>
				<NuxtImg v-if="session?.user.image" class="rounded-full" width="28" height="28" :src="session?.user.image" />
				<UAvatar v-else class="h-7 w-7" :alt="session?.user.name" />
			</UButton>
			<UColorModeButton class="[&_>span]:fill-amber-100!" />
		</template>

		<UNavigationMenu :items="linksWithoutIcons" variant="link" content-orientation="vertical" />

		<template #body>
			<UNavigationMenu orientation="vertical" :items="mobileLinks" class="-mx-2.5" />
		</template>
	</UHeader>
</template>
