<script setup lang="ts">
import type { AuthFormField, ButtonProps } from "@nuxt/ui";
import { Shader, Aurora } from "shaders/vue";
import { resolveCssVariable } from "#shared/utils/css";

const props = defineProps<{
	type: "login" | "signup";
}>();

const validationError = ref<string | null>(null);
const loading = ref(false);

const token = ref<string>();

const { t } = useI18n();

async function onSubmit({ password, email, username }: { password: string; email: string; username?: string }) {
	if (!password || !email) return (validationError.value = t("page.auth.error.fields"));
	if (!token.value) return (validationError.value = t("page.auth.error.captcha"));

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
		if (!username) return (validationError.value = t("page.auth.error.fields"));
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
		validationError.value = result.error.message ?? "An unknown error occurred.";
		return;
	}

	await navigateTo("/");
}

const links: ButtonProps[] = [
	{
		label: t(`page.auth.${props.type}.cta`),
		to: props.type === "login" ? "/signup" : "/login",
		trailingIcon: "i-lucide-arrow-right",
		class: "hidden sm:flex",
	},
	{
		label: t("page.auth.forgot_password"),
		to: "/forgot-password",
		variant: "subtle",
		color: "neutral",
		icon: "i-lucide-circle-question-mark",
	},
];

const loginFields: AuthFormField[] = [
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
];

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
			...loginFields,
		];
	}
	return loginFields;
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
						:color-a="resolveCssVariable('--ui-primary')!.value!"
						:color-b="resolveCssVariable('--ui-bg')!.value!"
						:color-c="resolveCssVariable('--ui-bg-accented')!.value!"
						:color-d="resolveCssVariable('--ui-bg-muted')!.value!"
						:speed="10"
						:height="350"
						:center="{ x: 0.5, y: 0 }"
					/>
				</Shader>
			</ClientOnly>
			<div class="absolute bottom-0 inset-x-0 h-1/3 bg-linear-to-b from-background to-default pointer-events-none" />
		</Motion>
		<UPageCTA
			:title="$t(`page.auth.${props.type}.hero_title`)"
			:description="$t(`page.auth.${props.type}.hero_description`)"
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
							label: $t(`action.${props.type}`),
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
									{{ $t(`page.auth.${props.type}.form_title`) }}
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
