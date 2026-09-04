<script>
	import { Table, Notify, Notifications, ColumnTypes } from '$lib/index.js';

	const notify = new Notifications();

	// --- Demo 1: Local data (paginación, búsqueda, export, selección) ---
	const firstNames = ['Ana', 'Carlos', 'María', 'Pedro', 'Lucía', 'Jorge', 'Elena', 'Roberto', 'Sofía', 'Diego', 'Valentina', 'Andrés', 'Camila', 'Luis', 'Isabella', 'Miguel', 'Gabriela', 'Fernando', 'Daniela', 'Martín'];
	const lastNames = ['García', 'López', 'Martínez', 'González', 'Hernández', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes', 'Ortiz', 'Gutiérrez', 'Castillo'];
	const cities = ['Lima', 'Bogotá', 'Quito', 'Santiago', 'Buenos Aires', 'Caracas', 'Medellín', 'Cali', 'Guayaquil', 'Montevideo'];

	function randomFromArray(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	function generateData(count) {
		const result = [];
		for (let i = 0; i < count; i++) {
			const first = randomFromArray(firstNames);
			const last = randomFromArray(lastNames);
			result.push({
				name: first + ' ' + last,
				age: Math.floor(Math.random() * 60) + 18,
				city: randomFromArray(cities),
				salary: Math.floor(Math.random() * 9000) + 1000,
				active: Math.random() > 0.3,
				date: new Date(Date.now() - Math.floor(Math.random() * 365 * 5) * 86400000),
				address: { street: 'Calle ' + (i + 1), code: Math.floor(Math.random() * 99999) }
			});
		}
		return result;
	}

	let localData = $state(generateData(80));

	let localColumns = {
		name: { label: 'Nombre', hidden: false },
		age: { label: 'Edad', hidden: false },
		city: { label: 'Ciudad', hidden: false },
		salary: { label: 'Salario', hidden: false },
		active: { label: 'Activo', hidden: false },
		date: {
			label: 'Fecha',
			hidden: false,
			decorator: { component: ColumnTypes.DateTime, props: { format: 'yyyy-MM-dd' } }
		},
		address: {
			label: 'Dirección',
			hidden: false,
			decorator: { component: ColumnTypes.Json }
		}
	};

	// --- Demo 2 & 3: Server data + Select All performance ---
	let bigData = $state(generateData(250));
	let serverData = $state([]);
	let serverRequestData = {
		url: 'https://jsonplaceholder.typicode.com/users',
		refresh_time: 8,
		method: 'GET'
	};

	function addRandomRow() {
		const first = randomFromArray(firstNames);
		const last = randomFromArray(lastNames);
		localData = [
			...localData,
			{
				name: first + ' ' + last,
				age: Math.floor(Math.random() * 60) + 18,
				city: randomFromArray(cities),
				salary: Math.floor(Math.random() * 9000) + 1000,
				active: Math.random() > 0.3,
				date: new Date(),
				address: { street: 'Calle Nueva', code: Math.floor(Math.random() * 99999) }
			}
		];
		notify.push({ message: `Fila "${first} ${last}" agregada. Total: ${localData.length}`, color: 'success', title: 'Fila agregada' });
	}

	function regenerateData() {
		localData = generateData(80);
		notify.push({ message: 'Datos regenerados (80 filas).', color: 'info', title: 'Datos regenerados' });
	}
</script>

<div class="section">
	<h1 class="title is-4">Table Component - Demo de mejoras</h1>

	<!-- ===================== DEMO 1: Local Data ===================== -->
	<div class="box">
		<h2 class="title is-5">1. Datos locales - Paginacion, busqueda, export, seleccion</h2>
		<p class="subtitle is-6">
			<strong>80 filas</strong> para probar paginacion con el nuevo rango dinamico.
			Usa el checkbox de seleccion multiple para probar <strong>"select all"</strong> (selecciona todas las paginas).
			La busqueda tiene <strong>debounce de 300ms</strong>.
		</p>
		<div class="buttons mb-4">
			<button class="button is-small is-link" onclick={addRandomRow}>
				<span class="icon"><i class="fas fa-plus"></i></span>
				<span>Agregar fila aleatoria</span>
			</button>
			<button class="button is-small is-info" onclick={regenerateData}>
				<span class="icon"><i class="fas fa-sync"></i></span>
				<span>Regenerar 80 filas</span>
			</button>
		</div>

		<Table
			bind:RawDataTable={localData}
			columns={localColumns}
			selectionType={2}
			showNewButton={true}
			showEditButton={true}
			showDeleteButton={true}
			showExportButton={true}
			showSelectionButton={true}
			fileNameExport="reporte_demo"
			pageSize={[10, 25, 50, 100]}
			pageSizeSelected={0}
			onnewrow={() => {
				addRandomRow();
			}}
			oneditrow={(e) => {
				notify.push({ message: `Editando: ${JSON.stringify(e.name || 'row')}`, color: 'info', title: 'Edit' });
			}}
			ondeleterow={(e) => {
				notify.push({ message: `${e.rows.length} fila(s) eliminada(s)`, color: 'warning', title: 'Delete' });
			}}
			onselectrows={(e) => {
				console.log('Selected rows:', e.rows.length);
			}}
		/>
	</div>

	<!-- ===================== DEMO 2: Server Data ===================== -->
	<div class="box">
		<h2 class="title is-5">2. Datos del servidor - Indicador de carga</h2>
		<p class="subtitle is-6">
			Se conecta a <code>jsonplaceholder.typicode.com/users</code>.
			Observa la barra de carga (<strong>"Loading data..."</strong>) sobre la tabla al recargar.
			El timer de refresco esta en <strong>8 segundos</strong>.
		</p>

		<Table
			bind:RawDataTable={serverData}
			requestData={serverRequestData}
			selectionType={1}
			showExportButton={true}
			showSelectionButton={true}
			pageSize={[5, 10, 25]}
			pageSizeSelected={0}
		/>
	</div>

	<!-- ===================== DEMO 3: Select All performance ===================== -->
	<div class="box">
		<h2 class="title is-5">3. Select All - Datos grandes (250 filas)</h2>
		<p class="subtitle is-6">
			Dataset de <strong>250 registros</strong>. El checkbox "select all" en el encabezado selecciona
			<strong>TODOS</strong> los registros de todas las paginas usando <code>Set</code> (O(1) por busqueda).
			Prueba seleccionar todo y luego exportar a Excel para ver los estilos zebra.
		</p>

		<Table
			bind:RawDataTable={bigData}
			selectionType={2}
			showExportButton={true}
			showDeleteButton={true}
			showSelectionButton={true}
			pageSize={[25, 50, 100]}
			pageSizeSelected={0}
			fileNameExport="reporte_grande"
		/>
	</div>

	<!-- Notificaciones flotantes -->
	<Notify />
</div>

<style>
	.section {
		padding: 1.5rem;
	}
	.box {
		margin-bottom: 2rem;
	}
</style>
