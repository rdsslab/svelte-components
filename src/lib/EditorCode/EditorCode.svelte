<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { Level } from '../index.js';
	import { EditorState, StateEffect } from '@codemirror/state';
	import { EditorView, basicSetup } from 'codemirror';
	import { javascript } from '@codemirror/lang-javascript';
	import { json } from '@codemirror/lang-json';
	import { xml } from '@codemirror/lang-xml';
	import { sql } from '@codemirror/lang-sql';
	import { oneDark } from '@codemirror/theme-one-dark';
	import * as Prettier from 'prettier/standalone.js';
	import prettierPluginBabel from 'prettier/plugins/babel.mjs';
	import Estree from 'prettier/plugins/estree.mjs';
	import prettierPluginHtml from 'prettier/plugins/html.mjs';
	import prettierPluginSql from 'prettier-plugin-sql';

	const dispatch = createEventDispatcher();

	export let code = '';
	export let left = null;
	export let right = null;
	export let lang = 'json';
	export let showFormat = false;
	export let showSelectLang = false;
	export let isReadOnly = false;
	export let showHiddenButton = true;
	export let showResetButton = false;
	export let showCode = true;

	/**
	 * `data-testid` para distinguir varios EditorCode en la misma pagina.
	 *
	 * No hay forma de distinguir uno suelto por su contenido: los valores son
	 * justamente lo que se esta probando, asi que un selector basado en el texto
	 * cambiaria en el momento en que la prueba necesita comprobar que cambio.
	 */
	export let containerTestId = null;

	export let onchange = null;

	let editorView = null;
	let containerEl;
	let initialized = false;
	let internalCode = '';
	let lastCode = '';
	let formatError = false;
	// El texto exacto que el editor esta mostrando porque se lo pusimos nosotros a
	// partir de un valor que no era texto. Sirve para no reenviarlo hacia arriba: si el
	// usuario no ha escrito nada, ese texto es una representacion nuestra, no su
	// intencion, y mandarselo de vuelta cambia el tipo del valor guardado.
	let renderedFromValue = null;

	let debounceTimer = null;
	const DEBOUNCE_MS = 350;

	/**
	 * Como se representa en el editor un valor que no es texto.
	 *
	 * Antes era `String(newCode)`, que convierte cualquier objeto en "[object Object]".
	 * Eso no era solo una pantalla fea: al escribir un caracter, `updateFromEditor`
	 * devolvia esa cadena al padre y el objeto se sustituia por "[object Object]x" en
	 * el siguiente guardado. Verificado en el navegador contra esta pagina de demo: con
	 * el codigo anterior, teclear un unico caracter sobre un valor objeto lo dejaba
	 * como string, y el boton de reset lo dejaba como "[object Object]".
	 *
	 * Ahora se serializa a JSON, que es fiel y editable. Sigue siendo texto, pero un
	 * texto que contiene el valor entero, de modo que una perdida de tipo ya no puede
	 * ser una perdida de contenido.
	 *
	 * Un lang cuyo valor es texto plano (`string`, `html`, `sql`, `xml`, `js`, `none`)
	 * no necesita rama propia: ahi convertir a texto es una identidad. `boolean` si la
	 * necesita, y por eso no cae en el `String()` del final. Su valor es un booleano, y
	 * convertirlo a la cadena "false" lo devolveria truthy en JavaScript: es el mismo
	 * defecto que arrastraba el flag de recuperacion de contrasena en el backend.
	 */
	function valueToText(newCode, langValue) {
		if (typeof newCode === 'string') return newCode;
		if (langValue === 'boolean') return newCode ? 'true' : 'false';
		if (newCode === null || newCode === undefined) return '';
		if (typeof newCode === 'object') {
			try {
				return JSON.stringify(newCode, null, 2);
			} catch (err) {
				// Un objeto con ciclo: JSON.stringify lanza. Se avisa y se deja el texto
				// vacio, pero nunca "[object Object]", que no se puede deshacer.
				console.warn('EditorCode: no se pudo serializar el valor', err);
				return '';
			}
		}
		return String(newCode);
	}

	/**
	 * El texto a escribir en el editor, y si es una representacion que nosotros
	 * fabricamos de un valor que no era texto (y que por tanto no debe volver al padre
	 * sin que el usuario haya escrito).
	 */
	function editorTextFor(newCode, langValue) {
		if (typeof newCode === 'string') {
			return { text: newCode, fromValue: false };
		}
		return { text: valueToText(newCode, langValue), fromValue: true };
	}

	// Dark mode: detect system preference
	let mediaQuery = null;
	let isDarkMode = false;

	function createExtensions() {
		const langExt = languages[lang] || [];

		const extensions = [
			basicSetup,
			Array.isArray(langExt) && langExt.length === 0 ? null : langExt,
			isReadOnly ? EditorState.readOnly.of(true) : null,
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					clearTimeout(debounceTimer);
					debounceTimer = setTimeout(() => {
						updateFromEditor(update.state.doc.toString());
					}, DEBOUNCE_MS);
				}
			}),
			isDarkMode ? oneDark : []
		];

		return extensions.filter(Boolean);
	}

	function onDarkModeChange(event) {
		isDarkMode = event.matches;
		reconfigureExtensions();
	}

	const languages = {
		js: javascript(),
		json: json(),
		html: xml(),
		sql: sql(),
		xml: xml(),
		string: [],
		number: [],
		// Sin resaltado propio: un boolean solo puede ser `true` o `false`.
		boolean: []
	};

	const listLangs = [
		{ label: 'None', value: 'none', prettier: '', plugins: [] },
		{ label: 'HTML', value: 'html', prettier: 'html', plugins: [prettierPluginHtml] },
		{ label: 'Javascript', value: 'js', prettier: 'babel', plugins: [prettierPluginBabel, Estree] },
		{
			label: 'JSON',
			value: 'json',
			prettier: 'json-stringify',
			plugins: [prettierPluginBabel, Estree]
		},
		{ label: 'SQL', value: 'sql', prettier: 'sql', plugins: [prettierPluginSql] },
		{ label: 'XML', value: 'xml', prettier: 'html', plugins: [prettierPluginHtml] },
		{ label: 'String', value: 'string', prettier: '', plugins: [] },
		{ label: 'Number', value: 'number', prettier: '', plugins: [] },
		// `boolean` faltaba aqui y lo sembraba el backend: la app `system` crea
		// $_VAR_RESET_EMAIL_ENABLED y $_VAR_RESET_TELEGRAM_ENABLED con ese tipo, asi que
		// se dibujaban con la seleccion en blanco y sin forma de editarlos. El conjunto
		// canonico de tipos vive en el backend (src/lib/db/appvarType.js del proyecto
		// OpenFusionAPI); esta lista debe seguirlo.
		{ label: 'Boolean', value: 'boolean', prettier: '', plugins: [] }
	];

	function getPrettierParserFor(langValue) {
		const found = listLangs.find((l) => l.value === langValue);
		return found ? found.prettier : '';
	}

	function getPrettierPluginsFor(langValue) {
		const found = listLangs.find((l) => l.value === langValue);
		return found ? found.plugins : [];
	}

	// -----------------------
	// SINCRONIZACIÓN
	// -----------------------
	function updateFromEditor(text) {
		internalCode = text;

		// Si el texto es exactamente el que nosotros fabricamos al representar un valor
		// que no era texto, el usuario no ha escrito: no se reenvia nada hacia arriba.
		// Sin esta guarda, abrir un campo con un valor objeto y teclear un caracter
		// Guardaba "[object Object]x" en vez del objeto. Verificado en el navegador.
		if (renderedFromValue !== null && text === renderedFromValue) {
			return;
		}
		renderedFromValue = null;

		if (lang === 'json') {
			try {
				const parsed = JSON.parse(text);
				code = parsed;
				formatError = false;
			} catch (err) {
				formatError = true;
			}
		} else if (lang === 'number') {
			try {
				const parsed = parseFloat(text);
				code = Number.isNaN(parsed) ? text : parsed;
				formatError = Number.isNaN(parsed);
			} catch (error) {
				console.error(error);
				formatError = true;
			}
		} else if (lang === 'boolean') {
			// Un boolean se entrega como boolean. Si se dejara caer en el `else` de
			// abajo, el padre recibiria la cadena "false", que en JavaScript es truthy:
			// el flag se leeria como encendido estando apagado.
			const normalized = text.trim().toLowerCase();
			if (['true', '1', 'yes', 'on'].includes(normalized)) {
				code = true;
				formatError = false;
			} else if (['false', '0', 'no', 'off'].includes(normalized)) {
				code = false;
				formatError = false;
			} else {
				code = text;
				formatError = true;
			}
		} else {
			code = text;
			formatError = false;
		}

		const payload = { lang, code, typeof: typeof code };
		if (payload.lang === 'number') {
			if (payload.typeof === 'number' && !Number.isNaN(payload.code)) {
				if (typeof onchange === 'function') onchange(payload);
				dispatch('change', payload);
			}
		} else {
			if (typeof onchange === 'function') onchange(payload);
			dispatch('change', payload);
		}
	}

	async function updateEditorFromProp(newCode, withFormat = false) {
		if (!editorView) return;

		// `valueToText` sustituye al `String(newCode)` de antes, que producia
		// "[object Object]" para cualquier objeto. El segundo campo dice si lo que va
		// a aparecer en pantalla es una representacion nuestra de un valor que no era
		// texto, para que `updateFromEditor` no lo reenvie al padre sin que el usuario
		// haya escrito nada.
		const { text: initialText, fromValue } = editorTextFor(newCode, lang);
		let text = initialText;

		if (withFormat) {
			try {
				const formatted = await formatWithPrettier(text);
				if (!formatted.error) text = formatted.code;
				formatError = !!formatted.error;
			} catch (err) {
				console.warn(err);
				formatError = true;
			}
		}

		const current = editorView.state.doc.toString();
		if (text !== current) {
			const tr = editorView.state.update({
				changes: { from: 0, to: current.length, insert: text }
			});
			// Se marca ANTES del dispatch, porque el dispatch dispara el updateListener y
			// con el la escritura diferida de `updateFromEditor`, que compara contra este
			// valor para no reenviar lo que nosotros acabamos de escribir.
			renderedFromValue = fromValue ? text : null;
			editorView.dispatch(tr);
		} else {
			// El texto ya era el correcto, no hay nada que escribir y nada que proteger.
			renderedFromValue = fromValue ? text : null;
		}
	}

	// -----------------------
	// CodeMirror: extensiones y reconfiguración
	// -----------------------
	function reconfigureExtensions() {
		if (!editorView) return;
		editorView.dispatch({ effects: StateEffect.reconfigure.of(createExtensions()) });
	}

	// -----------------------
	// Inicialización / limpieza
	// -----------------------
	async function initializeEditor() {
		if (!containerEl) return;

		if (editorView) {
			editorView.destroy();
			editorView = null;
		}

		// Mismo criterio que en `updateEditorFromProp`, y por el mismo motivo: el
		// `String(code)` de aqui ponia "[object Object]" en pantalla para cualquier
		// valor que no fuera texto.
		const { text, fromValue } = editorTextFor(code, lang);
		internalCode = text;
		lastCode = internalCode;
		renderedFromValue = fromValue ? text : null;

		editorView = new EditorView({
			doc: internalCode,
			extensions: createExtensions(),
			parent: containerEl
		});

		initialized = true;
	}

	onMount(() => {
		if (typeof window !== 'undefined' && window.matchMedia) {
			mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			isDarkMode = mediaQuery.matches;
			mediaQuery.addEventListener('change', onDarkModeChange);
		}
		initializeEditor();
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
			editorView = null;
		}
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', onDarkModeChange);
			mediaQuery = null;
		}
		clearTimeout(debounceTimer);
	});

	// Reactividad: si cambian propiedades claves, reconfigurar editor
	$: if (initialized && (lang || isReadOnly)) {
		reconfigureExtensions();
	}

	$: if (initialized && code !== undefined) {
		const editorText = editorView ? editorView.state.doc.toString() : '';
		// El tercer `String()` de este componente, y el que masaba: comparar el texto
		// del editor contra `String(code)` hacia que un objeto se escribiera en pantalla
		// como "[object Object]" en cuanto el valor llegaba del padre.
		const candidateText = valueToText(code, lang);
		if (candidateText !== editorText) {
			updateEditorFromProp(code);
		}
	}

	// -----------------------
	// Helpers: formateo con Prettier
	// -----------------------
	async function formatWithPrettier(text) {
		const parser = getPrettierParserFor(lang);
		const plugins = getPrettierPluginsFor(lang);
		const result = { error: null, code: text };

		if (parser) {
			try {
				const formatted = await Prettier.format(text, {
					parser,
					plugins,
					tabWidth: 2,
					useTabs: false
				});
				result.code = formatted;
			} catch (err) {
				result.error = err;
				console.warn('Prettier error:', err);
			}
		} else if (lang === 'number') {
			try {
				const parsed = parseFloat(text);
				if (!Number.isNaN(parsed)) {
					result.code = String(parsed);
				} else {
					result.code = text;
					result.error = 'NAN';
				}
			} catch (err) {
				result.error = err;
				console.warn('Parse error:', err);
			}
		}

		return result;
	}

	async function formatCode() {
		if (!editorView) return;
		const text = editorView.state.doc.toString();
		const formatted = await formatWithPrettier(text);
		if (!formatted.error) {
			const tr = editorView.state.update({
				changes: { from: 0, to: text.length, insert: formatted.code }
			});
			editorView.dispatch(tr);
			formatError = false;
			updateFromEditor(formatted.code);
		} else {
			formatError = true;
		}
	}

	// -----------------------
	// API pública (exported functions)
	// -----------------------
	export function setCode(newCode) {
		code = newCode;
	}

	export function getCode() {
		try {
			if (!editorView) return code;
			const text = editorView.state.doc.toString();
			if (lang === 'json') return JSON.parse(text);
			return text;
		} catch (err) {
			formatError = true;
			return editorView ? editorView.state.doc.toString() : code;
		}
	}

	export function reset() {
		if (!editorView) return;
		const text = lastCode;
		const tr = editorView.state.update({
			changes: { from: 0, to: editorView.state.doc.length, insert: text }
		});
		editorView.dispatch(tr);
		updateFromEditor(text);
	}
</script>

{#snippet r01()}
	<div class="field has-addons">
		{#if showSelectLang}
			<p class="control">
				<button disabled={isReadOnly} class="button is-static is-small"> Lang </button>
			</p>
			<p class="control">
				<span class="select is-small {formatError ? 'is-danger' : ' '}">
					<select disabled={isReadOnly} bind:value={lang}>
						{#each listLangs as ll}
							<option value={ll.value}>
								{ll.label}
							</option>
						{/each}
					</select>
				</span>
			</p>
		{/if}
		{#if showFormat && getPrettierParserFor(lang)}
			<p class="control">
				<button
					disabled={isReadOnly}
					class="button is-small {formatError ? 'is-danger' : ' '}"
					onclick={async () => {
						await formatCode();
					}}
				>
					<span class="icon is-small">
						{#if formatError}
							<i class="fa-solid fa-triangle-exclamation"></i>
						{:else}
							<i class="fa-solid fa-check"></i>
						{/if}
					</span>
					<span>Format {!showSelectLang ? lang.toUpperCase() : ''}</span>
				</button>
			</p>
		{:else if showFormat && lang === 'number'}
			<p class="control">
				<button
					disabled={isReadOnly}
					class="button is-small {formatError ? 'is-danger' : ''}"
					onclick={async () => {
						await formatCode();
					}}
				>
					<span class="icon is-small">
						{#if formatError}
							<i class="fa-solid fa-triangle-exclamation"></i>
						{:else}
							<i class="fa-solid fa-check"></i>
						{/if}
					</span>
					<span>Parser {!showSelectLang ? lang.toUpperCase() : ''}</span>
				</button>
			</p>
		{:else}
			<p class="control">
				<button disabled class="button is-small {formatError ? 'is-danger' : ' '}">
					<span class="icon is-small">
						<i class="fa-solid fa-ban"></i>
					</span>
					<span>Format {!showSelectLang ? lang.toUpperCase() : ''}</span>
				</button>
			</p>
		{/if}
	</div>

	<div class="field has-addons">
		{#if showResetButton}
			<p class="control">
				<button
					disabled={isReadOnly}
					class="button is-small"
					onclick={() => {
						reset();
					}}
				>
					<span class="icon is-small">
						<i class="fa-solid fa-rotate-left"></i>
					</span>
					<span>Reset</span>
				</button>
			</p>
		{/if}

		{#if showHiddenButton}
			<p class="control">
				<button
					title="Hide or show Code"
					class="button is-small"
					onclick={() => {
						showCode = !showCode;
					}}
				>
					<span class="icon is-small">
						{#if showCode}
							<i class="fa-solid fa-eye-slash"></i>
						{:else}
							<i class="fa-solid fa-eye"></i>
						{/if}
					</span>
				</button>
			</p>
		{/if}
	</div>
{/snippet}

<Level left={[left]} right={[right, r01]}></Level>

<div class={showCode ? '' : 'is-hidden'} data-testid={containerTestId}>
	<div bind:this={containerEl}></div>
</div>

<style>
</style>
