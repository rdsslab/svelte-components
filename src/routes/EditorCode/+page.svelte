<script>
	import { EditorCode } from '$lib/index.js';

	// --- Editor 1: JSON con binding bidireccional ---
	let jsonCode = { name: 'EditorCode', version: '2.0', features: ['dark mode', 'multi-lang'] };
	let jsonLog = [];

	// --- Editor 2: Javascript solo lectura ---
	let jsCode = `function greet(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return message;
}

greet('World');`;

	// --- Editor 3: SQL editable ---
	let sqlCode = `SELECT u.id, u.name, COUNT(o.id) AS total_orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.active = true
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5
ORDER BY total_orders DESC;`;

	// --- Editor 4: HTML ---
	let htmlCode = `<div class="card">
  <h2>Title</h2>
  <p>Content goes here</p>
</div>`;

	// --- Editor 5: XML ---
	let xmlCode = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <item id="1">
    <name>First</name>
    <value>100</value>
  </item>
</root>`;

	// --- Editor 6: Number ---
	let numberCode = 42;

	// --- Editor refs para API ---
	let jsonEditorRef;
	let jsEditorRef;

	// --- Snippets para Level ---
	let selectedLang = 'json';

	function handleJsonChange(e) {
		jsonLog = [...jsonLog.slice(-4), `[${new Date().toLocaleTimeString()}] ${e.typeof}: ${JSON.stringify(e.code)}`];
	}

	function handleJsChange(e) {
		console.log('JS changed:', e);
	}

	function setSampleJson() {
		jsonEditorRef?.setCode({
			sample: true,
			timestamp: Date.now(),
			data: [1, 2, 3]
		});
	}

	function getJsonCode() {
		const result = jsonEditorRef?.getCode();
		alert('getCode() returned:\n' + JSON.stringify(result, null, 2));
	}

	function setSampleJs() {
		jsEditorRef?.setCode(`// Updated at ${new Date().toLocaleTimeString()}\nconst x = ${Math.floor(Math.random() * 100)};`);
	}
</script>

{#snippet headerRight()}
	<div class="field has-addons">
		<p class="control">
			<button class="button is-small is-outlined is-info" title="Info">
				<span class="icon is-small"><i class="fa-solid fa-circle-info"></i></span>
			</button>
		</p>
		<p class="control">
			<button class="button is-small is-outlined is-warning" title="Copy">
				<span class="icon is-small"><i class="fa-solid fa-copy"></i></span>
			</button>
		</p>
	</div>
{/snippet}

<h1 class="title is-4">EditorCode - Demo Completa</h1>

<!-- ============================== -->
<!-- 1. JSON: binding + API          -->
<!-- ============================== -->
<h2 class="title is-5 mt-5">1. JSON - Binding bidireccional + API</h2>
<p class="mb-3 is-size-7 has-text-grey">
	El objeto <code>jsonCode</code> se sincroniza en ambas direcciones. Usa los botones para probar <code>setCode()</code> y <code>getCode()</code>.
</p>

<div class="columns">
	<div class="column is-8">
		<EditorCode
			bind:code={jsonCode}
			lang="json"
			showFormat={true}
			showSelectLang={true}
			showResetButton={true}
			right={headerRight}
			onchange={handleJsonChange}
			bind:this={jsonEditorRef}
		/>
	</div>
	<div class="column is-4">
		<div class="buttons mb-3">
			<button class="button is-small is-link" onclick={setSampleJson}>setCode()</button>
			<button class="button is-small is-success" onclick={getJsonCode}>getCode()</button>
		</div>
		<div class="box p-3" style="max-height: 200px; overflow-y: auto; font-size: 0.75rem;">
			<p class="has-text-weight-bold mb-1">Change log:</p>
			{#each jsonLog as entry}
				<div class="has-text-grey-dark">{entry}</div>
			{:else}
				<div class="has-text-grey-light">No changes yet...</div>
			{/each}
		</div>
		<div class="content is-size-7">
			<p><strong>Parent value:</strong></p>
			<pre class="p-2" style="background: var(--bulma-scheme-main-bis); border-radius: 4px; white-space: pre-wrap;">{JSON.stringify(jsonCode, null, 2)}</pre>
		</div>
	</div>
</div>

<!-- ============================== -->
<!-- 2. Javascript: read-only       -->
<!-- ============================== -->
<h2 class="title is-5 mt-5">2. Javascript - Solo lectura</h2>
<p class="mb-3 is-size-7 has-text-grey">
	Modo <code>isReadOnly</code> deshabilita edición. El selector de lenguaje y el formato también se desactivan.
</p>

<EditorCode
	bind:code={jsCode}
	lang="js"
	showFormat={true}
	showSelectLang={true}
	isReadOnly={true}
	showResetButton={true}
	onchange={handleJsChange}
	bind:this={jsEditorRef}
/>

<div class="buttons mt-3">
	<button class="button is-small is-info" onclick={setSampleJs}>setCode() - random value</button>
</div>

<!-- ============================== -->
<!-- 3. SQL editable                -->
<!-- ============================== -->
<h2 class="title is-5 mt-5">3. SQL - Editable</h2>
<p class="mb-3 is-size-7 has-text-grey">
	Sintaxis SQL resaltada con formateo available.
</p>

<EditorCode
	bind:code={sqlCode}
	lang="sql"
	showFormat={true}
	showSelectLang={true}
	showResetButton={true}
	showHiddenButton={true}
/>

<!-- ============================== -->
<!-- 4. HTML                        -->
<!-- ============================== -->
<h2 class="title is-5 mt-5">4. HTML/XML</h2>
<p class="mb-3 is-size-7 has-text-grey">
	Ambos usan el parser de HTML de Prettier.
</p>

<div class="columns">
	<div class="column">
		<p class="has-text-weight-bold is-size-7 mb-1">HTML</p>
		<EditorCode bind:code={htmlCode} lang="html" showFormat={true} showResetButton={true} />
	</div>
	<div class="column">
		<p class="has-text-weight-bold is-size-7 mb-1">XML</p>
		<EditorCode bind:code={xmlCode} lang="xml" showFormat={true} showResetButton={true} />
	</div>
</div>

<!-- ============================== -->
<!-- 5. Number                      -->
<!-- ============================== -->
<h2 class="title is-5 mt-5">5. Number</h2>
<p class="mb-3 is-size-7 has-text-grey">
	El editor muestra un valor numérico. El botón "Parser" valida y normaliza el número.
	El binding sincroniza el valor como <code>number</code> cuando es válido.
</p>

<div class="columns">
	<div class="column is-6">
		<EditorCode
			bind:code={numberCode}
			lang="number"
			showFormat={true}
			showResetButton={true}
		/>
	</div>
	<div class="column is-6">
		<div class="content is-size-7">
			<p><strong>Parent value:</strong> <code>{numberCode}</code> ({typeof numberCode})</p>
		</div>
	</div>
</div>

<!-- ============================== -->
<!-- 6. Minimal: sin toolbar        -->
<!-- ============================== -->
<h2 class="title is-5 mt-5">6. Minimal - Sin controles</h2>
<p class="mb-3 is-size-7 has-text-grey">
	Sin toolbar, sin selector de idioma, sin formato. Solo el editor puro.
</p>

<EditorCode
	code={'// Minimal editor\nconst hello = "world";'}
	lang="js"
	showFormat={false}
	showSelectLang={false}
	showHiddenButton={false}
	showResetButton={false}
/>

<!-- ============================== -->
<!-- 7. Left + Right snippets       -->
<!-- ============================== -->
<h2 class="title is-5 mt-5">7. Custom Header - Left + Right snippets</h2>
<p class="mb-3 is-size-7 has-text-grey">
	Personaliza la barra superior con snippets a la izquierda y derecha.
</p>

{#snippet customLeft()}
	<span class="tag is-info is-light is-small">CONFIG</span>
{/snippet}

{#snippet customRight()}
	<div class="buttons are-small">
		<button class="button is-small is-rounded is-success" title="Save">
			<span class="icon is-small"><i class="fa-solid fa-floppy-disk"></i></span>
		</button>
		<button class="button is-small is-rounded is-danger" title="Delete">
			<span class="icon is-small"><i class="fa-solid fa-trash"></i></span>
		</button>
	</div>
{/snippet}

<EditorCode
	code={'{ "theme": "dark", "fontSize": 14, "tabSize": 2 }'}
	lang="json"
	showFormat={true}
	showSelectLang={true}
	left={customLeft}
	right={customRight}
/>
