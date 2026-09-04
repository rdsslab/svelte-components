import { writable } from 'svelte/store';

/**
 * Global store for managing active notifications.
 * Subscribers can listen to changes to update the UI.
 * @type {import('svelte/store').Writable<Array<Object>>}
 */
export let notifications_store = writable([]);

/**
 * Compares two values for equality. If the values are objects, they are compared via JSON.stringify.
 * Useful for deep comparison of simple objects or comparing state changes.
 * 
 * @param {any} value - The first value to compare (current state).
 * @param {any} new_value - The second value to compare (new state).
 * @returns {boolean} True if the stringified values are identical, false otherwise.
 */
export const equalObjs = (value, new_value) => {
	let new_value_str = typeof new_value == 'object' ? JSON.stringify(new_value) : new_value;
	let currect_value_str = typeof value == 'object' ? JSON.stringify(value) : value;
	console.log(value, new_value, new_value_str, currect_value_str);
	return new_value_str == currect_value_str;
};

/**
 * Class responsible for managing application notifications.
 * Provides methods to add and automatically or manually remove notifications from the global store.
 */
export class Notifications {
	/**
	 * Creates an instance of Notifications.
	 */
	constructor() {
		this._intervals = new Map();
	}

	/**
	 * Adds a new notification to the global store and automatically schedules its removal.
	 * 
	 * @param {Object} new_notify - The notification object to add.
	 * @param {string} [new_notify.id] - Optional ID. One will be generated if not provided.
	 * @param {number} [new_notify.timeout=5000] - Duration in milliseconds before the notification is automatically removed.
	 * @param {string} [new_notify.message] - The message text of the notification.
	 * @param {string} [new_notify.title] - The title of the notification.
	 * @param {string} [new_notify.color] - The color type: 'success', 'danger', 'warning', 'info'.
	 */
	push(new_notify) {
		new_notify.id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
		const timeout = new_notify.timeout || 5000;
		new_notify.timeout = timeout;
		new_notify._remaining = timeout;
		new_notify._lastTick = Date.now();
		new_notify.paused = false;

		notifications_store.update((u) => {
			u.push(new_notify);
			this._startTimer(new_notify.id, timeout);
			return u;
		});
	}

	_startTimer(id, timeout) {
		if (this._intervals.has(id)) {
			clearInterval(this._intervals.get(id));
		}
		const interval = setInterval(() => {
			notifications_store.update((u) => {
				const n = u.find((n) => n.id === id);
				if (!n) {
					clearInterval(interval);
					this._intervals.delete(id);
					return u;
				}
				if (n.paused) {
					n._lastTick = Date.now();
					return u;
				}
				const now = Date.now();
				const elapsed = now - n._lastTick;
				n._remaining -= elapsed;
				n._lastTick = now;
				if (n._remaining <= 0) {
					const index = u.findIndex((n) => n.id === id);
					if (index !== -1) u.splice(index, 1);
					clearInterval(interval);
					this._intervals.delete(id);
				}
				return u;
			});
		}, 100);
		this._intervals.set(id, interval);
	}

	/**
	 * Removes a notification from the global notifications store by its ID.
	 * 
	 * @param {string} id - The unique identifier of the notification to be removed.
	 */
	removeNotify(id) {
		if (this._intervals.has(id)) {
			clearInterval(this._intervals.get(id));
			this._intervals.delete(id);
		}
		notifications_store.update((u) => {
			const index = u.findIndex((obj) => obj.id === id);
			if (index !== -1) {
				u.splice(index, 1);
			}
			return u;
		});
	}
}
