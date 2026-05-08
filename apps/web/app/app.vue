<script setup lang="ts">
useSeoMeta({
	title: "Brawl Base",
	titleTemplate: "%s | Brawl Base",
});
</script>

<template>
	<Teleport to="#teleports">
		<NuxtLoadingIndicator color="red" class="bg-linear-to-r! from-primary! to-primary-500" :throttle="380" />
	</Teleport>
	<UApp>
		<AppHeader />
		<UMain class="relative">
			<NuxtLayout>
				<NuxtPage />
			</NuxtLayout>
		</UMain>
		<AppFooter />
	</UApp>
</template>

<style global>
.spinner-icon {
	width: 18px;
	height: 18px;
	box-sizing: border-box;

	border: solid 2px transparent;
	border-top-color: #29d;
	border-left-color: #29d;
	border-radius: 50%;

	-webkit-animation: nprogress-spinner 400ms linear infinite;
	animation: nprogress-spinner 400ms linear infinite;
}

:root {
	--primary-lighter: color-mix(in srgb, rgb(var(--color-primary-DEFAULT)) 80%, white);
	--primary-light: color-mix(in srgb, rgb(var(--color-primary-DEFAULT)) 60%, white);
	--primary: var(--color-primary-DEFAULT);
}
.unovis-xy-container {
	--vis-crosshair-line-stroke-color: var(--ui-color-primary-500);
	--vis-crosshair-circle-stroke-color: #fff;

	--vis-axis-grid-color: var(--ui-color-neutral-200);
	--vis-axis-tick-color: var(--ui-color-neutral-200);
	--vis-axis-tick-label-color: var(--ui-color-neutral-400);

	--vis-tooltip-background-color: #fff;
	--vis-tooltip-border-color: var(--ui-color-neutral-200);
	--vis-tooltip-text-color: var(--ui-color-neutral-900);
}

.dark {
	.unovis-xy-container {
		--vis-crosshair-line-stroke-color: var(--ui-color-primary-400);
		--vis-crosshair-circle-stroke-color: var(--ui-color-neutral-900);

		--vis-axis-grid-color: var(--ui-color-neutral-800);
		--vis-axis-tick-color: var(--ui-color-neutral-800);
		--vis-axis-tick-label-color: var(--ui-color-neutral-500);

		--vis-tooltip-background-color: var(--ui-color-neutral-900);
		--vis-tooltip-border-color: var(--ui-color-neutral-800);
		--vis-tooltip-text-color: #fff;
	}
}
</style>
