export default defineNuxtRouteMiddleware(() => {
	// disable the loading indicator only for this page
	useLoadingIndicator().finish({ force: true });
});
