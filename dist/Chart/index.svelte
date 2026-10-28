<script>
	import * as echarts from 'echarts';
	import { onDestroy, onMount } from 'svelte';

	/**
	 * Un ítem de serie de ECharts. El consumidor puede enviar cualquier
	 * configuración de serie (type, data, itemStyle, lineStyle, etc.) y el
	 * componente le añade los valores por defecto (line, smooth, large).
	 * @typedef {Object} EChartSeriesItem
	 * @property {string} [type]
	 * @property {string} [name]
	 * @property {boolean} [showSymbol]
	 * @property {boolean} [smooth]
	 * @property {boolean} [large]
	 * @property {Array<{value: Array, name?: string}>} [data]
	 * @property {Record<string, unknown>} [itemStyle]
	 * @property {Record<string, unknown>} [lineStyle]
	 * @property {Record<string, unknown>} [emphasis]
	 * @property {Record<string, unknown>} [encode]
	 * @property {Record<string, unknown>} [markPoint]
	 * @property {Record<string, unknown>} [markLine]
	 * @property {Record<string, unknown>} [markArea]
	 * @property {Record<string, unknown>} [z]
	 * @property {Record<string, unknown>} [zlevel]
	 * @property {Record<string, unknown>} [extra] Cualquier otra propiedad válida de ECharts.
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
	 * @property {Record<string, unknown>} [extra] Cualquier otra propiedad válida de ECharts.
	 */

	/**
	 * Instancia de ECharts. Expone los métodos que usa el componente.
	 * @typedef {Object} EChartInstance
	 * @property {(option: Record<string, unknown>, opts?: Record<string, unknown>) => void} setOption
	 * @property {() => void} resize
	 * @property {() => void} dispose
	 * @property {(type: string, listener: Function) => void} on
	 * @property {(type: string, listener?: Function) => void} off
	 */

	/**
	 * @type {{
	 *   title?: string,
	 *   data?: Array<unknown>,
	 *   series?: Array<EChartSeriesItem>,
	 *   option?: Record<string, unknown>,
	 *   chart?: EChartInstance | null
	 * }}
	 */
	let {
		title = $bindable('Title'),
		data = $bindable([]),
		series = $bindable([]),
		option = $bindable({}),
		chart = $bindable(null)
	} = $props();

	let /** @type {HTMLElement|null} */ chartDom;
	let /** @type {EChartInstance|null} */ myChart;
	let dataZoomApplied = false;

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
		const optionObj = /** @type {Record<string, unknown>} */ (option ?? {});
		const dataZoom = optionObj.dataZoom;
		const restOption = /** @type {Record<string, unknown>} */ ({ ...optionObj });
		delete restOption.dataZoom;
		/** @type {Record<string, unknown>} */
		const nextOption = Object.assign({}, restOption, {
			title: Object.assign({ text: title }, option?.title ?? {}),
			series: buildSeries()
		});

		// `dataZoom` solo se aplica una vez, al render inicial: si se reenvía en cada
		// setOption, ECharts pisa el rango de zoom/selección que el usuario haya
		// arrastrado interactivamente con los valores estáticos de `option`.
		if (!dataZoomApplied && dataZoom) {
			nextOption.dataZoom = dataZoom;
		}

		if (myChart) {
			// `replaceMerge` para 'series': por defecto ECharts fusiona el arreglo de series
			// por índice, así que si el nuevo arreglo es más corto o corresponde a otro
			// conjunto de series (ej. el consumidor cambia de filtro y ahora hay menos/otras
			// series), las series "sobrantes" de la llamada anterior quedan dibujadas encima
			// de las nuevas en vez de desaparecer. replaceMerge le dice a ECharts que
			// reemplace el conjunto completo de series por el actual.
			myChart.setOption(nextOption, { replaceMerge: ['series'] });
			dataZoomApplied = true;
		}
	});

	onMount(() => {
		myChart = echarts.init(chartDom);
		chart = myChart;
		window.addEventListener('resize', handleResize);
	});

	onDestroy(() => {
		window.removeEventListener('resize', handleResize);
		myChart?.dispose();
	});
</script>

<div style="width: 100%; height: 400px;" bind:this={chartDom}></div>
