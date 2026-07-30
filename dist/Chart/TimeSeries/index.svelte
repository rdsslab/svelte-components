<script>
	import Chart from '../index.svelte';

	let {
		title = $bindable('Title'),
		data = $bindable([]),
		series = $bindable([]),
		chart = $bindable(null),
		option = $bindable({
			title: {
				text: title,
				left: 'center'
			},
			toolbox: {
				feature: {
					saveAsImage: {}
				}
			},
			legend: series.length > 0 ? { top: 36, left: 'center', type: 'scroll' } : undefined,
			grid: series.length > 0 ? { top: 80, left: 48, right: 24, bottom: 70 } : undefined,
			tooltip: {
				trigger: 'axis',
				formatter: function (params) {
					// Aqui para darle formato al texto del tooltip
					//console.log(params);
					params = params[0];
					var date = new Date(params.name);
					return (
						date.getDate() +
						'/' +
						(date.getMonth() + 1) +
						'/' +
						date.getFullYear() +
						' : ' +
						params.value[1]
					);
				},
				axisPointer: {
					animation: false
				}
			},
			xAxis: {
				type: 'time',
				scale: false,
				interval: 1000 * 60 * 30,
				splitLine: {
					show: true, // Mostrar líneas de grilla del eje X
					lineStyle: {
						//color: '#e6eaf0', // Color rojo para las líneas verticales
						//width: 1, // Ancho de 2 píxeles
						opacity: 0.2
						//type: 'solid' // Puedes usar 'dashed', 'dotted', 'solid'
					}
				}
			},
			yAxis: {
				type: 'value',
				boundaryGap: [0, '100%'],
				lineStyle: {
					//color: '#e6eaf0', // Color rojo para las líneas verticales
					//width: 1, // Ancho de 2 píxeles
					opacity: 0.2
					//type: 'solid' // Puedes usar 'dashed', 'dotted', 'solid'
				},
				splitLine: {
					show: true
				}
			},
			dataZoom: [
				{
					type: 'inside',
					start: 75,
					end: 100
				},
				{
					start: 0,
					end: 20
				}
			]
		})
	} = $props();
</script>

<Chart bind:title bind:option bind:data bind:series bind:chart></Chart>
