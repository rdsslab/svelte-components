/**
 * Global store that holds the data received from PostgreSQL notifications via WebSocket.
 * Components can subscribe to this store to react to database table changes.
 * @type {import('svelte/store').Writable<Object>}
 */
export const storeChangedTables: import("svelte/store").Writable<any>;
/**
 * WebSocketClient class responsible for establishing a connection to the server's WebSocket endpoint.
 * It listens for 'pgNotify' events to update the `storeChangedTables` store.
 * Inherits from EventEmitter to potentially allow event-driven architecture.
 */
export class WebSocketClient extends EventEmitter<any> {
    /**
     * Initializes the WebSocket client.
     */
    constructor();
    /**
     * The WebSocket instance.
     * @type {WebSocket}
     */
    websocket: WebSocket;
    /**
     * Establishes the WebSocket connection using the current global window.location.
     * Automatically handles reconnection on close and updates `storeChangedTables` upon receiving a table change notification.
     *
     * @returns {WebSocket} The active WebSocket connection instance.
     */
    connect(): WebSocket;
}
import { EventEmitter } from 'events';
