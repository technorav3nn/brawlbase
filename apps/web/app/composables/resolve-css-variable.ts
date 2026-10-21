import { onUnmounted, ref } from "vue";

export function resolveCssVariable(variable: string) {
	const state = ref(import.meta.client ? getComputedStyle(document.documentElement).getPropertyValue(variable).trim() : null);
	if (!import.meta.client) {
		return state;
	}

	const observer = new MutationObserver(() => {
		state.value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
	});
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	onUnmounted(() => {
		observer.disconnect();
	});
	return state;
}
