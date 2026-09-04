<script>
	import { notifications_store } from '../class/utils.js';

	let list_notify = $state([]);

	notifications_store.subscribe((value) => {
		list_notify = value;
	});

	let visibleCount = $derived(list_notify.filter(n => !n.hidden).length);
	let overflowCount = $derived(Math.max(0, visibleCount - 5));

	const ICONS = {
		success: 'fa-check-circle',
		danger: 'fa-exclamation-circle',
		warning: 'fa-exclamation-triangle',
		info: 'fa-info-circle'
	};

	const COLOR_MAP = {
		success: '#23d160',
		danger: '#ff3860',
		warning: '#ffdd57',
		info: '#3e8ed0'
	};

	function getIcon(color) {
		return ICONS[color] || ICONS.info;
	}

	function getAccentColor(color) {
		return COLOR_MAP[color] || COLOR_MAP.info;
	}

	function dismiss(id) {
		notifications_store.update((u) => {
			const index = u.findIndex((n) => n.id === id);
			if (index !== -1) {
				u[index] = { ...u[index], hidden: true };
			}
			return u;
		});
	}

	function pauseTimer(id) {
		notifications_store.update((u) => {
			const n = u.find((n) => n.id === id);
			if (n) n.paused = true;
			return u;
		});
	}

	function resumeTimer(id) {
		notifications_store.update((u) => {
			const n = u.find((n) => n.id === id);
			if (n) n.paused = false;
			return u;
		});
	}

	function dismissFromButton(e, id) {
		e.stopPropagation();
		dismiss(id);
	}
</script>

<div class="notifications-container" role="alert" aria-live="polite">
	{#each list_notify as s (s.id)}
		{#if !s.hidden}
			<div
				class="notification-toast is-{s.color}"
				role="status"
				onmouseenter={() => pauseTimer(s.id)}
				onmouseleave={() => resumeTimer(s.id)}
				onclick={() => dismiss(s.id)}
			>
				<div class="notification-accent" style="background-color: {getAccentColor(s.color)};"></div>
				<div class="notification-icon">
					<i class="fas {getIcon(s.color)}" style="color: {getAccentColor(s.color)};"></i>
				</div>
				<div class="notification-content">
					{#if s.title}
						<div class="notification-title">{s.title}</div>
					{/if}
					<div class="notification-message">{s.message}</div>
					<div class="notification-progress">
						<div class="notification-progress-bar" style="width: {Math.max(0, (s._remaining / s.timeout) * 100)}%;"></div>
					</div>
				</div>
				<button
					class="notification-close"
					aria-label="Close notification"
					onclick={(e) => dismissFromButton(e, s.id)}
				>
					<i class="fas fa-times"></i>
				</button>
			</div>
		{/if}
	{/each}
	{#if overflowCount > 0}
		<div class="notification-overflow">
			+{overflowCount} more
		</div>
	{/if}
</div>

<style>
	.notifications-container {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 10000;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 380px;
		width: 100%;
		pointer-events: none;
	}

	.notification-toast {
		display: flex;
		align-items: flex-start;
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18), 0 1px 4px rgba(0, 0, 0, 0.08);
		padding: 0.875rem 1rem;
		position: relative;
		overflow: hidden;
		cursor: pointer;
		pointer-events: auto;
		animation: slideIn 0.3s ease-out forwards;
		transition: transform 0.2s ease, opacity 0.2s ease;
		border-left: 4px solid transparent;
	}

	.notification-toast:hover {
		transform: translateX(-4px);
	}

	.notification-accent {
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
	}

	.notification-icon {
		flex-shrink: 0;
		font-size: 1.15rem;
		margin-right: 0.75rem;
		margin-top: 0.1rem;
	}

	.notification-content {
		flex: 1;
		min-width: 0;
	}

	.notification-title {
		font-weight: 600;
		font-size: 0.85rem;
		color: #363636;
		margin-bottom: 0.2rem;
		line-height: 1.3;
	}

	.notification-message {
		font-size: 0.8rem;
		color: #666;
		line-height: 1.4;
		word-wrap: break-word;
	}

	.notification-progress {
		height: 3px;
		background: #e8e8e8;
		border-radius: 2px;
		margin-top: 0.6rem;
		overflow: hidden;
	}

	.notification-progress-bar {
		height: 100%;
		background: linear-gradient(90deg, #3e8ed0, #23d160);
		border-radius: 2px;
		transition: width 0.1s linear;
	}

	.notification-close {
		flex-shrink: 0;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		margin-left: 0.5rem;
		color: #999;
		font-size: 0.75rem;
		border-radius: 4px;
		transition: background 0.15s ease, color 0.15s ease;
		pointer-events: auto;
	}

	.notification-close:hover {
		background: #f0f0f0;
		color: #363636;
	}

	.notification-overflow {
		text-align: center;
		font-size: 0.75rem;
		color: #666;
		background: #f5f5f5;
		border-radius: 6px;
		padding: 0.35rem 0.75rem;
		pointer-events: auto;
	}

	/* Color variants */
	.notification-toast.is-success {
		border-left-color: #23d160;
	}
	.notification-toast.is-danger {
		border-left-color: #ff3860;
	}
	.notification-toast.is-warning {
		border-left-color: #ffdd57;
	}
	.notification-toast.is-info {
		border-left-color: #3e8ed0;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateX(100%);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
</style>
