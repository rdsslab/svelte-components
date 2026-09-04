<script>
	import { Tab } from '$lib/index.js';

	let activeBasic = $state(0);
	let activeSizes = $state(0);
	let activeDisabled = $state(1);
	let activeEvent = $state(0);
	let lastEvent = $state(null);

	function onTabSelect(e) {
		lastEvent = e;
		console.log('Tab selected:', e);
	}

	const apiCode = `import { Tab } from '$lib/index.js';

<Tab
  bind:active={activeIndex}
  classSize="is-small"
  onselect={(e) => console.log(e)}
  tabs={[
    { label: 'Tab 1', classIcon: 'fas fa-home', component: mySnippet },
    { label: 'Tab 2', classIcon: 'fas fa-gear', component: mySnippet2 },
    { label: 'Bloqueado', disabled: true }
  ]}
>
  <!-- children snippet (opcional) -->
</Tab>

// Evento onselect: { label: string, index: number, alias?: string }

// Navegación con teclado:
// - Flechas izquierda/derecha: navegar entre tabs
// - Home/End: primer/último tab habilitado`;
</script>

<h2 class="title is-4">Tab</h2>
<p class="subtitle is-6">Componente de navegación por pestañas con soporte ARIA y accesibilidad</p>

<!-- ============================================================ -->
<!-- Ejemplo 1: Básico con iconos de colores -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Básico con iconos</h3>

	{#snippet homeContent()}
		<div class="notification is-success is-light">
			<p><strong class="has-text-success"><i class="fa-solid fa-home"></i> Inicio</strong></p>
			<p>Contenido del tab de inicio.</p>
		</div>
	{/snippet}

	{#snippet searchContent()}
		<div class="notification is-info is-light">
			<p><strong class="has-text-info"><i class="fa-solid fa-magnifying-glass"></i> Buscar</strong></p>
			<p>Contenido del tab de búsqueda.</p>
		</div>
	{/snippet}

	{#snippet settingsContent()}
		<div class="notification is-warning is-light">
			<p><strong class="has-text-warning"><i class="fa-solid fa-gear"></i> Configuración</strong></p>
			<p>Contenido del tab de configuración.</p>
		</div>
	{/snippet}

	<Tab
		bind:active={activeBasic}
		tabs={[
			{ label: 'Inicio', classIcon: 'fas fa-home', component: homeContent },
			{ label: 'Buscar', classIcon: 'fas fa-magnifying-glass', component: searchContent },
			{ label: 'Config', classIcon: 'fas fa-gear', component: settingsContent }
		]}
	/>
</div>

<!-- ============================================================ -->
<!-- Ejemplo 2: Iconos con colores inline via classIcon -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Iconos con colores</h3>

	{#snippet dashboardContent()}
		<div class="notification is-link is-light">
			<p><strong class="has-text-link"><i class="fa-solid fa-chart-line"></i> Dashboard</strong></p>
			<p>Métricas y gráficas del sistema.</p>
		</div>
	{/snippet}

	{#snippet usersContent()}
		<div class="notification is-danger is-light">
			<p><strong class="has-text-danger"><i class="fa-solid fa-users"></i> Usuarios</strong></p>
			<p>Gestión de usuarios del sistema.</p>
		</div>
	{/snippet}

	{#snippet reportsContent()}
		<div class="notification is-primary is-light">
			<p><strong class="has-text-primary"><i class="fa-solid fa-file-lines"></i> Reportes</strong></p>
			<p>Generación y visualización de reportes.</p>
		</div>
	{/snippet}

	<Tab
		tabs={[
			{ label: 'Dashboard', classIcon: 'fa-solid fa-chart-line', component: dashboardContent },
			{ label: 'Usuarios', classIcon: 'fa-solid fa-users', component: usersContent },
			{ label: 'Reportes', classIcon: 'fa-solid fa-file-lines', component: reportsContent }
		]}
	/>
</div>

<!-- ============================================================ -->
<!-- Ejemplo 3: Tabs con sizes diferentes -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Tamaños</h3>

	{#snippet smallTab()}
		<div class="notification is-small is-grey-lighter">
			<p>Contenido en tamaño small.</p>
		</div>
	{/snippet}

	{#snippet mediumTab()}
		<div class="notification is-small is-grey-lighter">
			<p>Contenido en tamaño medium.</p>
		</div>
	{/snippet}

	<p class="mb-2"><strong>is-small:</strong></p>
	<Tab
		classSize="is-small"
		tabs={[
			{ label: 'Tab A', classIcon: 'fas fa-star', component: smallTab },
			{ label: 'Tab B', classIcon: 'fas fa-heart', component: mediumTab }
		]}
	/>

	<p class="mb-2"><strong>is-medium:</strong></p>
	<Tab
		classSize="is-medium"
		tabs={[
			{ label: 'Tab A', classIcon: 'fas fa-star', component: smallTab },
			{ label: 'Tab B', classIcon: 'fas fa-heart', component: mediumTab }
		]}
	/>

	<p class="mb-2"><strong>is-large:</strong></p>
	<Tab
		classSize="is-large"
		tabs={[
			{ label: 'Tab A', classIcon: 'fas fa-star', component: smallTab },
			{ label: 'Tab B', classIcon: 'fas fa-heart', component: mediumTab }
		]}
	/>
</div>

<!-- ============================================================ -->
<!-- Ejemplo 4: Tabs deshabilitados -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Tabs deshabilitados</h3>

	{#snippet enabledContent()}
		<div class="notification is-success is-light">
			<p>Este tab está habilitado.</p>
		</div>
	{/snippet}

	<Tab
		bind:active={activeDisabled}
		tabs={[
			{ label: 'Activo 1', classIcon: 'fas fa-check', component: enabledContent },
			{ label: 'Activo 2', classIcon: 'fas fa-check', component: enabledContent },
			{ label: 'Bloqueado', classIcon: 'fas fa-lock', disabled: true },
			{ label: 'Otro activo', classIcon: 'fas fa-check', component: enabledContent }
		]}
	/>
</div>

<!-- ============================================================ -->
<!-- Ejemplo 5: Evento onselect -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Evento onselect</h3>

	{#snippet alphaContent()}
		<div class="notification is-info is-light"><p>Contenido Alpha</p></div>
	{/snippet}

	{#snippet betaContent()}
		<div class="notification is-warning is-light"><p>Contenido Beta</p></div>
	{/snippet}

	{#snippet gammaContent()}
		<div class="notification is-danger is-light"><p>Contenido Gamma</p></div>
	{/snippet}

	<Tab
		bind:active={activeEvent}
		onselect={onTabSelect}
		tabs={[
			{ label: 'Alpha', classIcon: 'fas fa-alpha', alias: 'alpha', component: alphaContent },
			{ label: 'Beta', classIcon: 'fas fa-beta', alias: 'beta', component: betaContent },
			{ label: 'Gamma', classIcon: 'fas fa-gamma', alias: 'gamma', component: gammaContent }
		]}
	/>

	{#if lastEvent}
		<div class="notification is-light mt-3">
			<p><strong>Último evento:</strong></p>
			<pre><code>{JSON.stringify(lastEvent, null, 2)}</code></pre>
		</div>
	{/if}
</div>

<!-- ============================================================ -->
<!-- Ejemplo 6: Sin iconos (solo texto) -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Sin iconos (solo texto)</h3>

	{#snippet textContent()}
		<div class="notification is-grey-lighter">
			<p>Contenido del tab de texto.</p>
		</div>
	{/snippet}

	<Tab
		tabs={[
			{ label: 'Primero', component: textContent },
			{ label: 'Segundo', component: textContent },
			{ label: 'Tercero', component: textContent }
		]}
	/>
</div>

<!-- ============================================================ -->
<!-- Ejemplo 7: Con children snippet -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">Con contenido extra (children)</h3>

	{#snippet mainContent()}
		<div class="notification is-link is-light">
			<p>Contenido principal del tab activo.</p>
		</div>
	{/snippet}

	<Tab
		tabs={[
			{ label: 'Tab 1', classIcon: 'fas fa-database', component: mainContent },
			{ label: 'Tab 2', classIcon: 'fas fa-cloud', component: mainContent }
		]}
	>
		<div class="notification is-dark is-light mt-3">
			<p><i class="fa-solid fa-circle-info"></i> Este contenido se renderiza debajo de todos los tabs (children snippet).</p>
		</div>
	</Tab>
</div>

<!-- ============================================================ -->
<!-- API Reference -->
<!-- ============================================================ -->
<div class="box">
	<h3 class="title is-5">API</h3>
	<pre><code>{apiCode}</code></pre>
</div>

<style>
	pre {
		background-color: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
	}
</style>
