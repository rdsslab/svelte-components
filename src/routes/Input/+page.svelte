<script>
	import { Input,  PredictiveInput } from '$lib/index.js';
	let value = '{}';
	let selectedHours = 2;
</script>

<Input label="Input" bind:value />
<Input label="Input" bind:value type="number" />
	<Input label="Hours" type="number" min={2} step={5} bind:value={selectedHours}    />
<PredictiveInput label="PredictiveInput" bind:value />
