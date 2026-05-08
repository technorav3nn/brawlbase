<script setup lang="ts">
import { LazyAppProfileSlideover } from "#components";

const { data: session } = await authClient.useSession(useFetch);

const overlay = useOverlay();
function onProfileClick() {
	for (const o of overlay.overlays) overlay.close(o.id);
	overlay.create(LazyAppProfileSlideover).open();
}

const links = computed<any[]>(() => [
	{
		label: "Brawlers",
		icon: "i-lucide-star",
		to: "/brawlers",
	},
	{
		label: "Events",
		icon: "i-lucide-calendar-days",
		to: "/events",
	},
	{
		label: "Players",
		icon: "i-lucide-users",
		to: "/players",
	},
	{
		label: "Leaderboards",
		icon: "i-lucide-chart-column-decreasing",
		to: "/leaderboards",
		children: [
			{
				label: "Players",
				to: "/leaderboards/players",
				description: "View the best players!",
				icon: "i-lucide-users",
			},
			{
				label: "Clubs",
				to: "/leaderboards/clubs",
				description: "View the clubs leaderboard!",
				icon: "i-lucide-shield-user",
			},
			{
				label: "Brawlers",
				to: "/leaderboards/brawlers",
				description: "View the leaderboards of brawlers!",
				class: "w-full",
				icon: "i-lucide-star",
			},
		],
	},
	{
		label: "More",
		icon: "i-lucide-circle-ellipsis",
		children: [
			{
				label: "Clubs",
				icon: "i-lucide-shield-user",
				to: "/clubs",
				description: "Search and view your club or other clubs!",
			},
			{
				label: "Brawl Stars Inbox",
				icon: "i-lucide-inbox",
				to: "/inbox",
				description: "Read the latest news about Brawl Stars!",
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
			<UButton v-if="!session" color="neutral" variant="ghost" class="hidden sm:block" to="/login">Log In</UButton>
			<UButton v-if="!session" class="hidden sm:block" to="/signup">Sign Up</UButton>
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
