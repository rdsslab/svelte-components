<script>
	/**
	 * TablePagination - Componente de paginación para la tabla.
	 * Recibe estado de paginación como props y notifica cambios al padre.
	 */

	let {
		pageSelected = 1,
		totalPages = 0,
		totalFilteredRows = 0,
		pageSize = [25, 50, 100],
		pageSizeSelected = 0,
		visiblePages = [],
		onPageChange = (page) => {},
		onPageSizeChange = (index) => {}
	} = $props();
</script>

<div class="table_pagination">
	<nav class="level">
		<!-- Left side -->
		<div class="level-left">
			{#if totalPages > 1}
				<div class="level-item">
					<span>
						Page {pageSelected} of {totalPages} (Total {totalFilteredRows}
						rows)
					</span>
				</div>
				<div class="level-item">
					<div class="buttons has-addons">
						<button
							aria-label="first page"
							class="button is-small"
							onclick={() => onPageChange(1)}
						>
							<span class="icon">
								<i class="fas fa-angle-double-left"></i>
							</span>
						</button>
						<button
							aria-label="previous page"
							class="button is-small"
							onclick={() => onPageChange(Math.max(1, pageSelected - 1))}
						>
							<span class="icon">
								<i class="fas fa-angle-left"></i>
							</span>
						</button>
						<button
							class="button is-small is-info"
							onclick={() => onPageChange(pageSelected)}>{pageSelected}</button
						>
						{#each visiblePages as pageNum}
							<button
								class="button is-small"
								onclick={() => onPageChange(pageNum)}>{pageNum}</button
							>
						{/each}
						<button
							aria-label="next page"
							class="button is-small"
							onclick={() => onPageChange(Math.min(totalPages, pageSelected + 1))}
						>
							<span class="icon">
								<i class="fas fa-angle-right"></i>
							</span>
						</button>
						<button
							aria-label="last page"
							class="button is-small"
							onclick={() => onPageChange(totalPages)}
						>
							<span class="icon">
								<i class="fas fa-angle-double-right"></i>
							</span>
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Right side -->
		<div class="level-right">
			<span class="level-item">
				<span class="label_rows_per_page">Rows per page</span>
				<div class="select is-small">
					<select
						name="rows_per_page"
						onchange={(e) => {
							onPageSizeChange(parseInt(e.target.value, 10));
						}}
					>
						{#each pageSize as item, itd}
							<option value={itd} selected={item == pageSize[pageSizeSelected]}>{item}</option>
						{/each}
					</select>
				</div>
			</span>
		</div>
	</nav>
</div>

<style>
	.table_pagination {
		width: 98%;
		margin: auto;
	}
	.label_rows_per_page {
		margin-right: 1em;
	}
</style>
