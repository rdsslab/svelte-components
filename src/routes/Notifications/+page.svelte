<script>
	import { Notify, Notifications } from '$lib/index.js';

	const notify = new Notifications();

	function pushSuccess() {
		notify.push({ title: 'Éxito', message: 'Operación completada correctamente.', color: 'success' });
	}

	function pushDanger() {
		notify.push({ title: 'Error', message: 'Ocurrió un error al procesar la solicitud.', color: 'danger' });
	}

	function pushWarning() {
		notify.push({ title: 'Advertencia', message: 'La sesión expirará en 5 minutos.', color: 'warning' });
	}

	function pushInfo() {
		notify.push({ title: 'Info', message: 'Hay una actualización disponible.', color: 'info' });
	}

	function pushCustomTimeout() {
		notify.push({ title: 'Largo', message: 'Esta notificación dura 10 segundos.', color: 'success', timeout: 10000 });
	}

	function pushMultiple() {
		notify.push({ title: 'Uno', message: 'Primera notificación.', color: 'info' });
		notify.push({ title: 'Dos', message: 'Segunda notificación.', color: 'warning' });
		notify.push({ title: 'Tres', message: 'Tercera notificación.', color: 'danger' });
	}
</script>

<h2 class="title is-4">Notificaciones</h2>
<p class="subtitle is-6">Ejemplos de uso del componente Notifications</p>

<div class="buttons">
	<button class="button is-success" onclick={pushSuccess}>Success</button>
	<button class="button is-danger" onclick={pushDanger}>Danger</button>
	<button class="button is-warning" onclick={pushWarning}>Warning</button>
	<button class="button is-info" onclick={pushInfo}>Info</button>
	<button class="button is-link" onclick={pushCustomTimeout}>Custom Timeout (10s)</button>
	<button class="button is-dark" onclick={pushMultiple}>Multiple</button>
</div>

<div class="box mt-5">
	<h3 class="title is-5">API</h3>
<pre><code>import {'{ Notifications }'} from '$lib/index.js';

const notify = new Notifications();

// Básico
notify.push({'{'} title: '...', message: '...', color: 'success' {'}'});

// Con timeout personalizado
notify.push({'{'} title: '...', message: '...', color: 'danger', timeout: 10000 {'}'});

// Eliminar manualmente
notify.removeNotify(id);</code></pre>
</div>

<Notify />