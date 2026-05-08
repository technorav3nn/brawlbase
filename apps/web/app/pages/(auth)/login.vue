<script setup lang="ts">
definePageMeta({
	middleware: "no-auth",
});
</script>

<template>
	<div>{{ $t("login.hero.title") }}</div>
</template>
