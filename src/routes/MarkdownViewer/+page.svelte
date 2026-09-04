<script>
	import { MarkdownViewer } from '$lib/index.js';

	let editMode = $state(false);
	let markdownContent = $state(`## Bienvenido a MarkdownViewer

Un componente **Svelte 5** para renderizar Markdown de forma reactiva.

### Características

- Soporte para **GitHub Flavored Markdown** (GFM)
- Tablas, listas de tareas, código con syntax highlighting
- Opciones configurables: \`allow_html\`, \`gfm\`, \`breaks\`
- Protección XSS integrada

### Ejemplo de tabla

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| markdown | string | \`''\` | Texto Markdown a renderizar |
| allow_html | boolean | \`true\` | Permitir HTML raw en el markdown |
| gfm | boolean | \`true\` | Habilitar GFM (tablas, task lists) |
| breaks | boolean | \`false\` | Convertir saltos de línea a \`<br>\` |
| showBox | boolean | \`false\` | Envolver en contenedor Bulma .box |

### Lista de tareas

- [x] Parseo de Markdown
- [x] Soporte GFM
- [x] Protección XSS
- [ ] Syntax highlighting (próximamente)

### Código

\`\`\`javascript
import { MarkdownViewer } from '@rdsslab/svelte-components';

let content = '## Hello World';
\`\`\`

### Blockquote

> "La simplicidad es la máxima sofisticación."
> — Leonardo da Vinci
`);

	let basicMarkdown = $state('## Titulo\n\nTexto con **negrita** y *cursiva*.');
	let tableMarkdown = $state(`| Lenguaje | Año | Tipo |
|----------|-----|------|
| JavaScript | 1995 | Interpretado |
| Python | 1991 | Interpretado |
| Rust | 2010 | Compilado |
| Go | 2009 | Compilado |`);

	let codeMarkdown = $state(`\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\``);

	let listMarkdown = $state(`### Features

- [x] Componentes reactivos
- [x] TypeScript support
- [x] Dark mode
- [ ] Mobile optimization

### Pasos

1. Instalar el paquete
2. Importar el componente
3. Pasar el markdown como prop
4. Personalizar con opciones`);

	let blockquoteMarkdown = $state(`> **Nota:** Este es un blockquote con formato inline.

> Primer nivel de cita
> > Segundo nivel de cita
> > > Tercer nivel`);

	let mixedMarkdown = $state(`# Documento Completo

## Introducción

MarkdownViewer es un componente que convierte **Markdown** a HTML de forma reactiva.

### Características principales

| Feature | Estado | Prioridad |
|---------|--------|-----------|
| GFM | Activo | Alta |
| XSS Protection | Activo | Alta |
| Custom options | Activo | Media |
| Async rendering | Futuro | Baja |

### Ejemplo de código

\`\`\`bash
npm install @rdsslab/svelte-components
\`\`\`

### Lista de tareas

- [x] Crear componente
- [x] Agregar tests
- [x] Documentar API
- [ ] Publicar docs

### Blockquote de referencia

> El Markdown correcto es aquel que se lee como texto plano.

**Fin del documento.**`);

	let xssMarkdown = 'Texto con <strong>HTML fuerte</strong> y <script>alert("XSS")<\/script> inevitable.\n\n[Click malicioso](javascript:alert(1))';
	let xssLinkMarkdown = 'Link normal: [Google](https://www.google.com)\n\nLink malicioso: [Click aqui](javascript:alert("XSS"))';
	let breaksDisabled = 'Primera linea\nSegunda linea\nTercera linea';
	let breaksEnabled = 'Primera linea\nSegunda linea\nTercera linea';
</script>

<h2 class="title is-4">MarkdownViewer</h2>
<p class="subtitle is-6">Componente para renderizar Markdown de forma reactiva con soporte GFM y protección XSS.</p>

<!-- Example 1: Modo Edición -->
<div class="box">
	<h3 class="title is-5">Modo Edición</h3>
	<p class="mb-4">Editor y preview en tiempo real con bind bidireccional.</p>

	<div class="buttons mb-4">
		<button class="button is-small" class:is-primary={!editMode} onclick={() => editMode = false}>
			<span class="icon is-small"><i class="fas fa-eye"></i></span>
			<span>Preview</span>
		</button>
		<button class="button is-small" class:is-primary={editMode} onclick={() => editMode = true}>
			<span class="icon is-small"><i class="fas fa-edit"></i></span>
			<span>Editor</span>
		</button>
	</div>

	{#if editMode}
		<textarea
			class="textarea is-small is-family-monospace"
			rows="12"
			bind:value={markdownContent}
			placeholder="Escribe Markdown aquí..."
		></textarea>
	{:else}
		<MarkdownViewer bind:markdown={markdownContent} />
	{/if}
</div>

<!-- Example 2: Basico -->
<div class="box">
	<h3 class="title is-5">Markdown Básico</h3>
	<p class="mb-4">Texto simple con formato inline: negrita, cursiva, código.</p>
	<MarkdownViewer markdown={basicMarkdown} />
	<details class="mt-3">
		<summary class="has-text-link is-clickable" style="cursor: pointer;">Ver código fuente</summary>
		<pre class="mt-2" style="background: var(--app-bg); padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;"><code>{basicMarkdown}</code></pre>
	</details>
</div>

<!-- Example 3: Tablas GFM -->
<div class="box">
	<h3 class="title is-5">Tablas (GFM)</h3>
	<p class="mb-4">Tablas con formato de columnas y alineación.</p>
	<MarkdownViewer markdown={tableMarkdown} />
</div>

<!-- Example 4: Bloques de código -->
<div class="box">
	<h3 class="title is-5">Bloques de Código</h3>
	<p class="mb-4">Bloques de código con diferentes lenguajes.</p>
	<MarkdownViewer markdown={codeMarkdown} />
</div>

<!-- Example 5: Listas y Task Lists -->
<div class="box">
	<h3 class="title is-5">Listas y Task Lists</h3>
	<p class="mb-4">Listas ordenadas, no ordenadas y listas de tareas (checkboxes).</p>
	<MarkdownViewer markdown={listMarkdown} />
</div>

<!-- Example 6: Blockquotes -->
<div class="box">
	<h3 class="title is-5">Blockquotes</h3>
	<p class="mb-4">Citas con formato inline y anidamiento.</p>
	<MarkdownViewer markdown={blockquoteMarkdown} />
</div>

<!-- Example 7: Contenedor Box -->
<div class="box">
	<h3 class="title is-5">Con showBox</h3>
	<p class="mb-4">El componente se envuelve automáticamente en un contenedor Bulma.</p>
	<MarkdownViewer markdown={basicMarkdown} showBox={true} />
</div>

<!-- Example 8: Protección XSS -->
<div class="box">
	<h3 class="title is-5">Protección XSS</h3>
	<p class="mb-4">
		Por defecto (<code>allow_html=false</code>) el HTML raw se escapa y los links con protocolos peligrosos
		(<code>javascript:</code>, <code>data:</code>, etc.) se eliminan.
	</p>

	<div class="columns">
		<div class="column">
			<p class="has-text-weight-semibold mb-2">Default (allow_html=false, seguro):</p>
			<MarkdownViewer markdown={xssMarkdown} />
		</div>
		<div class="column">
			<p class="has-text-weight-semibold mb-2">allow_html=true (responsabilidad del usuario):</p>
			<MarkdownViewer markdown={xssMarkdown} allow_html={true} />
		</div>
	</div>

	<hr class="my-4">

	<p class="has-text-weight-semibold mb-2">Links: los protocolos peligrosos se eliminan siempre, incluso con allow_html=true:</p>
	<MarkdownViewer markdown={xssLinkMarkdown} allow_html={true} />
</div>

<!-- Example 9: Opciones GFM y Breaks -->
<div class="box">
	<h3 class="title is-5">Opciones: gfm y breaks</h3>
	<p class="mb-4">Comparación con diferentes configuraciones de parseo.</p>

	<div class="columns">
		<div class="column">
			<p class="has-text-weight-semibold mb-2">breaks=false (default):</p>
			<MarkdownViewer markdown={breaksDisabled} breaks={false} />
		</div>
		<div class="column">
			<p class="has-text-weight-semibold mb-2">breaks=true:</p>
			<MarkdownViewer markdown={breaksEnabled} breaks={true} />
		</div>
	</div>
</div>

<!-- Example 10: Content class personalizado -->
<div class="box">
	<h3 class="title is-5">content_class personalizado</h3>
	<p class="mb-4">Agregar clases CSS al contenedor del contenido renderizado.</p>
	<MarkdownViewer markdown="**Texto con estilo custom**\n\nPárrafo de ejemplo." content_class="has-text-success" />
</div>

<!-- Example 11: Empty state -->
<div class="box">
	<h3 class="title is-5">Estado vacío</h3>
	<p class="mb-4">Mensaje personalizado cuando no hay contenido.</p>
	<div class="columns">
		<div class="column">
			<p class="has-text-weight-semibold mb-2">Sin empty_message (no renderiza nada):</p>
			<div class="p-3" style="border: 1px dashed var(--border-color); min-height: 40px;">
				<MarkdownViewer markdown="" />
			</div>
		</div>
		<div class="column">
			<p class="has-text-weight-semibold mb-2">Con empty_message:</p>
			<div class="p-3" style="border: 1px dashed var(--border-color); min-height: 40px;">
				<MarkdownViewer markdown="" empty_message="No hay contenido para mostrar." />
			</div>
		</div>
	</div>
</div>

<!-- Example 12: Reactividad -->
<div class="box">
	<h3 class="title is-5">Reactividad</h3>
	<p class="mb-4">El contenido se actualiza automáticamente al modificar el state.</p>

	<div class="buttons mb-4">
		<button
			class="button is-small is-info"
			onclick={() => markdownContent = `## Sección ${Math.floor(Math.random() * 100)}\n\nContenido generado dinámicamente.\n\n- Item 1\n- Item 2\n- Item 3`}
		>
			Generar nuevo contenido
		</button>
		<button
			class="button is-small is-warning"
			onclick={() => markdownContent = ''}
		>
			Limpiar
		</button>
		<button
			class="button is-small is-success"
			onclick={() => markdownContent = mixedMarkdown}
		>
			Cargar documento completo
		</button>
	</div>

	<div class="content" style="min-height: 80px;">
		{#if markdownContent}
			<MarkdownViewer bind:markdown={markdownContent} />
		{:else}
			<p class="has-text-grey has-text-centered py-4">Haz clic en un botón para generar contenido.</p>
		{/if}
	</div>
</div>

<!-- Example 13: Documento completo -->
<div class="box">
	<h3 class="title is-5">Documento Completo</h3>
	<p class="mb-4">Ejemplo de un documento largo con todas las features de GFM combinadas.</p>
	<MarkdownViewer markdown={mixedMarkdown} />
</div>

<!-- API Reference -->
<div class="box">
	<h3 class="title is-5">Referencia API</h3>

	<pre class="mb-4" style="background: var(--app-bg); padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;"><code>{`import { MarkdownViewer } from '@rdsslab/svelte-components';

// Uso básico
<MarkdownViewer markdown="## Hello World" />

// Con opciones
<MarkdownViewer
  markdown={content}
  allow_html={true}    // opt-in para HTML raw (responsabilidad del usuario)
  gfm={true}
  breaks={true}
  showBox={true}
  empty_message="Sin contenido"
  content_class="custom-class"
/>

// Bind bidireccional
<MarkdownViewer bind:markdown={myState} />`}</code></pre>

	<table class="table is-fullwidth is-striped is-hoverable">
		<thead>
			<tr>
				<th>Prop</th>
				<th>Tipo</th>
				<th>Default</th>
				<th>Descripción</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>markdown</code></td>
				<td>string</td>
				<td><code>''</code></td>
				<td>Texto Markdown a renderizar (bindable)</td>
			</tr>
			<tr>
				<td><code>content_class</code></td>
				<td>string</td>
				<td><code>''</code></td>
				<td>Clases CSS adicionales para el contenedor (bindable)</td>
			</tr>
			<tr>
				<td><code>allow_html</code></td>
				<td>boolean</td>
				<td><code>false</code></td>
				<td>Permitir HTML raw en el markdown. <code>false</code> lo escapa a texto plano (seguro contra XSS)</td>
			</tr>
			<tr>
				<td><code>gfm</code></td>
				<td>boolean</td>
				<td><code>true</code></td>
				<td>Habilitar GitHub Flavored Markdown (tablas, task lists, etc.)</td>
			</tr>
			<tr>
				<td><code>breaks</code></td>
				<td>boolean</td>
				<td><code>false</code></td>
				<td>Convertir saltos de línea a <code>&lt;br&gt;</code></td>
			</tr>
			<tr>
				<td><code>showBox</code></td>
				<td>boolean</td>
				<td><code>false</code></td>
				<td>Envolver contenido en contenedor Bulma <code>.box</code></td>
			</tr>
			<tr>
				<td><code>empty_message</code></td>
				<td>string</td>
				<td><code>''</code></td>
				<td>Mensaje mostrado cuando el markdown está vacío</td>
			</tr>
			<tr>
				<td><code>options</code></td>
				<td>MarkedOptions</td>
				<td><code>{'{'}{'}'}</code></td>
				<td>Opciones adicionales para <code>marked.parse()</code>. El renderer seguro siempre tiene prioridad (protección XSS)</td>
			</tr>
		</tbody>
	</table>
</div>
