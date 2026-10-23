<script setup lang="ts">
defineProps<{ title: string; description: string; icon: string }>();
</script>

<template>
	<header class="mb-6 flex items-center justify-between gap-5">
		<div>
			<h2 class="font-brawlstars text-3xl leading-tight text-pretty text-highlighted sm:text-4xl">{{ title }}</h2>
			<p class="mt-2 max-w-2xl text-sm leading-6 text-muted">{{ description }}</p>
		</div>
		<div
			class="hidden size-16 shrink-0 rotate-6 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary sm:grid"
			aria-hidden="true"
		>
			<UIcon :name="icon" class="size-8 -rotate-6" />
		</div>
	</header>
</template>
