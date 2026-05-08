<script setup lang="ts">
import { Shader, Pixelate, Plasma, Swirl } from "shaders/vue";
import { resolveCssVariable } from "#shared/utils/css";

const primary = resolveCssVariable("--color-primary-300");
const neutral = resolveCssVariable("--ui-bg-elevated");
</script>

<template>
	<Shader>
		<Pixelate
			:gap="{
				type: 'map',
				curve: 0.35,
				source: 'idmmbhthud5inxgebqc',
				channel: 'alphaInverted',
				inputMax: 1,
				inputMin: 0,
				outputMax: 1,
				outputMin: 0.16,
			}"
			:roundness="0.2"
			:scale="68"
			:transform="{ rotation: 180 }"
		>
			<Plasma
				:balance="57"
				:color-a="primary"
				:color-b="neutral"
				:contrast="1.6"
				:density="3.3"
				:intensity="1.8"
				:visible="true"
			/>
		</Pixelate>
		<Swirl
			id="idmmbhthud5inxgebqc"
			:amplitude="0.1"
			:position="{
				x: 0.5,
				y: 1,
			}"
			:softness="0.8"
			:thickness="0.7"
			:visible="false"
		/>
	</Shader>
</template>
