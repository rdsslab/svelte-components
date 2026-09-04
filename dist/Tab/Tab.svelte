<script>
	/**
	 * @typedef {Object} TabItem
	 * @property {string} label - Display text for the tab.
	 * @property {string} [classIcon] - Bulma/FontAwesome icon class (e.g., 'fas fa-home').
	 * @property {boolean} [disabled=false] - Whether the tab is disabled.
	 * @property {import('svelte').Snippet} [component] - Snippet rendered as tab content.
	 * @property {string} [alias] - Optional alias passed to the onselect callback.
	 */

	/** @type {{ classSize?: string, onselect?: (e: {label: string, index: number, alias?: string}) => void, tabs?: TabItem[], active?: number, children?: import('svelte').Snippet }} & Record<string, any> */
	let {
		classSize = $bindable('is-small'),
		onselect = (e) => {},
		tabs = $bindable([]),
		active = $bindable(0),
		children
	} = $props();

	let tabRefs = $state([]);

	function handleKeydown(e, index) {
		const enabled = tabs
			.map((t, i) => ({ t, i }))
			.filter(({ t }) => !t.disabled);

		const currentEnabledIdx = enabled.findIndex(({ i }) => i === index);
		if (currentEnabledIdx === -1) return;

		let targetEnabledIdx = currentEnabledIdx;

		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				e.preventDefault();
				targetEnabledIdx = (currentEnabledIdx + 1) % enabled.length;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				e.preventDefault();
				targetEnabledIdx = (currentEnabledIdx - 1 + enabled.length) % enabled.length;
				break;
			case 'Home':
				e.preventDefault();
				targetEnabledIdx = 0;
				break;
			case 'End':
				e.preventDefault();
				targetEnabledIdx = enabled.length - 1;
				break;
			default:
				return;
		}

		const targetIndex = enabled[targetEnabledIdx].i;
		selectTab(targetIndex);
		tabRefs[targetIndex]?.focus();
	}

	function selectTab(index) {
		const item = tabs[index];
		if (!item || item.disabled) return;
		active = index;
		onselect({ label: item.label, index, alias: item.alias });
	}
</script>

<div class="tabs is-boxed {classSize} tab-margin" role="tablist" aria-label="Tabs">
	<ul>
		{#each tabs as item, i (i)}
			<li class={active === i ? 'is-active' : ''} role="presentation">
				<button
					bind:this={tabRefs[i]}
					type="button"
					role="tab"
					id="tab-{i}"
					aria-selected={active === i}
					aria-controls="tabpanel-{i}"
					aria-disabled={item.disabled || false}
					tabindex={active === i ? 0 : -1}
					disabled={item.disabled}
					onclick={() => selectTab(i)}
					onkeydown={(e) => handleKeydown(e, i)}
				>
					{#if item.disabled}
						<span class="icon {classSize}">
							<i class="fa-solid fa-ban" aria-hidden="true"></i>
						</span>
						<span>{item.label}</span>
					{:else if item.classIcon}
						<span class="icon {classSize}">
							<i class={item.classIcon} aria-hidden="true"></i>
						</span>
						<span>{item.label}</span>
					{:else}
						{item.label}
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</div>

{#each tabs as tab, i (i)}
	{#if tab.component && active === i && !tab.disabled}
		<div
			id="tabpanel-{i}"
			role="tabpanel"
			aria-labelledby="tab-{i}"
		>
			{@render tab.component()}
		</div>
	{/if}
{/each}

{#if children}
	{@render children()}
{/if}

<style>
	.tab-margin {
		margin-bottom: 0.75em;
	}
</style>
