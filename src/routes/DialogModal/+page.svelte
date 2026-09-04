<script>
	import { DialogModal, Modal, Notify, Notifications } from '$lib/index.js';

	const notify = new Notifications();

	let showConfirm = $state(false);
	let showCustom = $state(false);
	let showBasic = $state(false);
	let showDisabledClose = $state(false);

	function handleAccept() {
		notify.push({ title: 'Aceptado', message: 'El usuario aceptó la acción.', color: 'success' });
		showConfirm = false;
	}

	function handleCancel() {
		notify.push({ title: 'Cancelado', message: 'El usuario canceló la acción.', color: 'info' });
		showConfirm = false;
	}
</script>

<h2 class="title is-4">DialogModal</h2>
<p class="subtitle is-6">Ejemplos de uso del componente Modal y DialogModal</p>

<div class="buttons">
	<button class="button is-link" onclick={() => (showConfirm = true)}>Confirmar acción</button>
	<button class="button is-info" onclick={() => (showCustom = true)}>Modal personalizado</button>
	<button class="button is-dark" onclick={() => (showBasic = true)}>Modal básico</button>
	<button class="button is-warning" onclick={() => (showDisabledClose = true)}>Sin cierre externo</button>
</div>

<!-- DialogModal: Confirmación -->
<DialogModal bind:show={showConfirm} onaccept={handleAccept} oncancel={handleCancel}>
	{#snippet title()}¿Confirmar?{/snippet}
	{#snippet body()}
		<p>Esta acción no se puede deshacer. ¿Deseas continuar?</p>
	{/snippet}
</DialogModal>

<!-- DialogModal: Personalizado -->
<DialogModal
	bind:show={showCustom}
	label_accept="Guardar"
	label_cancel="Cerrar"
	onaccept={() => {
		notify.push({ title: 'Guardado', message: 'Los cambios se guardaron correctamente.', color: 'success' });
		showCustom = false;
	}}
	oncancel={() => (showCustom = false)}
>
	{#snippet title()}Configuración{/snippet}
	{#snippet body()}
		<div class="field">
			<label class="label">Nombre</label>
			<div class="control">
				<input class="input" type="text" placeholder="Escribe un nombre" />
			</div>
		</div>
		<div class="field">
			<label class="label">Email</label>
			<div class="control">
				<input class="input" type="email" placeholder="email@ejemplo.com" />
			</div>
		</div>
	{/snippet}
</DialogModal>

<!-- Modal básico -->
<Modal bind:show={showBasic}>
	<div class="modal-card">
		<header class="modal-card-head has-background-dark">
			<p class="modal-card-title has-text-white"><b>Información</b></p>
			<button class="delete" aria-label="close" onclick={() => (showBasic = false)}></button>
		</header>
		<section class="modal-card-body">
			<p>Este es un <b>Modal</b> básico usando el componente base.</p>
			<p class="mt-2">Puedes poner cualquier contenido aquí.</p>
		</section>
		<footer class="modal-card-foot has-background-dark">
			<button class="button is-success is-small" onclick={() => (showBasic = false)}>Entendido</button>
		</footer>
	</div>
</Modal>

<!-- Sin cierre externo -->
<DialogModal
	bind:show={showDisabledClose}
	closeOnBackground={false}
	closeOnEscape={false}
	label_accept="Entendido"
	onaccept={() => (showDisabledClose = false)}
>
	{#snippet title()}Atención{/snippet}
	{#snippet body()}
		<p>Este modal <b>no se cierra</b> al hacer click fuera o presionar Escape.</p>
		<p class="mt-2">Solo se puede cerrar con los botones.</p>
	{/snippet}
</DialogModal>

<div class="box mt-5">
	<h3 class="title is-5">API</h3>
<pre><code>{'import { DialogModal, Modal } from \'$lib/index.js\';'}

{'<!-- DialogModal: wrapper con footer -->'}
{'<DialogModal'}
  {'bind:show={open}'}
  {'onaccept={() => ...}'}
  {'oncancel={() => ...}'}
  {'label_accept="Aceptar"'}
  {'label_cancel="Cancelar"'}
  {'closeOnEscape={true}'}
  {'closeOnBackground={true}'}{'>'}
  {'{#snippet title()}Título{/snippet}'}
  {'{#snippet body()}Contenido{/snippet}'}
{'</DialogModal>'}

{'<!-- Modal: componente base -->'}
{'<Modal bind:show={open} closeOnEscape closeOnBackground>'}
  {'...contenido personalizado...'}
{'</Modal>'}</code></pre>
</div>

<Notify />
