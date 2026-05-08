<script setup lang="ts">
const links = [
	{
		label: "Utilities",
		children: [
			{
				label: "Calculators",
				to: "https://nuxters.nuxt.com",
			},
			{
				label: "Community Events",
				to: "/utlities/community-events",
			},
		],
	},
	{
		label: "Links",
		children: [
			{
				label: "Discord Bot (not done)",
				to: "https://google.com/",
				target: "_blank",
			},
			{
				label: "Privacy Policy (not done)",
				to: "https://google.com/",
				target: "_blank",
			},
			{
				label: "Credits & About",
				to: "/about",
			},
		],
	},
];
</script>

<template>
	<UFooterColumns
		:columns="links"
		:ui="{
			left: 'max-w-xl col-span-2',
			center: 'xl:grid-cols-2 xl:col-span-1',
		}"
	>
		<template #left>
			<div class="flex h-full flex-col gap-2.5">
				<div>
					<div class="flex items-center">
						<NuxtImg src="/favicon.png" width="25" height="25" />
						<p class="ml-1 text-xl font-bold dark:text-primary-200 text-primary-500">BrawlBase</p>
					</div>
				</div>
				<p class="text-xs text-gray-400">
					This content is not affiliated with, endorsed, sponsored, or specifically approved by Supercell and Supercell
					is not responsible for it. For more information see
					<NuxtLink
						target="_blank"
						to="https://supercell.com/en/fan-content-policy/"
						class="text-primary hover:underline"
					>
						Supercell’s Fan Content Policy.
					</NuxtLink>
				</p>
			</div>
		</template>
	</UFooterColumns>
</template>
