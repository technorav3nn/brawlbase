export default defineAppConfig({
	ui: {
		button: {
			compoundVariants: [
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
				base: "font-semibold",
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
		slideover: {
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
				content: "animate-none!",
			},
		},
		selectMenu: {
			slots: {
				content: "animate-none!",
			},
		},
	},
});
