<script setup lang="ts">
import type { ButtonProps } from "@nuxt/ui";

function staggerMotion(index: number = 0) {
	return {
		initial: { opacity: 0 },
		whileInView: { opacity: 1 },
		inViewOptions: { once: true, amount: 1 },
		transition: { duration: 0.6, delay: index * 0.08 },
	};
}

const mainHeroLinks: ButtonProps[] = [
	{
		label: "Get Started",
		to: "/brawlers",
	},
	{ label: "Sign Up", to: "/signup", variant: "subtle", color: "neutral", trailingIcon: "i-heroicons-arrow-right" },
];
</script>

<template>
	<div>
		<UPageHero
			:ui="{
				root: 'pb-24 sm:pb-32',
				container: 'relative z-10 lg:py-32',
				wrapper: 'flex flex-col items-center',
				title: 'sm:text-6xl lg:text-7xl xl:text-[80px] tracking-tighter leading-[1.05]',
				description: 'mt-5 max-w-xl mx-auto text-base sm:text-lg leading-relaxed text-default',
				links: 'gap-3',
			}"
		>
			<template #top>
				<Motion v-bind="staggerMotion(0)">
					<LandingHeroShaders class="absolute top-0 inset-x-0 opacity-30 h-full" />
					<!-- bottom div to make the shaders fade into the bottom -->
					<div
						class="absolute bottom-0 inset-x-0 h-1/3 bg-linear-to-b from-background to-default/100 pointer-events-none"
					/>
				</Motion>
			</template>
			<template #title>
				<Motion as-child :initial="{ opacity: 0, y: 20 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.6 }">
					<div class="mx-auto max-w-4xl *:leading-11 sm:*:leading-19">
						Explore Brawl Stars with
						<div>
							<template v-for="i in 'BrawlBase'.length" :key="i">
								<Motion
									as="span"
									:initial="{ opacity: 0, y: 20 }"
									:animate="{ opacity: 1, y: 0 }"
									:transition="{ delay: i * 0.08 + 0.2, duration: 0.5 }"
									class="inline-block text-primary"
								>
									{{ "BrawlBase"[i - 1] }}
								</Motion>
							</template>
						</div>
					</div>
				</Motion>
			</template>
			<template #description>
				<Motion
					as-child
					:initial="{ opacity: 0, y: 20 }"
					:animate="{ opacity: 1, y: 0 }"
					:transition="{ delay: 0.2, duration: 0.5 }"
				>
					<p>View players, brawlers, events and more with BrawlBase, your home for everything Brawl Stars.</p>
				</Motion>
			</template>
			<template #links>
				<Motion
					v-for="(link, index) in mainHeroLinks"
					:key="index"
					as-child
					:initial="{ opacity: 0, y: 20 }"
					:animate="{ opacity: 1, y: 0 }"
					:transition="{ delay: 0.4 + index * 0.25, duration: 0.5 }"
				>
					<UButton size="xl" v-bind="link" />
				</Motion>
			</template>
		</UPageHero>

		<UPageSection
			id="features"
			title="Everything you need to build modern Nuxt apps"
			description="Start with a solid foundation. This template includes all the essentials for building production-ready applications with Nuxt UI's powerful component system."
			:features="[
				{
					icon: 'i-lucide-rocket',
					title: 'Production-ready from day one',
					description:
						'Pre-configured with TypeScript, ESLint, Tailwind CSS, and all the best practices. Focus on building features, not setting up tooling.',
				},
				{
					icon: 'i-lucide-palette',
					title: 'Beautiful by default',
					description:
						'Leveraging Nuxt UI\'s design system with automatic dark mode, consistent spacing, and polished components that look great out of the box.',
				},
				{
					icon: 'i-lucide-zap',
					title: 'Lightning fast',
					description:
						'Optimized for performance with SSR/SSG support, automatic code splitting, and edge-ready deployment. Your users will love the speed.',
				},
				{
					icon: 'i-lucide-blocks',
					title: '100+ components included',
					description:
						'Access Nuxt UI\'s comprehensive component library. From forms to navigation, everything is accessible, responsive, and customizable.',
				},
				{
					icon: 'i-lucide-code-2',
					title: 'Developer experience first',
					description:
						'Auto-imports, hot module replacement, and TypeScript support. Write less boilerplate and ship more features.',
				},
				{
					icon: 'i-lucide-shield-check',
					title: 'Built for scale',
					description:
						'Enterprise-ready architecture with proper error handling, SEO optimization, and security best practices built-in.',
				},
			]"
		/>

		<UPageSection>
			<UPageCTA
				title="Ready to build your next Nuxt app?"
				description="Join thousands of developers building with Nuxt and Nuxt UI. Get this template and start shipping today."
				variant="subtle"
				:links="[
					{
						label: 'Start building',
						to: 'https://ui.nuxt.com/docs/getting-started/installation/nuxt',
						target: '_blank',
						trailingIcon: 'i-lucide-arrow-right',
						color: 'neutral',
					},
					{
						label: 'View on GitHub',
						to: 'https://github.com/nuxt-ui-templates/starter',
						target: '_blank',
						icon: 'i-simple-icons-github',
						color: 'neutral',
						variant: 'outline',
					},
				]"
			/>
		</UPageSection>
	</div>
</template>
