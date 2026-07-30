<script>
	import * as echarts from 'echarts';
	import { onDestroy, onMount } from 'svelte';

	let {
		title = $bindable('Title'),
		data = $bindable([]),
		series = $bindable([]),
		option = $bindable({}),
		chart = $bindable(null)
	} = $props();

	let chartDom;
	let myChart;

	function buildSeries() {
		if (series && series.length > 0) {
			return series.map((s) => ({
				type: 'line',
				showSymbol: false,
				smooth: true,
				large: true,
				...s
			}));
		}
		return [{ type: 'line', showSymbol: false, smooth: true, large: true, data }];
	}

	function handleResize() {
		myChart?.resize();
	}

	$effect(() => {
		// Leer las props reactivas de forma incondicional: si quedan detrás del guard de
		// `myChart`, en el primer render (antes de que onMount asigne myChart) este efecto
		// no registraría ninguna dependencia y nunca se volvería a ejecutar.
		const nextOption = {
			...option,
			title: {
				...option?.title,
				text: title
			},
			series: buildSeries()
		};

		if (myChart) {
			myChart.setOption(nextOption);
		}
	});

	onMount(() => {
		myChart = echarts.init(chartDom);
		chart = myChart;
		if (option) {
			myChart.setOption({ ...option, series: buildSeries() });
		}
		window.addEventListener('resize', handleResize);
	});

	onDestroy(() => {
		window.removeEventListener('resize', handleResize);
		myChart?.dispose();
	});
</script>

<div style="width: 100%; height: 400px;" bind:this={chartDom}></div>
