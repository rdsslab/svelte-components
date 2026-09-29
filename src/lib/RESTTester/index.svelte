<script module>
	const METHODS = [
		{ method: 'CONNECT', label: 'CONNECT' },
		{ method: 'DELETE', label: 'DELETE' },
		{ method: 'GET', label: 'GET' },
		{ method: 'HEAD', label: 'HEAD' },
		{ method: 'OPTIONS', label: 'OPTIONS' },
		{ method: 'POST', label: 'POST' },
		{ method: 'PATCH', label: 'PATCH' },
		{ method: 'PUT', label: 'PUT' },
		{ method: 'TRACE', label: 'TRACE' }
	];

	const RESPONSES_AS = [
		{ as: 'json', label: 'JSON' },
		{ as: 'datatable', label: 'Table' },
		{ as: 'text', label: 'Text' }
	];

	const EXTENSION_MAP = {
		'image/jpeg': ['jpg', 'jpeg'],
		'image/png': ['png'],
		'image/gif': ['gif'],
		'image/webp': ['webp'],
		'image/svg+xml': ['svg'],
		'image/bmp': ['bmp'],
		'image/x-icon': ['ico'],
		'image/tiff': ['tiff', 'tif'],
		'application/pdf': ['pdf'],
		'application/msword': ['doc'],
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
		'application/vnd.ms-excel': ['xls'],
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
		'application/vnd.ms-powerpoint': ['ppt'],
		'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
		'application/rtf': ['rtf'],
		'application/vnd.oasis.opendocument.text': ['odt'],
		'application/vnd.oasis.opendocument.spreadsheet': ['ods'],
		'application/vnd.oasis.opendocument.presentation': ['odp'],
		'text/plain': ['txt'],
		'text/html': ['html', 'htm'],
		'text/css': ['css'],
		'text/javascript': ['js'],
		'application/javascript': ['js'],
		'text/csv': ['csv'],
		'text/xml': ['xml'],
		'application/xml': ['xml'],
		'application/json': ['json'],
		'text/markdown': ['md'],
		'audio/mpeg': ['mp3'],
		'audio/wav': ['wav'],
		'audio/x-wav': ['wav'],
		'audio/ogg': ['ogg', 'oga'],
		'audio/webm': ['weba'],
		'audio/aac': ['aac'],
		'audio/midi': ['midi', 'mid'],
		'video/mp4': ['mp4'],
		'video/mpeg': ['mpeg', 'mpg'],
		'video/webm': ['webm'],
		'video/ogg': ['ogv'],
		'video/x-msvideo': ['avi'],
		'video/3gpp': ['3gp'],
		'video/3gpp2': ['3g2'],
		'application/zip': ['zip'],
		'application/x-rar-compressed': ['rar'],
		'application/x-7z-compressed': ['7z'],
		'application/x-tar': ['tar'],
		'application/gzip': ['gz'],
		'application/x-bzip': ['bz'],
		'application/x-bzip2': ['bz2'],
		'font/woff': ['woff'],
		'font/woff2': ['woff2'],
		'font/ttf': ['ttf'],
		'font/otf': ['otf'],
		'application/octet-stream': ['bin'],
		'application/epub+zip': ['epub'],
		'application/java-archive': ['jar']
	};
</script>

<script>
	import { onMount, onDestroy } from 'svelte';
	import { Tab, Table, Input } from '../index.js';
	import Query from './key_value/kv.svelte';
	import Headers from './key_value/kv.svelte';
	import Auth from './auth.svelte';
	import Body from './body.svelte';
	import uFetch from '@rdsslab/uFetch';
	import JSONView from '../JSONView/index.svelte';
	import {
		normalizeRequest,
		downloadRequestFile,
		getRequestHeaders,
		toHeadersObject,
		REST_EXPORT_FORMATS
	} from './request.js';
	import { parseRequestFile, REST_IMPORT_ACCEPT } from './importer.js';

	let {
		url = $bindable(''),
		method = $bindable('GET'),
		limitSizeResponseView = $bindable(20000),
		methodDisabled = $bindable(false),
		showExport = $bindable(true),
		showImport = $bindable(true),
		data = $bindable({
			query: [
				{
					enabled: true,
					key: '',
					value: ''
				}
			],
			body: {
				selection: 0,
				js: {},
				xml: {
					code: ''
				},
				text: {},
				json: {
					code: {}
				},
				form: [],
				urlencoded: []
			},
			headers: [
				{
					enabled: false,
					key: '',
					value: ''
				}
			],
			auth: {
				selection: 0,
				basic: {},
				bearer: {}
			}
		}),
		onchange = () => {}
	} = $props();

	let last_response = $state();
	let time_responde = $state();
	let response_as = $state('json');
	let active_tab = $state(0);
	let data_result = $state({ data: '', sizeKBResponse: -1 });
	let request_headers = $state([]);
	let response_headers = $state([]);
	let show_headers = $state(false);
	let running = $state(false);
	let elapsed_ms = $state(0);
	let export_error = $state('');
	let import_result = $state(null); // { ok, file, format, method, url, notices, warnings, error }
	let uF; // current uFetch instance, kept accessible so it can be aborted
	let timerInterval;
	//	let sizeKBResponse = $state(0);

	const methods = METHODS;
	const responses_as = RESPONSES_AS;

	let tabList = $state([
		{ label: 'Query Parameters', isActive: true, component: tab_query },
		{ label: 'HTTP Headers', component: tab_headers },
		{ label: 'Auth', component: tab_auth },
		{ label: 'Body', component: tab_body },
		// La pestaña sólo aparece si hay alguna acción que ofrecer.
		...(showExport || showImport ? [{ label: 'Import/Export', component: tab_io }] : []),
		{ label: 'Result', component: tab_result }
	]);

	// Se resuelve por etiqueta para no depender del índice si se reordenan pestañas.
	function tabIndex(label) {
		return tabList.findIndex((tab) => tab.label === label);
	}

	let last_data = '';
	let timeoutChangeData;

	$effect(() => {
		// Los cambios en `data` ya notifican vía `onchange` de los hijos.
		// Aquí solo se debouncean `url` y `method` (campos del nivel superior).
		url;
		method;
		clearTimeout(timeoutChangeData);
		timeoutChangeData = setTimeout(() => {
			internalOnChange();
		}, 750);
	});

	let icon_download_button = $derived.by(() => {
		let class_icon = ' fa-solid fa-file-arrow-down ';
		let ct = classifyContent(data_result.contentType);
		if (ct == 'pdf') {
			class_icon = ' fa-regular fa-file-pdf ';
		} else if (ct == 'image') {
			class_icon = ' fa-regular fa-image ';
		} else if (ct == 'text') {
			class_icon = ' fa-regular fa-file-lines ';
		}
		return class_icon;
	});

	let icon_headers_button = $derived.by(() =>
		show_headers ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'
	);

	let label_headers_button = $derived.by(() => (show_headers ? 'Headers' : 'Headers'));

	function classifyContent(contentType) {
		const type = contentType ? contentType.toLowerCase() : '';

		if (type.includes('application/json')) return 'json';
		if (type.includes('text/') && !type.includes('html')) return 'text';
		if (type.includes('image/')) return 'image';
		if (type.includes('application/pdf')) return 'pdf';
		if (type.includes('application/') || type.includes('octet-stream')) return 'bin';

		return '';
	}

	function internalOnChange() {
		//	last_data = {...data};
		const data_to_emit = {
			data: { ...data },
			url: $state.snapshot(url),
			method: $state.snapshot(method),
			last_response: data_result
		};

		let new_data = JSON.stringify(data_to_emit);

		if (new_data !== last_data) {
			last_data = new_data;
			//alert('dddd');
			//console.log(new_data);
			onchange(data_to_emit);
		}
	}

	function defaultValues() {
		if (data == null) {
			data = { query: [], headers: [], auth: { selection: 0 }, body: {} };
		}

		if (data && data.auth == null) {
			data.auth = { selection: 0 };
		}

		if (data && data.auth && data.auth.selection == null) {
			data.auth.selection = 0;
		}

		if (data && data.body == null) {
			data.body = { selection: 0, urlencoded: [] };
		}

		if (data && data.body && data.body.selection == null) {
			data.body.selection = 0;
		}

		if (data && data.body && data.body.urlencoded == null) {
			data.body.urlencoded = [];
		}

		if (data && data.query == null) {
			data.query = [];
		}

		if (data && data.headers == null) {
			data.headers = [];
		}

		if (!method) {
			method = 'GET';
		}

		if (!url) {
			url = '';
		}

		//console.log('>>>>>>> ', data);
	}

	function getSizeJSON(data) {
		// Convertimos el JSON a una cadena
		const jsonString = JSON.stringify(data);
		return getSizeString(jsonString);
	}

	function getSizeString(text) {
		// Calculamos el tamaño en bytes
		const sizeInBytes = new TextEncoder().encode(text).length;

		// Convertimos a kilobytes
		const sizeInKB = sizeInBytes / 1024;
		return sizeInKB;
	}

	// Función para descargar un archivo (blob o texto) automáticamente
	function downloadFile(content, filename = 'result', type = 'text/plain') {
		const blob = content instanceof Blob ? content : new Blob([content], { type: type });

		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename || 'result';

		// Añadir al DOM (necesario en Firefox), hacer clic y remover
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		// Liberar la URL en el siguiente ciclo para evitar errores en Firefox
		setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 5000);
	}

	function resetResponse() {
		last_response = {};
		data_result = { data: '', contentType: '', sizeKBResponse: -1, fileExtension: '' };
		time_responde = undefined;
		request_headers = [];
		response_headers = [];
	}

	/**
	 * Obtiene el tamaño de la respuesta en kilobytes (KB) desde el header Content-Length.
	 * @param {Response} response - El objeto Response de fetch.
	 * @returns {number|null} El tamaño en KB (redondeado a 2 decimales) o null si no se puede obtener.
	 */
	function getResponseSizeInKB(contentLength) {
		//const contentLength = response.headers.get('Content-Length');

		if (!contentLength) {
			return null;
		}

		const bytes = parseInt(contentLength, 10);

		if (isNaN(bytes)) {
			return null;
		}

		return bytes / 1024; // En KB
	}

	function getExtensionFromContentType(contentType, opciones = {}) {
		const { incluirPunto = false, valorPorDefecto = null, permitirMultiples = false } = opciones;

		// Validar entrada
		if (!contentType || typeof contentType !== 'string') {
			return valorPorDefecto;
		}

		// Limpiar contentType (remover charset y otros parámetros)
		const tipoLimpio = contentType.split(';')[0].trim().toLowerCase();

		const extensiones = EXTENSION_MAP[tipoLimpio];

		if (!extensiones) {
			return valorPorDefecto;
		}

		// Decidir qué devolver
		let resultado;
		if (permitirMultiples) {
			resultado = extensiones;
		} else {
			resultado = extensiones[0]; // Primera extensión (más común)
		}

		// Agregar punto si se solicita
		if (incluirPunto && resultado) {
			if (Array.isArray(resultado)) {
				resultado = resultado.map((ext) => '.' + ext);
			} else {
				resultado = '.' + resultado;
			}
		}

		return resultado;
	}

	/**
	 * Modelo normalizado de la solicitud actual. Es la única fuente de verdad que
	 * comparten el envío (uFetch) y los exportadores (.http / .sh / .ps1).
	 */
	function currentRequestModel() {
		return normalizeRequest({ url, method, data });
	}

	function exportRequest(format, secrets) {
		export_error = '';

		try {
			const model = currentRequestModel();

			if (!model.url || model.url.length <= 5) {
				export_error = 'Add a valid URL before exporting.';
				return;
			}

			if (secrets === 'literal' && model.auth.configured) {
				const accepted = confirm(
					'The exported file will contain the current credentials in plain text. Continue?'
				);
				if (!accepted) return;
			}

			if (model.notices.length > 0) {
				const accepted = confirm(`${model.notices.join('\n')}\n\nDo you want to continue?`);
				if (!accepted) return;
			}

			downloadRequestFile(model, format, { secrets });
		} catch (error) {
			export_error = error?.message || String(error);
		}
	}

	/**
	 * Importa un archivo de solicitud (.http, curl, PowerShell, fetch) y lo vuelca
	 * en el estado del componente. El texto lo lee el navegador y los parsers son
	 * puro JS (ver `importer.js`), así que no hay nada pegado en un textarea.
	 *
	 * @param {File} file
	 */
	async function importRequestFile(file) {
		if (!file) return;
		export_error = '';

		try {
			const result = parseRequestFile(await file.text(), { fileName: file.name });

			url = result.url;
			method = result.method;
			data = result.data;
			internalOnChange();

			import_result = {
				ok: true,
				file: file.name,
				format: result.format,
				method: result.method,
				url: result.url,
				notices: result.notices,
				warnings: result.warnings
			};
		} catch (error) {
			import_result = {
				ok: false,
				file: file.name,
				error: error?.message || String(error)
			};
		}
	}

	function currentDateFormated() {
		const ahora = new Date();

		const año = ahora.getFullYear();
		const mes = String(ahora.getMonth() + 1).padStart(2, '0'); // Meses empiezan en 0
		const dia = String(ahora.getDate()).padStart(2, '0');
		const horas = String(ahora.getHours()).padStart(2, '0');
		const minutos = String(ahora.getMinutes()).padStart(2, '0');
		const segundos = String(ahora.getSeconds()).padStart(2, '0');

		return `${año}${mes}${dia}${horas}${minutos}${segundos}`;
	}

	onMount(() => {
		defaultValues();
	});

	onDestroy(() => {
		clearTimeout(timeoutChangeData);
		clearInterval(timerInterval);
	});
</script>

{#snippet tab_query()}
	{#if data?.query != null}
		<svelte:boundary onerror={(e) => console.error(e)}>
			<Query
				bind:data={data.query}
				onchange={() => {
					internalOnChange();
				}}
			></Query>

			{#snippet failed(error)}
				<div>
					<span class="icon-text">
						<span class="icon has-text-warning">
							<i class="fa-solid fa-triangle-exclamation"></i>
						</span>
						<span>{error.message}</span>
					</span>
				</div>
			{/snippet}
		</svelte:boundary>
	{/if}
{/snippet}

{#snippet tab_headers()}
	{#if data?.headers != null}
		<svelte:boundary onerror={(e) => console.error(e)}>
			<Headers
				bind:data={data.headers}
				onchange={() => {
					internalOnChange();
				}}
			></Headers>
			{#snippet failed(error)}
				<div>
					<span class="icon-text">
						<span class="icon has-text-warning">
							<i class="fa-solid fa-triangle-exclamation"></i>
						</span>
						<span>{error.message}</span>
					</span>
				</div>
			{/snippet}
		</svelte:boundary>
	{/if}
{/snippet}

{#snippet tab_auth()}
	{#if data?.auth != null}
		<svelte:boundary onerror={(e) => console.error(e)}>
			<Auth
				bind:data={data.auth}
				onchange={() => {
					//	console.log(data);
					internalOnChange();
				}}
			></Auth>
			{#snippet failed(error)}
				<div>
					<span class="icon-text">
						<span class="icon has-text-warning">
							<i class="fa-solid fa-triangle-exclamation"></i>
						</span>
						<span>{error.message}</span>
					</span>
				</div>
			{/snippet}
		</svelte:boundary>
	{/if}
{/snippet}

{#snippet tab_body()}
	{#if data?.body != null}
		<svelte:boundary onerror={(e) => console.error(e)}>
			<Body
				bind:data={data.body}
				onchange={() => {
					//console.log('tab_body cambia', $state.snapshot(data.body));
					internalOnChange();
				}}
			></Body>

			{#snippet failed(error)}
				<div>
					<span class="icon-text">
						<span class="icon has-text-warning">
							<i class="fa-solid fa-triangle-exclamation"></i>
						</span>
						<span>{error.message}</span>
					</span>
				</div>
			{/snippet}
		</svelte:boundary>
	{/if}
{/snippet}

{#snippet tab_io()}
	<div class="columns is-variable is-4">
		{#if showExport}
			<div class="column is-half">
				<h6 class="title is-6">Export</h6>
				<p class="io_text">
					Download this request as an HTTP client file (<code>.http</code>), a curl/bash script (<code
						>.sh</code
					>) or a PowerShell script (<code>.ps1</code>). Choose whether the secrets stay as
					environment variables or are written in plain text.
				</p>

				<p class="io_group_title">With environment variables</p>
				<div class="buttons">
					{#each REST_EXPORT_FORMATS as format (format.id)}
						<button
							type="button"
							class="button is-small is-info is-light"
							data-testid="export-{format.id}-safe"
							onclick={() => exportRequest(format.id, 'variables')}
						>
							{format.label}
						</button>
					{/each}
				</div>

				<p class="io_group_title">With plain text credentials</p>
				<div class="buttons">
					{#each REST_EXPORT_FORMATS as format (format.id)}
						<button
							type="button"
							class="button is-small is-info is-light is-outlined"
							data-testid="export-{format.id}-literal"
							onclick={() => exportRequest(format.id, 'literal')}
						>
							{format.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if showImport}
			<div class="column is-half">
				<h6 class="title is-6">Import</h6>
				<p class="io_text">
					Load a saved request from a file: <code>.http</code> (REST Client, JetBrains, httpyac), a
					<code>curl</code>/bash command, a PowerShell script or a JavaScript
					<code>fetch</code>/<code>axios</code> call. The format is detected from the content and fills
					the URL, method, query, headers, auth and body tabs.
				</p>

				<div class="io_actions">
					<Input
						type="file"
						label="Import"
						accept={REST_IMPORT_ACCEPT}
						showUploadButton={false}
						data-testid="resttester-import"
						onselect={({ files }) => importRequestFile(files?.[0])}
						onchange={(event) => {
							// Vacía el input para poder volver a elegir el mismo archivo.
							if (event?.target) event.target.value = '';
						}}
					/>
				</div>
			</div>
		{/if}
	</div>

	{#if export_error}
		<div class="notification is-danger is-light export_error" data-testid="export-error">
			{export_error}
		</div>
	{/if}

	{#if import_result}
		<div
			class="notification is-light import_notice {import_result.ok
				? import_result.warnings.length || import_result.notices.length
					? 'is-warning'
					: 'is-success'
				: 'is-danger'}"
			data-testid="import-notice"
		>
			{#if import_result.ok}
				<span class="import_title" data-testid="import-notice-text">
					{import_result.method}
					{import_result.url} was imported from {import_result.file}.
				</span>
			{:else}
				<span class="import_title" data-testid="import-notice-text">
					{import_result.file} could not be imported: {import_result.error}
				</span>
			{/if}

			{#if import_result.ok && (import_result.warnings.length || import_result.notices.length)}
				<ul class="import_list" data-testid="import-notice-list">
					{#each import_result.warnings as warning, index (index)}
						<li>{warning}</li>
					{/each}
					{#each import_result.notices as notice, index (index)}
						<li>{notice}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet tab_result()}
	<div class="field is-grouped is-grouped-multiline">
		<div class="control">
			<div class="tags has-addons">
				<span
					class="tag {last_response
						? last_response.ok === true
							? 'is-success'
							: 'is-danger'
						: 'is-dark'}">Status</span
				>
				{#if last_response && last_response.status}
					<span class="tag">{last_response.status}</span>
				{:else}
					<span class="tag"></span>
				{/if}
			</div>
		</div>

		<div class="control">
			<div class="tags has-addons">
				<span class="tag {last_response && last_response.ok ? 'is-success' : 'is-dark'}"
					>Status Text</span
				>
				{#if last_response && last_response.statusText}
					<span class="tag">{last_response.statusText}</span>
				{:else}
					<span class="tag"> </span>
				{/if}
			</div>
		</div>

		<div class="control">
			<div class="tags has-addons">
				<span class="tag {last_response && last_response.ok ? 'is-success' : 'is-dark'}">Ok</span>
				{#if last_response && last_response.ok}
					<span class="tag">{last_response.ok}</span>
				{:else}
					<span class="tag"></span>
				{/if}
			</div>
		</div>

		<div class="control">
			<div class="tags has-addons">
				<span class="tag is-dark">MimeType</span>
				{#if data_result && data_result.contentType}
					<span class="tag">{data_result.contentType}</span>
				{:else}
					<span class="tag"></span>
				{/if}
			</div>
		</div>

		<div class="control">
			<div class="tags has-addons">
				<span class="tag is-dark">Time</span>
				{#if running}
					<span class="tag">{elapsed_ms} ms</span>
				{:else if time_responde}
					<span class="tag">{time_responde} ms</span>
				{:else}
					<span class="tag"> ms </span>
				{/if}
			</div>
		</div>

		<div class="control">
			<div class="tags has-addons">
				<span
					class="tag {data_result.sizeKBResponse > limitSizeResponseView
						? 'is-danger'
						: 'is-dark'}  ">Size</span
				>
				{#if data_result.sizeKBResponse}
					<span class="tag">{(+data_result.sizeKBResponse).toFixed(2)} KB</span>
				{:else}
					<span class="tag"> KB </span>
				{/if}
			</div>
		</div>

		<div class="control">
			<button
				class="button is-small"
				onclick={() => {
					show_headers = !show_headers;
				}}
			>
				<span class="icon">
					<i class={icon_headers_button}></i>
				</span>
				<span>{label_headers_button}</span>
			</button>
		</div>

		<div class="control">
			<button
				class="button is-small {data_result.sizeKBResponse > 0 ? 'is-success' : ''}"
				onclick={() => {
					const ctype = classifyContent(data_result.contentType);
					const fileName = data_result.fileName ?? `result_${currentDateFormated()}`;
					if (ctype === 'json' || ctype === 'text') {
						const content =
							typeof data_result.data === 'string'
								? data_result.data
								: JSON.stringify(data_result.data);
						downloadFile(content, fileName, data_result.contentType || 'text/plain');
					} else {
						downloadFile(data_result.data, fileName, data_result.contentType);
					}
				}}
			>
				<span class="icon">
					<i class={icon_download_button}></i>
				</span>
				<span>Download</span>
			</button>
		</div>
	</div>

	{#if show_headers}
		{#snippet title_request_headers()}
			<h6 class="title is-6">Request Headers</h6>
		{/snippet}

		{#snippet title_response_headers()}
			<h6 class="title is-6">Response Headers</h6>
		{/snippet}

		<div class="columns">
			<div class="column">
				<Table
					bind:RawDataTable={request_headers}
					showExportButton={false}
					showSelectionButton={false}
					showNewButton={false}
					showEditButton={false}
					showDeleteButton={false}
					showEditRow={false}
					left_items={[title_request_headers]}
				></Table>
			</div>
			<div class="column">
				<Table
					bind:RawDataTable={response_headers}
					showExportButton={false}
					showSelectionButton={false}
					showNewButton={false}
					showEditButton={false}
					showDeleteButton={false}
					showEditRow={false}
					left_items={[title_response_headers]}
				></Table>
			</div>
		</div>
	{/if}

	<div>
		{#if Number(data_result.sizeKBResponse) < Number(limitSizeResponseView)}
			{#if last_response && !last_response.ok && data_result.data}
				<JSONView bind:jsonObject={data_result.data}></JSONView>
			{:else if response_as == 'json' && data_result.fileExtension == 'json' && data_result.data}
				<JSONView bind:jsonObject={data_result.data}></JSONView>
			{:else if response_as == 'text' && data_result.fileExtension == 'txt' && data_result.data}
				<code>
					{data_result.data}
				</code>
			{:else if response_as == 'datatable' && data_result.data && Array.isArray(data_result.data)}
				<Table bind:RawDataTable={data_result.data}></Table>
			{/if}
		{/if}

		{#if data_result.error}
			<div class="notification is-danger">
				{data_result.error}
			</div>
		{/if}
	</div>
{/snippet}

<div class="block block_marg">
	<!-- Main container -->

	<div class="columns">
		<div class="column is-half">
			<div class="field has-addons">
				<p class="control">
					<!-- svelte-ignore a11y_missing_attribute -->
					<a class="button is-static is-small"> Url </a>
				</p>
				<p class="control is-expanded">
					<input
						class="input is-small is-expanded"
						type="text"
						placeholder="URL"
						bind:value={url}
					/>
				</p>
			</div>
		</div>

		<div class="column">
			<nav class="level actions_level">
				<!-- Right side -->
				<div class="level-right">
					<span class="level-item">
						<div class="field has-addons">
							<p class="control">
								<button class="button is-static is-small"> Method: </button>
							</p>

							<p class="control">
								<span class="select is-small">
									<select bind:value={method} disabled={methodDisabled}>
										{#each methods as m}
											<option value={m.method}>{m.label}</option>
										{/each}
									</select>
								</span>
							</p>
						</div>
					</span>
					<span class="level-item">
						<div class="field has-addons">
							<p class="control">
								<button class="button is-static is-small"> Show as: </button>
							</p>

							<p class="control">
								<span class="select is-small">
									<select bind:value={response_as}>
										{#each responses_as as ras}
											<option value={ras.as}>{ras.label}</option>
										{/each}
									</select>
								</span>
							</p>
						</div>
					</span>
					<span class="level-item">
						<button
							class="button is-small {running ? 'is-danger' : 'is-success'} is-outlined"
							data-testid="resttester-execute"
							onclick={async () => {
								if (running) {
									const confirmedAbort = confirm(
										'Are you sure you want to cancel the request in progress?'
									);
									if (confirmedAbort && uF) {
										uF.abort('Cancelled by user');
									}
									return;
								}

								active_tab = tabIndex('Result'); // Switch to Result tab

								{
									running = true;
									let startTime;

									// Instantiate uFetch here to prevent Auth header leakage between requests
									uF = new uFetch();

									// console.log('URL: ', url, data);

									// Fuente única de verdad: la misma que usan los exportadores.
									const req_model = currentRequestModel();

									if (req_model.url && req_model.url.length > 5) {
										try {
											resetResponse();
											// Capturamos el tiempo inicial
											startTime = Date.now();
											elapsed_ms = 0;
											clearInterval(timerInterval);
											timerInterval = setInterval(() => {
												elapsed_ms = Date.now() - startTime;
											}, 100);

											if (req_model.auth.configured && req_model.auth.type === 'basic') {
												uF.setBasicAuthorization(req_model.auth.username, req_model.auth.password);
											}

											if (req_model.auth.configured && req_model.auth.type === 'bearer') {
												uF.setBearerAuthorization(req_model.auth.token);
											}

											let req_method = req_model.method.toLowerCase();
											request_headers = getRequestHeaders(req_model, 'literal');
											last_response = await uF[req_method]({
												url: req_model.url,
												...(req_model.body.hasBody ? { body: req_model.body.runtime } : {}),
												headers: toHeadersObject(req_model)
											});

											response_headers = Array.from(last_response.headers.entries()).map(
												([key, value]) => ({ key, value })
											);

											// Capturamos el tiempo final
											let endTime = Date.now();

											// Calculamos la diferencia en milisegundos
											time_responde = endTime - startTime;
											clearInterval(timerInterval);
											data_result.contentType = last_response.headers.get('Content-Type') || '';
											//alert(last_response.ok);
											if (last_response.ok) {
												// Obtener headers importantes
												const contentDisposition =
													last_response.headers.get('Content-Disposition') || '';
												data_result.sizeKBResponse =
													getResponseSizeInKB(last_response.headers.get('Content-Length')) || 0;

												data_result.fileExtension = getExtensionFromContentType(
													data_result.contentType
												);

												// Extraer nombre de archivo si existe
												const fileNameMatch = contentDisposition.match(
													/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
												);
												data_result.fileName = fileNameMatch
													? `result_${currentDateFormated()}_${fileNameMatch[1].replace(/['"]/g, '')}.${data_result.fileExtension ?? 'bin'}`
													: `result_${currentDateFormated()}.${data_result.fileExtension ?? 'bin'}`;
											}

											// Clasificar tipo de contenido
											const ctype = classifyContent(data_result.contentType);

											if (ctype === 'json') {
												data_result.data = await last_response.json();
												if (last_response.ok && !data_result.sizeKBResponse) {
													data_result.sizeKBResponse = getSizeJSON(data_result.data);
												}
											} else if (ctype === 'text') {
												data_result.data = await last_response.text();
												if (last_response.ok && !data_result.sizeKBResponse) {
													data_result.sizeKBResponse = getSizeString(data_result.data);
												}
											} else if (ctype === 'image' || ctype === 'bin') {
												data_result.data = await last_response.blob();
												if (last_response.ok && !data_result.sizeKBResponse) {
													data_result.sizeKBResponse = getResponseSizeInKB(
														String(data_result.data.size)
													);
												}
											} else if (ctype === 'pdf') {
												data_result.data = await last_response.blob();
												if (last_response.ok && !data_result.sizeKBResponse) {
													data_result.sizeKBResponse = getResponseSizeInKB(
														String(data_result.data.size)
													);
												}
											} else {
												data_result.data = await last_response.blob();
												if (last_response.ok && !data_result.sizeKBResponse) {
													data_result.sizeKBResponse = getResponseSizeInKB(
														String(data_result.data.size)
													);
												}
											}
										} catch (error) {
											running = false;
											clearInterval(timerInterval);
											time_responde = Date.now() - startTime;
											console.trace(error);
											data_result.error =
												error?.name === 'AbortError'
													? 'Request cancelled by user.'
													: error.message || error;
											// alert(error); // Removed alert
										}
									} else {
										// alert('Url is empty'); // Removed alert
										data_result.error = 'URL is empty';
									}

									running = false;
								}
							}}
						>
							<span class="icon is-small">
								{#if running}
									<i class="fa-solid fa-cog fa-spin"></i>
								{:else}
									<i class="fa-solid fa-play"></i>
								{/if}
							</span>
							<span>{running ? 'Cancel' : 'Execute'}</span>
						</button>
					</span>
				</div>
			</nav>
		</div>
	</div>

	{#if data}
		<Tab
			bind:tabs={tabList}
			bind:active={active_tab}
			onselect={(s) => {
				//	console.log('----->>>>>>>>>>>>>>>>', s);
				defaultValues();
			}}
		></Tab>
	{:else}
		<div>
			<span class="icon-text">
				<span class="icon has-text-warning">
					<i class="fa-solid fa-triangle-exclamation"></i>
				</span>
				<span>There is no data to start.</span>
			</span>
		</div>
	{/if}
</div>

<style>
	.block_marg {
		margin: 0.25em;
	}

	.export_error {
		margin-top: 0.35rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}

	.import_notice {
		margin-top: 0.35rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}

	.import_title {
		font-weight: 600;
	}

	.import_list {
		margin-top: 0.35rem;
		margin-left: 1.1rem;
		list-style: disc;
	}

	/*
	 * Bulma fija `flex-shrink: 0` en `.level-left`/`.level-right`, así que los
	 * controles de la barra no se encogen ni se reparten en varias filas y en
	 * pantallas pequeñas el botón Execute se iba fuera del área visible.
	 * Aquí se deja que la columna encoja y que los controles bajen de línea.
	 */
	.actions_level > .level-right {
		flex: 1 1 auto;
		min-width: 0;
		flex-wrap: wrap;
		row-gap: 0.35rem;
	}

	/* Pestaña Import/Export ---------------------------------------------------- */

	.io_text {
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
		color: var(--bulma-text-weak, #4a4a4a);
	}

	.io_text code {
		padding: 0 0.2rem;
		background: var(--bulma-scheme-main-bis, #f5f5f5);
		border-radius: 3px;
		font-size: 0.85rem;
	}

	.io_group_title {
		margin-bottom: 0.35rem;
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--bulma-text-weak, #4a4a4a);
	}

	.io_actions {
		max-width: 32rem;
	}
</style>
