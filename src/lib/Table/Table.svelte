<script>
	import { onDestroy, onMount } from 'svelte';
	import uFetch from '@rdsslab/uFetch';
	import { Auto } from './Column/DefaultTypes.js';
	import { storeChangedTables } from '../class/websocket.js';
	import { Notifications } from '../class/utils.js';
	import TableToolbar from './TableToolbar.svelte';
	import TablePagination from './TablePagination.svelte';
	import { ExportTableToHTML, ExportTableToXlsx } from './utils/export_data.js';
	import { checkIsArray, ProcessDataTable } from './utils/utils.js';

	//TODO Habilitar mostrar u ocultar columnas
	//TODO Fijar encabezado
	//TODO Hacer celdas editables - Parcialmente implementado
	//TODO Hacer columnas con ancho ajustable

	/**
	 * Configurable properties for the advanced data Table component.
	 * Supports auto-refresh, pagination, searching, CRUD actions, and server-side fetching.
	 * 
	 * @typedef {Object} TableProps
	 * @property {Array<Object>} [RawDataTable] - The local array of data objects to be rendered. Updated automatically if server polling is active.
	 * @property {number} [selectionType=0] - Defines table selection mode: 0 (None), 1 (Single), 2 (Multiple).
	 * @property {Object} [columns={}] - Configuration object defining columns behavior (hidden, sorting, layout, labels).
	 * @property {boolean} [showNewButton=false] - Whether to render a 'New' row button in the top action bar.
	 * @property {boolean} [showEditButton=false] - Whether to render an 'Edit' button in the action bar.
	 * @property {boolean} [showEditRow=false] - Toggles whether inline row editing is active.
	 * @property {boolean} [showSelectionButton=true] - Visibility toggle for the row selection mode dropdown.
	 * @property {boolean} [showExportButton=true] - Visibility toggle for Export HTML/Excel buttons.
	 * @property {string} [iconExport='fa-solid fa-file-excel'] - FontAwesome class for the 'Export to Excel' icon.
	 * @property {string} [iconDeleteRow='fa-solid fa-trash'] - FontAwesome class for the 'Delete row' icon.
	 * @property {boolean} [showDeleteButton=false] - Visibility toggle for the row deletion button.
	 * @property {Array<number>} [pageSize=[25, 50, 100, 200, 300, 500, 1000]] - Allowable rows-per-page options.
	 * @property {number} [pageSizeSelected=0] - The currently selected index inside the `pageSize` array.
	 * @property {Array<string>} [relatedTablesForAutoRefresh=[]] - Names of DB tables tracked over WebSocket to trigger auto-refresh natively.
	 * @property {string} [fileNameExport=''] - The filename string for outputted Excel/HTML files.
	 * @property {Object} [requestData] - Defines how to fetch server-side data (url, refresh_time, params, method, headers, auth configurations).
	 * @property {function} [rowClassFunction] - Dynamic row styling function logic, yielding a CSS class.
	 * @property {Array<import('svelte').Snippet>} [left_items=[]] - Optional custom snippets injected on the left side of the top action Bar.
	 * @property {Array<import('svelte').Snippet>} [right_items=[]] - Optional custom snippets injected on the right side of the action bar.
	 * @property {function} [onclickrow] - Event triggered when standard single row is left clicked.
	 * @property {function} [oneditrow] - Event triggered specifically on row editing.
	 * @property {function} [onnewrow] - Event triggered when 'New' action button clicked.
	 * @property {function} [onsearch] - Triggered alongside text-based searching algorithm.
	 * @property {function} [ondeleterow] - Event triggered indicating selected rows should be removed.
	 * @property {function} [onselectrows] - Event dispatch array providing all active checked rows.
	 * @property {function} [onclickcell] - Cell-level mouse event bindings.
	 * @property {function} [onchangecell] - Fired when data in an inline cell input morphs.
	 */

	/** @type {TableProps & Record<string, any>} */
	let {
		RawDataTable = $bindable(),
		selectionType = $bindable(0),
		columns = $bindable({}),
		showNewButton = $bindable(false),
		showEditButton = $bindable(false),
		showEditRow = $bindable(false),
		showSelectionButton = $bindable(true),
		showExportButton = $bindable(true),
		iconExport = $bindable('fa-solid fa-file-excel'),
		iconDeleteRow = $bindable('fa-solid fa-trash'),
		showDeleteButton = $bindable(false),
		pageSize = $bindable([25, 50, 100, 200, 300, 500, 1000]),
		pageSizeSelected = $bindable(0),
		relatedTablesForAutoRefresh = $bindable([]),
		fileNameExport = $bindable(''),
		requestData = $bindable(),
		rowClassFunction = function (row) {
			return '';
		},
		left_items = $bindable([]),
		right_items = $bindable([]),
		onclickrow = (c) => {
			//			console.trace('onclickrow no implemented.');
		},
		oneditrow = (e) => {
			console.trace('oneditrow no implemented.');
		},
		onnewrow = (n) => {
			console.trace('onnewrow no implemented.');
		},
		onsearch = (n) => {
			console.trace('onsearch no implemented.');
		},
		ondeleterow = (d) => {
			ownDeleteRows(d);
		},
		onselectrows = (s) => {
			//			console.trace('onselectrows no implemented.');
		},
		onclickcell = (s) => {
			//			console.trace('onclickcell no implemented.');
		},
		onchangecell = (s) => {
			//			console.trace('onchangecell no implemented.');
		}
	} = $props();

	const FetchData = new uFetch();
	const notify = new Notifications();
	let DataTable = $state([]);
	let SelectedRows = $state(new Set());

	let text_search = $state(undefined);
	let loading = $state(false);
	let ColumnSort = $state();
	let ShowDialogColumn = $state(false);
	let timeRemainingToRefresh = $state(999);
	let LastFetchResponse = $state(true);
	// -- Refresh -- //
	let IntervalRefresh = [10, 20, 30, 45, 60, 120, 240, 480, 960, 1920, 3840];
	let PageSelected = $state(1);
	let totalFilteredRows = $state(0);
	let paginatedData = $state([]);
	let TotalPages = $derived.by(() => {
		return paginatedData.length;
	});
	let visiblePages = $derived.by(() => {
		const maxVisible = 4;
		const pages = [];
		const start = PageSelected + 1;
		const end = Math.min(start + maxVisible, TotalPages + 1);
		for (let i = start; i < end; i++) {
			pages.push(i);
		}
		return pages;
	});

	let orderASC = $state(true);
	let internal_columns = $state({});

	let idTimeoutDataChanged;
	let idTimeoutSearch;
	let unsubscribeStoreChangedTables;

	$effect(() => {
		RawDataTable;
		onrawDataChanged();
	});

	function requestDataExists() {
		return requestData && requestData.url && requestData.url.length > 0;
	}

	function onrawDataChanged() {
		if (RawDataTableIsArray()) {
			clearTimeout(idTimeoutDataChanged);

			idTimeoutDataChanged = setTimeout(async () => {
				try {
					let result_process = await ProcessDataTable({
						data: RawDataTable,
						columns: columns,
						hash_last_data: hash_last_data
					});

					hash_last_data = result_process.hash_last_data;

					if (result_process.different_data) {
						RawDataTable = result_process.data;
						SetColumns();
						FilterData();
					}
				} catch (error) {
					console.trace(error);
				}
			}, 200);
		}
	}

	function OnSelection() {
		onselectrows({ rows: GetSelectedRows() });
	}

	onMount(() => {
		timeRemainingToRefresh = 0;

		if (!requestData) {
			requestData = {
				url: undefined,
				refresh_time: 4,
				params: undefined,
				method: 'GET',
				headers: undefined,
				authorization: { basic: undefined, bearer: undefined }
			};
		}

		requestData.method = requestData.method || 'GET';
		requestData.refresh_time = Number(requestData.refresh_time)
			? Number(requestData.refresh_time)
			: 4;

		unsubscribeStoreChangedTables = storeChangedTables.subscribe((value) => {
			try {
				if (relatedTablesForAutoRefresh.includes(value.table)) {
					auto_refresh_by_table_changed_request++;
				}
			} catch (error) {
				console.error(error);
			}
		});

		auto_refresh = setInterval(async () => {
			if (requestDataExists()) {
				if (timeRemainingToRefresh == 0 || auto_refresh_by_table_changed_request > 0) {
					await GetDataTable();
					timeRemainingToRefresh = IntervalRefresh[requestData.refresh_time];
					auto_refresh_by_table_changed_request = 0;
				} else {
					timeRemainingToRefresh--;
				}
			}
		}, 1000);
	});

	function ArrayChunk(myArray, chunk_size) {
		let tempArray = [];
		chunk_size = parseInt(chunk_size);

		if (checkIsArray(myArray)) {
			for (let index = 0; index < myArray.length; index += chunk_size) {
				let myChunk = myArray.slice(index, index + chunk_size);
				tempArray.push(myChunk);
			}
		}

		return tempArray;
	}

	function SetColumns() {
		if (RawDataTableIsArray() && RawDataTable.length > 0) {
			let MaxSizeLabel = 15;
			internal_columns = {};

			Object.keys(RawDataTable[0]).forEach((item) => {
				if (item === 'internal_hash_row') {
					internal_columns[item] = {
						label: item.substring(0, MaxSizeLabel),
						hidden: true
					};
				} else if (columns[item]) {
					internal_columns[item] = columns[item];
					if (!internal_columns[item].label) {
						internal_columns[item].label = item.substring(0, MaxSizeLabel);
					}
				} else {
					internal_columns[item] = {
						label: item.substring(0, MaxSizeLabel),
						hidden: false
					};
				}
			});
		}
	}

	function RowIsSelected(internal_hash_row) {
		return SelectedRows.has(internal_hash_row);
	}

	export function GetSelectedRows() {
		if (!RawDataTableIsArray()) return [];
		return RawDataTable.filter((row) => SelectedRows.has(row.internal_hash_row));
	}

	function handleExport(type) {
		try {
			let filteredData = GetSelectedRows();
			if (filteredData && filteredData.length > 0) {
				if (type === 'xlsx') {
					ExportTableToXlsx(filteredData, columns, fileNameExport);
				} else {
					ExportTableToHTML(filteredData, columns, fileNameExport);
				}
				notify.push({ message: `Exported ${filteredData.length} rows to ${type.toUpperCase()}.`, color: 'success', title: 'Export' });
			} else {
				selectionType = 2;
				notify.push({ message: 'Select the rows to export.', color: 'warning', title: 'Export' });
			}
		} catch (error) {
			notify.push({ message: 'Export failed: ' + error.message, color: 'danger', title: 'Export Error' });
			console.error(error);
		}
	}

	let auto_refresh_by_table_changed_request = 0;

	let auto_refresh;
	let hash_last_data = '';

	onDestroy(() => {
		clearInterval(auto_refresh);
		clearTimeout(idTimeoutDataChanged);
		clearTimeout(idTimeoutSearch);
		if (unsubscribeStoreChangedTables) {
			unsubscribeStoreChangedTables();
		}
	});

	function ChangeIntervalRefresh() {
		if (requestDataExists()) {
			let i = requestData.refresh_time + 1;
			if (IntervalRefresh[i]) {
				requestData.refresh_time = i;
			} else {
				requestData.refresh_time = 0;
			}

			timeRemainingToRefresh = IntervalRefresh[requestData.refresh_time];
		} else {
			console.warn('ChangeIntervalRefresh: requestData not setted.');
		}
	}

	function SortColumn(key, order = 'asc') {
		return function innerSort(a, b) {
			const valA = a[key];
			const valB = b[key];

			const aNil = valA === null || valA === undefined;
			const bNil = valB === null || valB === undefined;
			if (aNil && bNil) return 0;
			if (aNil) return order === 'asc' ? 1 : -1;
			if (bNil) return order === 'asc' ? -1 : 1;

			if (typeof valA === 'boolean' && typeof valB === 'boolean') {
				return order === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
			}

			if (typeof valA === 'string' && typeof valB === 'string') {
				const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
				return order === 'asc' ? cmp : -cmp;
			}

			if (valA > valB) return order === 'asc' ? 1 : -1;
			if (valA < valB) return order === 'asc' ? -1 : 1;
			return 0;
		};
	}

	function ownDeleteRows(selected_rows) {
		if (selected_rows.rows && selected_rows.rows.length > 0) {
			RawDataTable = RawDataTable
				? RawDataTable.filter((item) => {
						let r = selected_rows.rows.find((r) => {
							return r.internal_hash_row == item.internal_hash_row;
						});
						return !r;
					})
				: [];
		}
	}

	function HClickDelete(e) {
		try {
			let filteredData = GetSelectedRows();
			if (filteredData && filteredData.length > 0) {
				ondeleterow({ rows: $state.snapshot(filteredData) });
			} else {
				selectionType = 2;
				notify.push({ message: 'Select the rows to delete.', color: 'warning', title: 'Delete' });
			}
		} catch (error) {
			notify.push({ message: 'Delete failed: ' + error.message, color: 'danger', title: 'Delete Error' });
			console.error(error);
		}
	}

	function HClickHeader(e) {
		ColumnSort = e.currentTarget.dataset.column;
		orderASC = !orderASC;
		FilterData();
	}

	function handleClickSearch() {
		if (onsearch) {
			onsearch();
		}

		FilterData();
		if (!text_search || text_search.length === 0) {
			timeRemainingToRefresh = 0;
		}
	}

	function handleSearchInput() {
		clearTimeout(idTimeoutSearch);
		idTimeoutSearch = setTimeout(() => {
			if (onsearch) {
				onsearch();
			}
			FilterData();
			if (!text_search || text_search.length === 0) {
				timeRemainingToRefresh = 0;
			}
		}, 300);
	}

	function handleChangeSelectAll(e) {
		if (e.target.checked) {
			if (RawDataTableIsArray()) {
				const newSet = new Set(SelectedRows);
				for (let i = 0, len = RawDataTable.length; i < len; i++) {
					newSet.add(RawDataTable[i].internal_hash_row);
				}
				SelectedRows = newSet;
			}
		} else {
			SelectedRows = new Set();
		}
		FilterData();
	}

	function RawDataTableIsArray() {
		return checkIsArray(RawDataTable);
	}

	function FilterData() {
		let TempData;
		if (text_search && text_search.length > 0 && RawDataTableIsArray()) {
			TempData = RawDataTable.filter((d) => {
				let s = Object.values(d).filter((item) => {
					if (item) {
						return item.toString().toUpperCase().includes(text_search.toUpperCase());
					} else {
						return item;
					}
				});
				if (s.length > 0) {
					return true;
				} else {
					return false;
				}
			});
		} else {
			TempData = RawDataTable;
		}

		if (TempData) {
			totalFilteredRows = TempData.length;
			Pagination(TempData);
		}
	}

	function eventOnChangeCell(item, dataRow) {
		let row =
			RawDataTable && Array.isArray(RawDataTable)
				? RawDataTable.findIndex((row) => {
						return row.internal_hash_row == dataRow.internal_hash_row;
					})
				: -1;

		if (onchangecell) {
			onchangecell(
				$state.snapshot({
					field: item,
					data: row
				})
			);
		}
	}

	function Pagination(rows) {
		if (ColumnSort) {
			if (orderASC) {
				rows = [...rows].sort(SortColumn(ColumnSort));
			} else {
				rows = [...rows].sort(SortColumn(ColumnSort, 'desc'));
			}
		}

		paginatedData = ArrayChunk(rows, pageSize[pageSizeSelected]);

		if (PageSelected > TotalPages) {
			PageSelected = 1;
		}
		SelectPage();
	}

	function SelectPage() {
		let tmpdata = paginatedData[PageSelected - 1] ?? [];

		if (tmpdata) {
			DataTable = tmpdata.filter((ev) => {
				return ev && ev.internal_hash_row;
			});
		}
	}

	function HandleOnClickEdit() {
		showEditRow = !showEditRow;
		return false;
	}

	function HandleOnRowSelected(event) {
		if (selectionType == 1) {
			SelectedRows = new Set();
		}

		let internal_hash_row = event.target.dataset.internal_hash_row;
		if (event.target.checked) {
			SelectedRows.add(internal_hash_row);
		} else {
			SelectedRows.delete(internal_hash_row);
		}
		SelectedRows = SelectedRows;
		OnSelection();
	}

	async function GetDataTable() {
		if (loading) {
			console.log('There is a petition in progress...');
		} else {
			if (requestDataExists()) {
				try {
					loading = true;

					if (requestData.authorization && requestData.authorization.bearer) {
						FetchData.setBearerAuthorization(requestData.authorization.bearer);
					} else if (requestData.authorization && requestData.authorization.basic) {
						FetchData.setBasicAuthorization(
							requestData.authorization.basic.username,
							requestData.authorization.basic.password
						);
					} else {
						FetchData.clearAuthorizationHeader();
					}

					let method_request =
						requestData && requestData.method ? requestData.method.toLowerCase() : 'get';

					let res = await FetchData[method_request]({
						url: requestData.url,
						data: requestData.params,
						headers: requestData.headers
					});

					if (res && res.status == 200) {
						let data = await res.json();

						if (checkIsArray(data)) {
							RawDataTable = data;
							LastFetchResponse = true;
						} else {
							RawDataTable = [];
							LastFetchResponse = false;
						}
					} else {
						LastFetchResponse = false;
					}
					loading = false;
				} catch (error) {
					notify.push({ message: 'Fetch error: ' + error.message, color: 'danger', title: 'Data Error' });
					loading = false;
					LastFetchResponse = false;
				}
			} else {
				console.warn('Not url asigned');
				LastFetchResponse = false;
			}
		}
	}

	// --- Toolbar event handlers ---
	function handleToolbarRefresh() {
		ChangeIntervalRefresh();
	}

	function handleToolbarSearch() {
		handleClickSearch();
	}

	function handleToolbarSearchInput() {
		handleSearchInput();
	}

	function handleToolbarExport(type) {
		handleExport(type);
	}

	function handleToolbarDelete() {
		HClickDelete();
	}

	function handleToolbarEdit() {
		HandleOnClickEdit();
	}

	function handleToolbarNew() {
		if (onnewrow) {
			onnewrow();
		}
	}

	function handleToolbarSelectionTypeChange(type) {
		selectionType = type;
	}

	// --- Pagination event handlers ---
	function handlePageChange(page) {
		PageSelected = page;
		SelectPage();
	}

	function handlePageSizeChange(index) {
		pageSizeSelected = index;
		FilterData();
	}
</script>

<TableToolbar
	{requestData}
	{loading}
	{LastFetchResponse}
	{timeRemainingToRefresh}
	{showExportButton}
	{showDeleteButton}
	{showEditButton}
	{showNewButton}
	{showSelectionButton}
	bind:selectionType
	{iconExport}
	{iconDeleteRow}
	bind:text_search
	{left_items}
	{right_items}
	onRefresh={handleToolbarRefresh}
	onSearch={handleToolbarSearch}
	onSearchInput={handleToolbarSearchInput}
	onExport={handleToolbarExport}
	onDelete={handleToolbarDelete}
	onEdit={handleToolbarEdit}
	onNew={handleToolbarNew}
	onSelectionTypeChange={handleToolbarSelectionTypeChange}
/>

<div class="table-container is-size-7">
	{#if loading}
		<div class="table_loading_bar">
			<span class="icon has-text-info"><i class="fas fa-spinner fa-pulse"></i></span>
			<span class="table_loading_text">Loading data...</span>
		</div>
	{/if}
	<table class="table is-bordered is-striped is-narrow is-hoverable is-fullwidth">
		{#if DataTable && DataTable.length > 0}
			<!-- Table Header -->
			<thead>
				<tr class="has-background-link-dark">
					<th class="has-text-centered has-text-white resizable">#</th>
					{#if selectionType == 1}
						<th class="has-text-centered has-text-white"><span>-</span></th>
					{:else if selectionType == 2}
						<th class="has-text-centered has-text-white">
							<input type="checkbox" onclick={handleChangeSelectAll} />
						</th>
					{/if}

					{#if showEditRow}
						<th class="has-text-centered has-text-white">
							<i class="fas fa-pen"></i>
						</th>
					{/if}

					{#if internal_columns}
						{#each Object.keys(internal_columns) as item, ith}
							{#if internal_columns[item]}
								{#if !internal_columns[item].hidden || internal_columns[item].hidden == null}
									<th
										class="has-text-centered show_cursor_mouse has-text-white"
										data-column={item}
										onclick={HClickHeader}
									>
										{internal_columns[item].label}
										{#if ColumnSort == item}
											{#if orderASC}
												<i class="fas fa-caret-down"></i>
											{:else}
												<i class="fas fa-caret-up"></i>
											{/if}
										{/if}
									</th>
								{/if}
							{/if}
						{/each}
					{/if}
				</tr>
			</thead>

			<!-- Table Body -->
			<tbody>
				{#each DataTable as dataRow, i (dataRow.internal_hash_row)}
					<tr
						class={rowClassFunction(dataRow)}
						onclick={() => {
							if (onclickrow) {
								onclickrow({ row: $state.snapshot(dataRow), id: $state.snapshot(i) });
							}
						}}
					>
						<td>{i + 1 + pageSize[pageSizeSelected] * (PageSelected - 1)}</td>

						{#if selectionType == 1}
							<td class="has-text-centered"
								><input
									type="radio"
									name="single_select"
									class="show_cursor_mouse"
									checked={RowIsSelected(dataRow.internal_hash_row)}
									data-internal_hash_row={dataRow.internal_hash_row}
									onclick={HandleOnRowSelected}
								/></td
							>
						{:else if selectionType == 2}
							<td class="has-text-centered">
								<input
									class="show_cursor_mouse"
									type="checkbox"
									checked={RowIsSelected(dataRow.internal_hash_row)}
									data-internal_hash_row={dataRow.internal_hash_row}
									onclick={HandleOnRowSelected}
								/>
							</td>
						{/if}

						{#if showEditRow}
							<td
								class="has-text-centered show_cursor_mouse"
								onclick={() => {
									if (oneditrow) {
										oneditrow($state.snapshot(DataTable[i]));
									}
								}}
							>
								<span class="icon is-small">
									<i class="fas fa-pen"></i>
								</span>
							</td>
						{/if}

						{#each Object.keys(internal_columns) as item}
							{#if internal_columns[item]}
								{#if !internal_columns[item].hidden || internal_columns[item].hidden == null}
									{#if internal_columns[item].decorator && internal_columns[item].decorator.component}
										{@const Component = internal_columns[item].decorator.component}
										<Component
											{...internal_columns[item]?.decorator?.props}
											bind:row={DataTable[i]}
											bind:value={dataRow[item]}
											onchangecell={(e) => {
												eventOnChangeCell(item, dataRow);
											}}
											onclickcell={(e) => {
												if (onclickcell) {
													onclickcell(
														$state.snapshot({
															field: item,
															data: dataRow
														})
													);
												}
											}}
										/>
									{:else}
										<Auto
											{...internal_columns[item]?.decorator?.props}
											bind:row={DataTable[i]}
											bind:value={dataRow[item]}
											onchangecell={(e) => {
												eventOnChangeCell(item, dataRow);
											}}
											onclickcell={(e) => {
												// TODO: No está funcionando
												if (onclickcell) {
													onclickcell(
														$state.snapshot({
															field: item,
															data: dataRow
														})
													);
												}
											}}
										></Auto>
									{/if}
								{/if}
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		{/if}
	</table>

	{#if !DataTable || DataTable.length < 1}
		<div class="has-text-centered">
			<i class="fa fa-table" aria-hidden="true"></i>
			There is no data to show
		</div>
	{/if}

	<TablePagination
		pageSelected={PageSelected}
		{totalPages}
		{totalFilteredRows}
		{pageSize}
		{pageSizeSelected}
		{visiblePages}
		onPageChange={handlePageChange}
		onPageSizeChange={handlePageSizeChange}
	/>
</div>

<div class="modal" class:is-active={ShowDialogColumn}>
	<div class="modal-card">
		<header class="modal-card-head has-background-dark">
			<p class="modal-card-title has-text-white">
				<b>
					<span>Columns</span>
				</b>
			</p>
			<button
				class="delete"
				aria-label="close"
				onclick={(e) => {
					ShowDialogColumn = false;
				}}
			></button>
		</header>
		<section class="modal-card-body">
			<div class="columns">
				{#each Object.keys(columns) as col}
					<div class="column">
						<label class="checkbox">
							<input type="checkbox" />
							{col}
						</label>
					</div>
				{/each}
			</div>
		</section>

		<footer class="modal-card-foot has-background-dark">
			<button class="button is-success is-small">
				<span>Accept</span>
			</button>
			<button
				class="button is-small"
				onclick={(e) => {
					ShowDialogColumn = false;
				}}
			>
				<span>Cancel</span>
			</button>
		</footer>
	</div>
</div>

<style>
	.show_cursor_mouse {
		cursor: pointer;
	}

	.margin_title {
		margin-left: 0.5em;
	}

	.table_loading_bar {
		display: flex;
		align-items: center;
		gap: 0.5em;
		padding: 0.4em 0.8em;
		background-color: #e8f0fe;
		border-bottom: 1px solid #c0c0c0;
		font-size: 0.85em;
		color: #1F4E79;
	}
	.table_loading_text {
		font-weight: 500;
	}
</style>
