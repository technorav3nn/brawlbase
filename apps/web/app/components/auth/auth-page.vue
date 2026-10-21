<script setup lang="ts">
import type { AuthFormField, ButtonProps } from "@nuxt/ui";
import { Shader, Aurora } from "shaders/vue";

const props = defineProps<{
	type: "login" | "signup";
}>();

const { t } = useI18n();
const primary = resolveCssVariable("--ui-primary");
const background = resolveCssVariable("--ui-bg");
const accented = resolveCssVariable("--ui-bg-accented");
const muted = resolveCssVariable("--ui-bg-muted");

const validationError = ref<string | null>(null);
const loading = ref(false);

const token = ref<string>();

async function onSubmit({ password, email, username }: { password: string; email: string; username?: string }) {
	if (!password || !email) return (validationError.value = t("page.auth.error_fields"));
	if (!token.value) return (validationError.value = t("page.auth.error_captcha"));

	loading.value = true;
	let result: ReturnType<typeof authClient.signIn.email | typeof authClient.signUp.email> | null = null;
	if (props.type === "login") {
		result = await authClient.signIn.email({
			email,
			password,
			fetchOptions: {
				headers: {
					"x-captcha-response": token.value,
				},
			},
		});
	} else {
		if (!username) return (validationError.value = t("page.auth.error_fields"));
		console.log(token.value);
		result = await authClient.signUp.email({
			name: username,
			email,
			password,
			fetchOptions: {
				headers: {
					"x-captcha-response": token.value,
				},
			},
		});
	}

	loading.value = false;
	if (result.error) {
		validationError.value = result.error.message ?? t("page.auth.error_unknown");
		return;
	}

	await navigateTo("/");
}

const links = computed<ButtonProps[]>(() => [
	{
		label: t(props.type === "login" ? "action.create_account" : "action.login"),
		to: props.type === "login" ? "/signup" : "/login",
		trailingIcon: "i-lucide-arrow-right",
		class: "hidden sm:flex",
	},
	{
		label: t(props.type === "login" ? "page.auth.forgot_password" : "page.auth.signup.cta"),
		to: "/forgot-password",
		variant: "subtle",
		color: "neutral",
		icon: "i-lucide-circle-question-mark",
	},
]);

const loginFields = computed<AuthFormField[]>(() => [
	{
		name: "email",
		type: "text",
		label: t("page.auth.form.email_label"),
		placeholder: t("page.auth.form.email_placeholder"),
		required: true,
	},
	{
		name: "password",
		type: "password",
		label: t("page.auth.form.password_label"),
		placeholder: t("page.auth.form.password_placeholder"),
		required: true,
	},
]);

const fields = computed<AuthFormField[]>(() => {
	if (props.type === "signup") {
		return [
			{
				name: "username",
				type: "text",
				label: t("page.auth.form.username_label"),
				placeholder: t("page.auth.form.username_placeholder"),
				required: true,
			},
			...loginFields.value,
		];
	}
	return loginFields.value;
});

const colorMode = useColorMode();
const mode = computed(() => colorMode.value);

const motionProps = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	transition: { duration: 0.2, delay: 0 },
};
</script>

<template>
	<UPage>
		<Motion v-bind="motionProps">
			<ClientOnly>
				<Shader class="absolute top-0 inset-x-0 opacity-30 h-full -z-10" :ui="{ root: 'pointer-events-none' }">
					<Aurora
						:color-a="primary!"
						:color-b="background!"
						:color-c="accented!"
						:color-d="muted!"
						:speed="10"
						:height="350"
						:center="{ x: 0.5, y: 0 }"
					/>
				</Shader>
			</ClientOnly>
			<div class="absolute bottom-0 inset-x-0 h-1/3 bg-linear-to-b from-background to-default pointer-events-none" />
		</Motion>
		<UPageCTA
			:title="t(`page.auth.${props.type}.hero_title`)"
			:description="t(`page.auth.${props.type}.hero_description`)"
			orientation="horizontal"
			variant="naked"
			:ui="{
				container: 'px-4 sm:px-4 sm:py-12 justify-center items-center sm:gap-0 gap-10! md:flex-row',
				title: 'sm:text-3xl md:text-4xl lg:text-5xl',
			}"
			:links="links"
		>
			<div class="flex w-full items-center justify-center">
				<UCard class="w-full bg-default/70 backdrop-blur-lg" variant="outline">
					<UAuthForm
						:ui="{ title: 'text-start' }"
						:submit="{
							label: t(`action.${props.type}`),
							loading,
							icon: 'i-heroicons-arrow-right-end-on-rectangle-20-solid',
						}"
						:fields
						:loading="loading"
						@submit="void onSubmit($event.data as any)"
					>
						<template #title>
							<div class="flex items-center gap-2">
								<UIcon name="i-heroicons-user-circle" class="size-8" />

								<h1 class="text-xl font-bold">
									{{ t(`page.auth.${props.type}.form_title`) }}
								</h1>
							</div>
						</template>
						<template #validation>
							<div class="h-16.25">
								<NuxtTurnstile v-model="token" :options="{ theme: mode as any, size: 'flexible' }" />
							</div>
							<UAlert
								v-if="validationError"
								color="error"
								variant="subtle"
								icon="i-heroicons-information-circle-20-solid"
								:title="validationError"
							/>
						</template>
					</UAuthForm>
				</UCard>
			</div>
		</UPageCTA>
	</UPage>
</template>
