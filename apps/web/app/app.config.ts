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
			],
		},
	},
});
