<script>
	import { onDestroy, onMount, untrack } from 'svelte';
	import uFetch from '@rdsslab/uFetch';
	import { Auto } from './Column/DefaultTypes.js';
	import { storeChangedTables } from '../class/websocket.js';
	import { Notifications } from '../class/utils.js';
	import TableToolbar from './TableToolbar.svelte';
	import TablePagination from './TablePagination.svelte';
	import DialogModal from '../Dialog/Modal.svelte';
	import { ExportTableToHTML, ExportTableToXlsx } from './utils/export_data.js';
	import { checkIsArray, ProcessDataTable } from './utils/utils.js';
	import {
		loadColumnPreferences,
		saveColumnPreferences,
		clearColumnPreferences,
		columnPreferencesKey,
		autoColumnPreferencesKey,
		registerActiveColumnPreferencesKey,
		unregisterActiveColumnPreferencesKey
	} from './utils/columnPrefs.js';

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
	 * @property {boolean} [showColumnsButton=true] - Visibility toggle for the 'Columns' dialog button (lets the user hide/show columns).
	 * @property {boolean} [persistColumns=true] - When true (default), the hidden-columns choice is persisted in localStorage. Set to false to keep it in memory only.
	 * @property {string} [storageKey=''] - Stable, unique identifier used to persist the user's hidden-columns choice in localStorage. When empty, a stable automatic key derived from the route and the column set is used (requires persistColumns=true). Define it explicitly when two tables share the same column names.
	 * @property {function} [oncolumnschange] - Called with the map of columns hidden by the user every time the choice changes.
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
		showColumnsButton = $bindable(true),
		persistColumns = $bindable(true),
		storageKey = $bindable(''),
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
		},
		oncolumnschange = (hidden) => {
			//			console.trace('oncolumnschange no implemented.');
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
	let totalPages = $derived.by(() => {
		return paginatedData.length;
	});
	let visiblePages = $derived.by(() => {
		const maxVisible = 4;
		const pages = [];
		const start = PageSelected + 1;
		const end = Math.min(start + maxVisible, totalPages + 1);
		for (let i = start; i < end; i++) {
			pages.push(i);
		}
		return pages;
	});

	let orderASC = $state(true);
	let internal_columns = $state({});
	// `hidden` tal como lo definió el desarrollador en la prop `columns`. Una
	// columna oculta por configuración NO es configurable por el usuario (p.ej.
	// `internal_hash_row`): el override del usuario solo puede ocultar más.
	let columns_config_hidden = $state({});
	// Mapa `{ columna: true }` con lo que el usuario ocultó. Es la única parte
	// que se persiste en el navegador.
	let user_hidden_columns = $state({});
	// Clave de tabla activa (explícita o automática) y la clave registrada para
	// detectar colisiones entre varias tablas montadas.
	let activeStorageKey = $state('');
	let registeredKey = '';
	// Columnas que el usuario puede mostrar u ocultar, en orden de aparición.
	let configurable_columns = $derived(
		Object.keys(internal_columns).filter((item) => IsColumnConfigurable(item))
	);
	// Clave de persistencia resuelta (explícita o automática). Reacciona a
	// cambios de `storageKey`, `persistColumns` y del conjunto de columnas.
	let resolved_storage_key = $derived(ResolveStorageKey());

	let idTimeoutDataChanged;
	let idTimeoutSearch;
	let unsubscribeStoreChangedTables;

	$effect(() => {
		RawDataTable;
		onrawDataChanged();
	});

	// Si el consumidor cambia `storageKey`/`persistColumns` en caliente, o si la
	// clave automática cambia al conocerse las columnas, se vuelve a resolver y
	// se recarga la preferencia. `untrack` evita depender de `internal_columns`.
	$effect(() => {
		const key = resolved_storage_key;
		untrack(() => {
			ApplyStorageKey(key);
			ApplyColumnPreferences();
		});
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

		// Cargar la selección de columnas del usuario. Se hace aquí (y no durante
		// el render) para evitar desajustes de hidratación en SSR. Si los datos
		// todavía no han llegado, `SetColumns` resolverá la clave automática y
		// volverá a aplicar el override.
		ApplyStorageKey(ResolveStorageKey());
		ApplyColumnPreferences();
		if (typeof window !== 'undefined') {
			window.addEventListener('storage', HandleStorageEvent);

			if (showColumnsButton) {
				if (!persistColumns) {
					console.warn(
						'[Table] showColumnsButton está activo pero persistColumns=false: la selección de columnas no se guardará.'
					);
				} else if (!storageKey) {
					console.info(
						'[Table] Persistencia de columnas con clave automática. ' +
							'Defina "storageKey" para una clave estable y única por tabla.'
					);
				}
			}
		}

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
			columns_config_hidden = {};

			Object.keys(RawDataTable[0]).forEach((item) => {
				if (item === 'internal_hash_row') {
					internal_columns[item] = {
						label: item.substring(0, MaxSizeLabel),
						hidden: true
					};
				} else if (columns[item]) {
					// Copia superficial: nunca mutamos la prop del consumidor.
					internal_columns[item] = { ...columns[item] };
					if (!internal_columns[item].label) {
						internal_columns[item].label = item.substring(0, MaxSizeLabel);
					}
				} else {
					internal_columns[item] = {
						label: item.substring(0, MaxSizeLabel),
						hidden: false
					};
				}

				columns_config_hidden[item] = internal_columns[item].hidden === true;
			});

			// La clave automática depende de las columnas: se resuelve aquí,
			// cuando ya se conocen, antes de aplicar la selección del usuario.
			ApplyStorageKey(ResolveStorageKey());
			ApplyColumnPreferences();
		}
	}

	/**
	 * Indica si el usuario puede alternar la columna. Las columnas ocultas por
	 * configuración (incluida `internal_hash_row`) quedan fuera.
	 * @param {string} item
	 * @returns {boolean}
	 */
	function IsColumnConfigurable(item) {
		return item !== 'internal_hash_row' && columns_config_hidden[item] !== true;
	}

	/**
	 * Determina la clave de persistencia a usar. Orden de precedencia:
	 *  1. `persistColumns = false` → sin persistencia.
	 *  2. `storageKey` explícita → se usa tal cual.
	 *  3. Clave automática estable a partir de la ruta y la firma de columnas.
	 *
	 * Se prefiere la configuración `columns` del desarrollador (estable) y se
	 * cae a las columnas reales de los datos solo si no hay configuración.
	 * @returns {string}
	 */
	function ResolveStorageKey() {
		if (!persistColumns) return '';
		if (storageKey) return storageKey;

		const configured = columns ? Object.keys(columns) : [];
		const source = configured.length > 0 ? configured : Object.keys(internal_columns);
		if (source.length === 0) return '';

		const path = typeof window !== 'undefined' ? window.location.pathname : '';
		return autoColumnPreferencesKey(path, source);
	}

	/**
	 * Activa la clave de persistencia actual cuando cambia (por cambio de prop
	 * o porque las columnas se conocieron después). Carga las preferencias y
	 * registra la clave para avisar de colisiones.
	 * @param {string} key
	 */
	function ApplyStorageKey(key) {
		if (key === activeStorageKey) return;

		if (registeredKey) {
			unregisterActiveColumnPreferencesKey(registeredKey);
			registeredKey = '';
		}

		activeStorageKey = key;

		if (key) {
			registerActiveColumnPreferencesKey(key);
			registeredKey = key;
			user_hidden_columns = loadColumnPreferences(key);
		}
	}

	/**
	 * Fusiona la selección del usuario sobre `internal_columns`. Se vuelve a
	 * llamar cada vez que se reconstruyen las columnas (refresco de datos) para
	 * que el refresco no borre la elección del usuario.
	 */
	function ApplyColumnPreferences() {
		Object.keys(internal_columns).forEach((item) => {
			if (item === 'internal_hash_row') return;
			const config_hidden = columns_config_hidden[item] === true;
			internal_columns[item].hidden = config_hidden || user_hidden_columns[item] === true;
		});
	}

	/**
	 * Oculta o muestra una columna y persiste la elección.
	 * @param {string} item
	 */
	function ToggleColumn(item) {
		if (!IsColumnConfigurable(item)) return;

		const next_hidden = !internal_columns[item].hidden;
		const next = { ...user_hidden_columns };
		if (next_hidden) {
			next[item] = true;
		} else {
			delete next[item];
		}

		user_hidden_columns = next;
		ApplyColumnPreferences();
		saveColumnPreferences(activeStorageKey, user_hidden_columns);
		oncolumnschange($state.snapshot(user_hidden_columns));
	}

	/** Restablece la visibilidad por defecto definida por el desarrollador. */
	function ResetColumns() {
		user_hidden_columns = {};
		clearColumnPreferences(activeStorageKey);
		ApplyColumnPreferences();
		oncolumnschange($state.snapshot(user_hidden_columns));
	}

	/**
	 * Oculta TODAS las columnas configurables de una vez y persiste la
	 * elección. Pensado para tablas con muchas columnas: vaciar y luego marcar
	 * solo las necesarias.
	 */
	function HideAllColumns() {
		if (configurable_columns.length === 0) return;

		const next = {};
		for (const col of configurable_columns) {
			next[col] = true;
		}

		user_hidden_columns = next;
		ApplyColumnPreferences();
		saveColumnPreferences(activeStorageKey, user_hidden_columns);
		oncolumnschange($state.snapshot(user_hidden_columns));
	}

	/**
	 * Sincroniza la selección cuando otra pestaña del mismo origen la cambia.
	 * @param {StorageEvent} event
	 */
	function HandleStorageEvent(event) {
		if (!activeStorageKey) return;
		if (event.key !== null && event.key !== columnPreferencesKey(activeStorageKey)) return;
		user_hidden_columns = loadColumnPreferences(activeStorageKey);
		ApplyColumnPreferences();
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
					ExportTableToXlsx(filteredData, internal_columns, fileNameExport);
				} else {
					ExportTableToHTML(filteredData, internal_columns, fileNameExport);
				}
				notify.push({
					message: `Exported ${filteredData.length} rows to ${type.toUpperCase()}.`,
					color: 'success',
					title: 'Export'
				});
			} else {
				selectionType = 2;
				notify.push({ message: 'Select the rows to export.', color: 'warning', title: 'Export' });
			}
		} catch (error) {
			notify.push({
				message: 'Export failed: ' + error.message,
				color: 'danger',
				title: 'Export Error'
			});
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
		if (registeredKey) {
			unregisterActiveColumnPreferencesKey(registeredKey);
			registeredKey = '';
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('storage', HandleStorageEvent);
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
			notify.push({
				message: 'Delete failed: ' + error.message,
				color: 'danger',
				title: 'Delete Error'
			});
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

		if (PageSelected > totalPages) {
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
					notify.push({
						message: 'Fetch error: ' + error.message,
						color: 'danger',
						title: 'Data Error'
					});
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

	function handleToolbarColumns() {
		ShowDialogColumn = true;
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
	{showColumnsButton}
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
	onColumns={handleToolbarColumns}
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
			<thead class="table_head">
				<tr>
					<th class="has-text-centered">#</th>
					{#if selectionType == 1}
						<th class="has-text-centered"><span>-</span></th>
					{:else if selectionType == 2}
						<th class="has-text-centered">
							<input type="checkbox" onclick={handleChangeSelectAll} />
						</th>
					{/if}

					{#if showEditRow}
						<th class="has-text-centered">
							<i class="fas fa-pen"></i>
						</th>
					{/if}

					{#if internal_columns}
						{#each Object.keys(internal_columns) as item, ith}
							{#if internal_columns[item]}
								{#if !internal_columns[item].hidden || internal_columns[item].hidden == null}
									<th
										class="has-text-centered show_cursor_mouse"
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

<DialogModal
	bind:show={ShowDialogColumn}
	label_accept="Accept"
	label_cancel="Reset"
	onaccept={() => (ShowDialogColumn = false)}
	oncancel={ResetColumns}
>
	{#snippet title()}
		<span>Columns</span>
	{/snippet}
	{#snippet footer()}
		<button
			class="button is-warning is-small mr-auto"
			title="Hide all columns"
			data-testid="table-hide-all-columns"
			disabled={configurable_columns.length === 0}
			onclick={HideAllColumns}
		>
			<span class="icon is-small"><i class="fas fa-eye-slash"></i></span>
			<span>Hide all</span>
		</button>
	{/snippet}
	{#snippet body()}
		{#if configurable_columns.length > 0}
			<div class="columns is-multiline">
				{#each configurable_columns as col (col)}
					<div class="column is-half">
						<label class="checkbox">
							<input
								type="checkbox"
								checked={!internal_columns[col].hidden}
								onchange={() => ToggleColumn(col)}
							/>
							{internal_columns[col].label}
						</label>
					</div>
				{/each}
			</div>
		{:else}
			<div class="has-text-grey is-size-7">No configurable columns.</div>
		{/if}
	{/snippet}
</DialogModal>

<style>
	.show_cursor_mouse {
		cursor: pointer;
	}

	.margin_title {
		margin-left: 0.5em;
	}

	/* ------------------------------------------------------------------
	   Encabezado de la tabla.

	   Antes se pintaba con la clase fija de Bulma `has-background-link-dark`,
	   que resuelve a `--bulma-link-10-l` (8% de luminosidad) y NO rota con el
	   tema: en modo claro era un azul casi negro sobre caja blanca y en modo
	   oscuro ese mismo azul casi negro sobre una superficie oscura (contraste
	   1.16:1 medido), con lo que la banda del encabezado dejaba de leerse.

	   Se resuelve con variables propias que sí cambian de valor: superficie
	   invertida respecto al tema y texto con la polaridad contraria. Los
	   objetivos son texto >= 4.5:1 (WCAG 1.4.3) y banda >= 3:1 frente a la
	   superficie (WCAG 1.4.11); se verifican en tests/table-theme.spec.js.
	   ------------------------------------------------------------------ */
	:global(:root) {
		--table-head-bg: hsl(221, 14%, 21%);
		--table-head-fg: hsl(221, 14%, 96%);
		--table-head-hover-bg: hsl(221, 14%, 27%);
		/* Separador con el cuerpo: contrasta a la vez con el encabezado y con
		   la primera fila. */
		--table-head-border: hsl(221, 14%, 35%);
	}

	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--table-head-bg: hsl(221, 14%, 91%);
			--table-head-fg: hsl(221, 14%, 14%);
			--table-head-hover-bg: hsl(221, 14%, 84%);
			--table-head-border: hsl(221, 14%, 55%);
		}
	}

	/* Bulma resuelve el tema con `prefers-color-scheme` y con `[data-theme]`.
	   Los selectores de atributo se declaran después del media query para que
	   una elección explícita del usuario gane siempre a la del sistema. */
	:global([data-theme='dark']) {
		--table-head-bg: hsl(221, 14%, 91%);
		--table-head-fg: hsl(221, 14%, 14%);
		--table-head-hover-bg: hsl(221, 14%, 84%);
		--table-head-border: hsl(221, 14%, 55%);
	}

	:global([data-theme='light']) {
		--table-head-bg: hsl(221, 14%, 21%);
		--table-head-fg: hsl(221, 14%, 96%);
		--table-head-hover-bg: hsl(221, 14%, 27%);
		--table-head-border: hsl(221, 14%, 35%);
	}

	.table_head th {
		background-color: var(--table-head-bg);
		color: var(--table-head-fg);
		/* `is-bordered` pinta separadores del color de cada celda, más claros
		   que el fondo del encabezado, y lo rayaban. El borde inferior se
		   sustituye por uno propio, visible contra el encabezado y contra el
		   cuerpo en los dos temas. */
		border-bottom: 2px solid var(--table-head-border);
	}

	/* Afordancia visual de las columnas ordenables: hasta ahora solo había
	   `cursor: pointer`. */
	.table_head th.show_cursor_mouse:hover,
	.table_head th.show_cursor_mouse:focus-visible {
		background-color: var(--table-head-hover-bg);
	}

	.table_loading_bar {
		display: flex;
		align-items: center;
		gap: 0.5em;
		padding: 0.4em 0.8em;
		background-color: var(--bulma-info-light, #54c6ec);
		border-bottom: 1px solid var(--bulma-border, #dbdbdb);
		font-size: 0.85em;
		color: var(--bulma-info-on-scheme, #1f4e79);
	}
	.table_loading_text {
		font-weight: 500;
	}
</style>
