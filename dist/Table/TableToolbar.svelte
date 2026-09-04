<script>
	import Level from '../Level/Level.svelte';

	/**
	 * TableToolbar - Barra de herramientas de la tabla.
	 * Agrupa botones de refresh, new, edit, delete, selección, export y búsqueda.
	 */

	let {
		requestData = undefined,
		loading = false,
		LastFetchResponse = true,
		timeRemainingToRefresh = 0,
		showExportButton = true,
		showDeleteButton = false,
		showEditButton = false,
		showNewButton = false,
		showSelectionButton = true,
		selectionType = $bindable(0),
		iconExport = 'fa-solid fa-file-excel',
		iconDeleteRow = 'fa-solid fa-trash',
		text_search = $bindable(undefined),
		left_items = [],
		right_items = [],
		onRefresh = () => {},
		onSearch = () => {},
		onSearchInput = () => {},
		onExport = (type) => {},
		onDelete = () => {},
		onEdit = () => {},
		onNew = () => {},
		onSelectionTypeChange = (type) => {}
	} = $props();
</script>

{#snippet t_refresh()}
	{#if requestData && requestData.url}
		<button class="button is-small" onclick={onRefresh} title="Refresh time">
			{#if loading}
				<span class="icon has-text-info"><i class="fas fa-spinner fa-pulse"></i></span>
			{:else if LastFetchResponse}
				<span class="icon"><i class="fas fa-hourglass-half"></i></span>
			{:else}
				<span class="icon has-text-danger"><i class="fas fa-exclamation-triangle"></i></span>
			{/if}
			<span>{timeRemainingToRefresh}s</span>
		</button>
	{/if}
{/snippet}

{#snippet t_search()}
	<div class="field has-addons">
		<p class="control">
			<input
				class="input size_search is-small"
				type="text"
				placeholder="Search"
				bind:value={text_search}
				oninput={onSearchInput}
			/>
		</p>
		<p class="control">
			<button aria-label="close" class="button is-small" title="Search" onclick={onSearch}>
				<span class="icon is-small">
					<i class="fas fa-search"></i>
				</span>
			</button>
		</p>
	</div>
{/snippet}

{#snippet t_export_excel()}
	{#if showExportButton}
		<button
			aria-label="close"
			class="button is-small"
			onclick={() => onExport('xlsx')}
			title="Export to Excel"
		>
			<span class="icon">
				<i class={iconExport}></i>
			</span>
		</button>
	{/if}
{/snippet}

{#snippet t_export_html()}
	{#if showExportButton}
		<button
			aria-label="close"
			class="button is-small"
			onclick={() => onExport('html')}
			title="Export to Html"
		>
			<span class="icon">
				<i class="fa-solid fa-download"></i>
			</span>
		</button>
	{/if}
{/snippet}

{#snippet t_selection_type()}
	{#if showSelectionButton}
		<div class="dropdown is-hoverable is-right" title="Selection type">
			<div class="dropdown-trigger">
				<button
					aria-label="close"
					class="button is-small"
					aria-haspopup="true"
					aria-controls="dropdown-menu"
				>
					<span class="icon">
						<i class="far fa-list-alt"></i>
					</span>
				</button>
			</div>
			<div class="dropdown-menu" role="menu">
				<div class="dropdown-content">
					<!-- svelte-ignore a11y_missing_attribute -->
					<a class="dropdown-item is-size-7">
						<input
							class="check_margin"
							type="radio"
							name="selection_type"
							value="1"
							checked={selectionType == 1}
							onchange={() => onSelectionTypeChange(1)}
						/>
						<span class="icon">
							<i class="fas fa-check"></i>
						</span>
						<span>Simple</span>
					</a>

					<!-- svelte-ignore a11y_missing_attribute -->
					<a class="dropdown-item is-size-7">
						<input
							class="check_margin"
							type="radio"
							name="selection_type"
							value="2"
							checked={selectionType == 2}
							onchange={() => onSelectionTypeChange(2)}
						/>
						<span class="icon">
							<i class="fas fa-check-double"></i>
						</span>
						<span>Multiple</span>
					</a>
					<hr class="dropdown-divider" />

					<!-- svelte-ignore a11y_missing_attribute -->
					<a class="dropdown-item is-size-7">
						<input
							class="check_margin"
							type="radio"
							name="selection_type"
							value="0"
							checked={selectionType == 0}
							onchange={() => onSelectionTypeChange(0)}
						/>

						<span class="icon">
							<i class="fas fa-ban"></i>
						</span>
						<span>None</span>
					</a>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet t_delete()}
	{#if showDeleteButton}
		<button aria-label="close" class="button is-small" title="Delete row" onclick={onDelete}>
			<span class="icon">
				<i class={iconDeleteRow}></i>
			</span>
		</button>
	{/if}
{/snippet}

{#snippet t_edit()}
	{#if showEditButton}
		<button aria-label="close" class="button is-small" title="Edit row" onclick={onEdit}>
			<span class="icon">
				<i class="far fa-edit"></i>
			</span>
		</button>
	{/if}
{/snippet}

{#snippet t_new()}
	{#if showNewButton}
		<button
			aria-label="close"
			class="button is-small"
			title="New row"
			onclick={() => onNew()}
		>
			<span class="icon">
				<i class="far fa-file"></i>
			</span>
		</button>
	{/if}
{/snippet}

<Level
	left={left_items}
	right={[
		...right_items,
		t_refresh,
		t_new,
		t_edit,
		t_delete,
		t_selection_type,
		t_export_excel,
		t_export_html,
		t_search
	]}
></Level>

<style>
	.size_search {
		width: 7em;
	}
	.check_margin {
		margin-left: 10px;
	}
	.slot_padding {
		margin: 0.1em !important;
	}
</style>
