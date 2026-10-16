<script>
	import { DialogModal, Modal, Notify, Notifications } from '$lib/index.js';

	const notify = new Notifications();

	let showConfirm = $state(false);
	let showCustom = $state(false);
	let showBasic = $state(false);
	let showDisabledClose = $state(false);

	function handleAccept() {
		notify.push({ title: 'Accepted', message: 'The user accepted the action.', color: 'success' });
		showConfirm = false;
	}

	function handleCancel() {
		notify.push({ title: 'Cancelled', message: 'The user cancelled the action.', color: 'info' });
		showConfirm = false;
	}
</script>

<h2 class="title is-4">DialogModal</h2>
<p class="subtitle is-6">Usage examples of the Modal and DialogModal components</p>

<div class="buttons">
	<button class="button is-link" onclick={() => (showConfirm = true)}>Confirm action</button>
	<button class="button is-info" onclick={() => (showCustom = true)}>Custom modal</button>
	<button class="button is-dark" onclick={() => (showBasic = true)}>Basic modal</button>
	<button class="button is-warning" onclick={() => (showDisabledClose = true)}
		>No outside close</button
	>
</div>

<!-- DialogModal: confirmation -->
<DialogModal bind:show={showConfirm} onaccept={handleAccept} oncancel={handleCancel}>
	{#snippet title()}Confirm?{/snippet}
	{#snippet body()}
		<p>This action cannot be undone. Do you want to continue?</p>
	{/snippet}
</DialogModal>

<!-- DialogModal: custom, with an extra footer button -->
<DialogModal
	bind:show={showCustom}
	label_accept="Save"
	label_cancel="Close"
	onaccept={() => {
		notify.push({ title: 'Saved', message: 'Changes were saved.', color: 'success' });
		showCustom = false;
	}}
	oncancel={() => (showCustom = false)}
	onclose={() =>
		notify.push({
			title: 'Closed',
			message: 'The X button only closed the dialog.',
			color: 'info'
		})}
>
	{#snippet title()}Configuration{/snippet}
	{#snippet footer()}
		<button
			class="button is-small is-warning mr-auto"
			onclick={() => notify.push({ title: 'Info', message: 'Extra footer button.', color: 'info' })}
		>
			Extra action
		</button>
	{/snippet}
	{#snippet body()}
		<div class="field">
			<label class="label">Name</label>
			<div class="control">
				<input class="input" type="text" placeholder="Type a name" />
			</div>
		</div>
		<div class="field">
			<label class="label">Email</label>
			<div class="control">
				<input class="input" type="email" placeholder="email@example.com" />
			</div>
		</div>
	{/snippet}
</DialogModal>

<!-- Basic modal -->
<Modal bind:show={showBasic}>
	<div class="modal-card">
		<header class="modal-card-head has-background-dark">
			<p class="modal-card-title has-text-white"><b>Information</b></p>
			<button class="delete" aria-label="close" onclick={() => (showBasic = false)}></button>
		</header>
		<section class="modal-card-body">
			<p>This is a basic <b>Modal</b> using the base component.</p>
			<p class="mt-2">You can put any content here.</p>
		</section>
		<footer class="modal-card-foot has-background-dark">
			<button class="button is-success is-small" onclick={() => (showBasic = false)}>Got it</button>
		</footer>
	</div>
</Modal>

<!-- No outside close -->
<DialogModal
	bind:show={showDisabledClose}
	closeOnBackground={false}
	closeOnEscape={false}
	label_accept="Got it"
	onaccept={() => (showDisabledClose = false)}
>
	{#snippet title()}Attention{/snippet}
	{#snippet body()}
		<p>This modal <b>does not close</b> when clicking outside or pressing Escape.</p>
		<p class="mt-2">It can only be closed through its buttons.</p>
	{/snippet}
</DialogModal>

<div class="box mt-5">
	<h3 class="title is-5">API</h3>
	<pre><code
			>{"import { DialogModal, Modal } from '$lib/index.js';"}

{'<!-- DialogModal: wrapper with footer -->'}
{'<DialogModal'}
  {'bind:show={open}'}
  {'onaccept={() => ...}'}
  {'oncancel={() => ...}'}{'   <!-- CANCEL button only -->'}
  {'onclose={() => ...}'}{'    <!-- X button, closes only -->'}
  {'label_accept="Accept"'}
  {'label_cancel="Cancel"'}
  {'closeOnEscape={true}'}
  {'closeOnBackground={true}'}{'>'}
  {'{#snippet title()}Title{/snippet}'}
  {'{#snippet footer()}Extra buttons here{/snippet}'}
  {'{#snippet body()}Content{/snippet}'}
{'</DialogModal>'}

{'<!-- Modal: base component -->'}
{'<Modal bind:show={open} closeOnEscape closeOnBackground>'}
  {'...custom content...'}
{'</Modal>'}</code
		></pre>
</div>

<Notify />
