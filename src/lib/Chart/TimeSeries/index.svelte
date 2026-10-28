<script>
	import Chart from '../index.svelte';

	/**
	 * Un ítem de serie de ECharts.
	 * @typedef {Object} EChartSeriesItem
	 * @property {string} [type]
	 * @property {string} [name]
	 * @property {boolean} [showSymbol]
	 * @property {boolean} [smooth]
	 * @property {boolean} [large]
	 * @property {Array<{value: Array, name?: string}>} [data]
	 * @property {Record<string, unknown>} [itemStyle]
	 * @property {Record<string, unknown>} [lineStyle]
	 * @property {Record<string, unknown>} [extra]
	 */

	/**
	 * Opción de configuración de ECharts (`option`).
	 * @typedef {Object} EChartOption
	 * @property {Record<string, unknown>} [title]
	 * @property {Array<EChartSeriesItem>} [series]
	 * @property {Record<string, unknown>} [tooltip]
	 * @property {Record<string, unknown>} [legend]
	 * @property {Record<string, unknown>} [grid]
	 * @property {Record<string, unknown>} [xAxis]
	 * @property {Record<string, unknown>} [yAxis]
	 * @property {Array<Record<string, unknown>>} [dataZoom]
	 * @property {Array<string|number>} [color]
	 * @property {Record<string, unknown>} [toolbox]
	 * @property {Record<string, unknown>} [backgroundColor]
	 * @property {Record<string, unknown>} [extra]
	 */

	/**
	 * Instancia de ECharts.
	 * @typedef {Object} EChartInstance
	 * @property {(option: Record<string, unknown>, opts?: Record<string, unknown>) => void} setOption
	 * @property {() => void} resize
	 * @property {() => void} dispose
	 * @property {(type: string, listener: Function) => void} on
	 * @property {(type: string, listener?: Function) => void} off
	 */

	/**
	 * Parámetros que recibe el formateador de tooltip de ECharts.
	 * @typedef {Object} EChartTooltipParams
	 * @property {string} [seriesName]
	 * @property {Array} [value]
	 * @property {number} [dataIndex]
	 * @property {number} [seriesIndex]
	 * @property {Record<string, unknown>} [data]
	 * @property {string} [color]
	 */

	/**
	 * @type {{
	 *   title?: string,
	 *   data?: Array<unknown>,
	 *   series?: Array<EChartSeriesItem>,
	 *   chart?: EChartInstance | null,
	 *   tooltipFormatter?: (params: EChartTooltipParams | Array<EChartTooltipParams>) => string,
	 *   option?: EChartOption
	 * }}
	 */
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
				formatter:
					tooltipFormatter ||
					function (params) {
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
