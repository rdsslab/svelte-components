<script>
	import { JSONView } from '$lib/index.js';

	const simpleData = {
		name: 'Alice',
		age: 28,
		email: 'alice@example.com',
		isActive: true
	};

	const nestedData = {
		company: 'Acme Corp',
		departments: [
			{
				name: 'Engineering',
				employees: 42,
				lead: { name: 'Bob', skills: ['Svelte', 'TypeScript', 'Rust'] }
			},
			{
				name: 'Design',
				employees: 12,
				lead: { name: 'Carol', skills: ['Figma', 'CSS', 'SVG'] }
			}
		],
		address: {
			street: '123 Main St',
			city: 'Springfield',
			geo: { lat: 39.7817, lng: -89.6501 }
		}
	};

	const apiResponse = {
		status: 200,
		message: 'OK',
		data: {
			users: [
				{ id: 1, name: 'Juan', role: 'admin', active: true },
				{ id: 2, name: 'María', role: 'editor', active: true },
				{ id: 3, name: 'Pedro', role: 'viewer', active: false }
			],
			pagination: { page: 1, perPage: 10, total: 3, totalPages: 1 }
		},
		timestamp: '2026-09-04T10:30:00Z'
	};

	const mixedData = {
		string: 'hello world',
		number: 42,
		float: 3.14159,
		boolean: true,
		nullValue: null,
		nested: { deep: { value: 'found it' } },
		array: [1, 'two', true, null, { key: 'value' }]
	};

	let liveData = $state({ counter: 0, message: 'Modifica este objeto' });

	function incrementCounter() {
		liveData = { ...liveData, counter: liveData.counter + 1 };
	}

	function addRandomField() {
		const key = `field_${Math.random().toString(36).substring(2, 6)}`;
		liveData = { ...liveData, [key]: Math.floor(Math.random() * 100) };
	}

	function resetData() {
		liveData = { counter: 0, message: 'Modifica este objeto' };
	}
</script>

<h2 class="title is-4">JSONView</h2>
<p class="subtitle is-6">Visor de JSON con syntax highlighting, números de línea y copiado al portapapeles</p>

<!-- ============================================================ -->
<!-- Ejemplo 1: Datos simples -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Datos simples</h3>
	<JSONView jsonObject={simpleData} label="Persona" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 2: Datos anidados -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Estructura anidada</h3>
	<JSONView jsonObject={nestedData} label="Empresa" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 3: Respuesta de API -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Respuesta de API</h3>
	<JSONView jsonObject={apiResponse} label="GET /api/users" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 4: Todos los tipos -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Todos los tipos de datos</h3>
	<JSONView jsonObject={mixedData} label="Tipos mixtos" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 5: Sin box wrapper -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Sin contenedor box</h3>
	<JSONView jsonObject={simpleData} showBox={false} />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 6: Sin números de línea -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Sin números de línea</h3>
	<JSONView jsonObject={nestedData} showLineNumbers={false} label="Compacto" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 7: Con maxHeight (scroll) -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Con altura máxima (scroll)</h3>
	<JSONView jsonObject={nestedData} maxHeight={200} label="Scrollable" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 8: Sin botón de copiar -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Sin botón de copiar</h3>
	<JSONView jsonObject={simpleData} showCopy={false} label="Solo lectura" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 9: Estado vacío -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Estado vacío</h3>
	<JSONView jsonObject={{}} emptyMessage="No hay datos disponibles" label="Objeto vacío" />
	<JSONView jsonObject={null} emptyMessage="Nulo" label="Valor null" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 10: Indentación personalizada -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Indentación personalizada (4 espacios)</h3>
	<JSONView jsonObject={nestedData} indent={4} label="Indent 4" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 11: Datos reactivos -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Reactividad</h3>
	<p class="mb-3 is-size-7 has-text-grey">Los cambios en el objeto se reflejan automáticamente</p>
	<div class="buttons mb-3">
		<button class="button is-small is-info" onclick={incrementCounter}>
			<span class="icon is-small"><i class="fa-solid fa-plus"></i></span>
			<span>Incrementar counter</span>
		</button>
		<button class="button is-small is-success" onclick={addRandomField}>
			<span class="icon is-small"><i class="fa-solid fa-shuffle"></i></span>
			<span>Agregar campo aleatorio</span>
		</button>
		<button class="button is-small is-warning" onclick={resetData}>
			<span class="icon is-small"><i class="fa-solid fa-rotate-left"></i></span>
			<span>Reset</span>
		</button>
	</div>
	<JSONView jsonObject={liveData} label="Datos reactivos" />
</div>

<!-- ============================================================ -->
<!-- Ejemplo 12: String JSON -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">String JSON</h3>
	<JSONView
		jsonObject={'{"status":"ok","items":[1,2,3]}'}
		label="Input como string"
	/>
</div>

<!-- ============================================================ -->
<!-- API Reference -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">API</h3>
	<pre><code>{`import { JSONView } from '$lib/index.js';

<JSONView
  jsonObject={myData}
  label="Mi JSON"
  indent={2}
  showCopy={true}
  showLineNumbers={true}
  showBox={true}
  maxHeight={0}
  emptyMessage="Sin datos"
/>

// Props:
// jsonObject  - any       - Datos JSON a mostrar
// label       - string    - Título opcional
// indent      - number    - Espacios de indentación (default: 2)
// showCopy    - boolean   - Botón copiar (default: true)
// showLineNumbers - boolean - Números de línea (default: true)
// showBox     - boolean   - Wrapper Bulma .box (default: true)
// maxHeight   - number    - Altura máxima en px, 0 = sin límite
// emptyMessage - string   - Mensaje cuando está vacío`}</code></pre>
</div>

<style>
	pre {
		background-color: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		font-size: 0.85rem;
	}
</style>
