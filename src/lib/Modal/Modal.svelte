<script>
	import { onMount, onDestroy } from 'svelte';

	/**
	 * Represents the parameters supported by the base Modal component.
	 *
	 * @typedef {Object} ModalProps
	 * @property {boolean} [show=false] - Controls the active/visible state of the modal.
	 * @property {import('svelte').Snippet} [children] - The Svelte snippet representing the body/content of the modal.
	 * @property {boolean} [showCloseButton=false] - Determines if a large top-right closing 'X' button should be displayed.
	 * @property {boolean} [closeOnEscape=true] - Whether the modal closes when Escape is pressed.
	 * @property {boolean} [closeOnBackground=true] - Whether the modal closes when clicking the background.
	 */

	/** @type {ModalProps & Record<string, any>} */
	let {
		show = $bindable(false),
		children,
		showCloseButton = $bindable(false),
		closeOnEscape = true,
		closeOnBackground = true
	} = $props();

	const isBrowser = typeof document !== 'undefined';

	function handleKeydown(e) {
		if (e.key === 'Escape' && show && closeOnEscape) {
			show = false;
			e.stopPropagation();
		}
	}

	function handleBackgroundClick() {
		if (closeOnBackground) {
			show = false;
		}
	}

	$effect(() => {
		if (!isBrowser) return;
		if (show) {
			document.body.style.overflow = 'hidden';
			document.addEventListener('keydown', handleKeydown);
		} else {
			document.body.style.overflow = '';
			document.removeEventListener('keydown', handleKeydown);
		}
	});

	onDestroy(() => {
		if (!isBrowser) return;
		document.body.style.overflow = '';
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="modal" class:is-active={show} role="dialog" aria-modal="true">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-background" onclick={handleBackgroundClick}></div>

	<div class="modal-content">
		{@render children?.()}
	</div>

	{#if showCloseButton}
		<button
			class="modal-close is-large"
			aria-label="close"
			onclick={() => {
				show = false;
			}}
		></button>
	{/if}
</div>
