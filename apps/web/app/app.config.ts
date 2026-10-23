export default defineAppConfig({
	ui: {
		container: {
			base: "max-w-[90rem]",
		},
		button: {
			compoundVariants: [
				{
					variant: ["ghost", "link"],
					class: "brawl-button-quiet",
				},
				{
					color: "primary",
					variant: "gradient",
					class: "bg-gradient-to-b from-primary to-primary-400 text-inverted shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.25)] transition-all duration-150 hover:from-primary-400 hover:to-primary-500 transition-colors duration-150",
				},
				{
					color: "neutral",
					variant: "gradient",
					class: "bg-gradient-to-b from-accented to-elevated shadow-[inset_0_1px_0_rgba(100,100,100,0.25),0_1px_2px_rgba(0,0,0,0.25)] transition-all duration-150 hover:from-elevated hover:to-elevated transition-colors duration-150",
				},
				{
					color: "primary" as const,
					variant: "solid" as const,
					class: "hover:bg-primary active:bg-primary hover:bg-primary-400 transition-colors duration-150",
				},
			],
			slots: {
				base: "brawl-button",
			},
			variants: {
				size: {
					xs: {
						base: "px-3",
					},
					sm: {
						base: "px-4",
					},
					md: {
						base: "px-4",
					},
					lg: {
						base: "px-5",
					},
					xl: {
						base: "px-6",
					},
				},
			},
		},
		card: {
			slots: {
				root: "brawl-panel",
				header: "brawl-panel-header",
			},
		},
		pageCard: {
			slots: {
				root: "brawl-panel",
			},
		},
		pageCTA: {
			compoundVariants: [
				{
					variant: ["solid", "outline", "soft", "subtle"],
					class: { root: "brawl-panel" },
				},
			],
		},
		header: {
			slots: {
				root: "",
				container: "gap-2",
				right: "gap-1",
				center: "lg:hidden xl:flex",
				toggle: "lg:inline-flex xl:hidden",
				content: "brawl-drawer lg:flex xl:hidden",
				overlay: "lg:block xl:hidden",
			},
		},
		navigationMenu: {
			slots: {
				link: "brawl-nav-link",
				viewport: "brawl-menu",
				childLink: "brawl-menu-item",
			},
		},
		input: {
			slots: { base: "brawl-field" },
		},
		textarea: {
			slots: { base: "brawl-field" },
		},
		badge: {},
		tabs: {
			slots: {
				list: "brawl-tab-list",
				trigger: "brawl-tab",
				indicator: "brawl-tab-indicator",
			},
		},
		modal: {
			slots: {
				content: "brawl-panel",
				header: "brawl-panel-header",
			},
		},
		popover: {
			slots: { content: "brawl-menu" },
		},
		dropdownMenu: {
			slots: { content: "brawl-menu", item: "brawl-menu-item" },
		},
		alert: {
			slots: { root: "brawl-panel" },
		},
		slideover: {
			slots: {
				content: "brawl-drawer",
				header: "brawl-panel-header",
			},
			compoundVariants: [
				{
					transition: true,
					side: "right",
					class: {
						content:
							"data-[state=open]:animate-[slide-in-from-right_300ms_cubic-bezier(0.42,0,0.2,1)] data-[state=closed]:animate-[slide-out-to-right_190ms_cubic-bezier(0.42,0,0.2,1)]",
					},
				},
			],
		},
		select: {
			slots: {
				base: "brawl-field brawl-select",
				content: "brawl-menu animate-none!",
				item: "brawl-menu-item",
			},
		},
		selectMenu: {
			slots: {
				base: "brawl-field brawl-select",
				content: "brawl-menu animate-none!",
				item: "brawl-menu-item",
			},
		},
	},
});
