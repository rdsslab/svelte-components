<script>
	import Chart from '../index.svelte';

	let {
		title = $bindable('Title'),
		data = $bindable([]),
		series = $bindable([]),
		chart = $bindable(null),
		tooltipFormatter = $bindable(undefined),
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
				// 'item' en vez de 'axis': con muchas series cuyos puntos no caen en el mismo
				// instante de tiempo (ej. una serie por endpoint, cada una con sus propios
				// timestamps de request), 'axis' junta en un solo tooltip el punto más cercano
				// de cada serie — ilegible con decenas de series. 'item' muestra únicamente el
				// punto exacto bajo el cursor.
				trigger: 'item',
				formatter: tooltipFormatter || function (params) {
					// Genérico: no asume nada sobre qué representa la serie (endpoint, métrica,
					// etc.) — solo usa lo que ECharts ya sabe (seriesName) y lo que cada punto
					// trae (fecha/hora en value[0], valor en value[1]).
					var points = Array.isArray(params) ? params : [params];
					return points
						.map(function (p) {
							var date = new Date(p.value[0]);
							var pad = function (n) {
								return String(n).padStart(2, '0');
							};
							var formattedDate =
								pad(date.getDate()) +
								'/' +
								pad(date.getMonth() + 1) +
								'/' +
								date.getFullYear() +
								' ' +
								pad(date.getHours()) +
								':' +
								pad(date.getMinutes()) +
								':' +
								pad(date.getSeconds());
							var label = p.seriesName ? p.seriesName + '<br/>' : '';
							return label + formattedDate + ' : ' + p.value[1];
						})
						.join('<br/><br/>');
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
