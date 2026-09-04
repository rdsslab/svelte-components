<script>
	/**
	 * @typedef {Object} JSONViewProps
	 * @property {any} jsonObject - The JSON data to display.
	 * @property {number} [indent=2] - Number of spaces for indentation.
	 * @property {boolean} [showCopy=true] - Show the copy-to-clipboard button.
	 * @property {boolean} [showLineNumbers=true] - Show line numbers.
	 * @property {boolean} [showBox=true] - Wrap in a Bulma .box container.
	 * @property {number} [maxHeight=0] - Max height in px before scrolling. 0 = no limit.
	 * @property {string} [emptyMessage='Sin datos'] - Message shown when JSON is empty.
	 * @property {string} [label] - Optional label/title displayed above the JSON.
	 */

	/** @type {JSONViewProps & Record<string, any>} */
	let {
		jsonObject = $bindable({}),
		indent = 2,
		showCopy = true,
		showLineNumbers = true,
		showBox = true,
		maxHeight = 0,
		emptyMessage = 'Sin datos',
		label
	} = $props();

	let copied = $state(false);

	function formatJson(obj) {
		if (obj === undefined || obj === null) return '';
		if (typeof obj === 'string') {
			try {
				return JSON.stringify(JSON.parse(obj), null, indent);
			} catch {
				return obj;
			}
		}
		try {
			return JSON.stringify(obj, null, indent);
		} catch {
			return String(obj);
		}
	}

	function syntaxHighlight(json) {
		if (!json) return '';

		json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		return json.replace(
			/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
			function (match) {
				let cls = 'number';
				if (/^"/.test(match)) {
					cls = /:$/.test(match) ? 'key' : 'string';
				} else if (/true|false/.test(match)) {
					cls = 'boolean';
				} else if (/null/.test(match)) {
					cls = 'null';
				}
				return `<span class="jv-${cls}">${match}</span>`;
			}
		);
	}

	function addLineNumbers(html) {
		const lines = html.split('\n');
		return lines
			.map((line, i) => {
				const num = String(i + 1).padStart(String(lines.length).length, ' ');
				return `<span class="jv-line-num">${num}</span>${line}`;
			})
			.join('\n');
	}

	let formattedText = $derived(formatJson(jsonObject));
	let highlightedHtml = $derived(formatJson(jsonObject) ? syntaxHighlight(formattedText) : '');
	let displayHtml = $derived(
		highlightedHtml ? (showLineNumbers ? addLineNumbers(highlightedHtml) : highlightedHtml) : ''
	);
	let isEmpty = $derived(
		jsonObject === undefined || jsonObject === null ||
		(typeof jsonObject === 'object' && !Array.isArray(jsonObject) && Object.keys(jsonObject).length === 0) ||
		(typeof jsonObject === 'string' && jsonObject.trim() === '')
	);
	let lineCount = $derived(formattedText ? formattedText.split('\n').length : 0);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(formattedText);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			const ta = document.createElement('textarea');
			ta.value = formattedText;
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}
</script>

{#snippet content()}
	<div class="jv-container" class:jv-with-box={showBox}>
		{#if label || showCopy}
			<div class="jv-header">
				{#if label}
					<span class="jv-label">{label}</span>
				{/if}
				{#if showCopy && !isEmpty}
					<button class="button is-small is-light jv-copy-btn" onclick={copyToClipboard} title="Copiar JSON">
						<span class="icon is-small">
							<i class={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
						</span>
						<span>{copied ? 'Copiado' : 'Copiar'}</span>
					</button>
				{/if}
			</div>
		{/if}

		<div
			class="jv-scroll"
			style={maxHeight > 0 ? `max-height: ${maxHeight}px; overflow-y: auto;` : ''}
		>
			{#if isEmpty}
				<div class="jv-empty">
					<i class="fa-regular fa-file-code"></i>
					<span>{emptyMessage}</span>
				</div>
			{:else}
				<pre class="jv-pre">{@html displayHtml}</pre>
			{/if}
		</div>
	</div>
{/snippet}

{#if showBox}
	<div class="box">
		{@render content()}
	</div>
{:else}
	{@render content()}
{/if}

<style>
	.jv-container {
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.jv-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.jv-label {
		font-weight: 600;
		color: #363636;
		font-size: 0.9rem;
	}

	.jv-copy-btn {
		font-family: inherit;
	}

	.jv-pre {
		background-color: transparent;
		padding: 0.75rem;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.jv-scroll {
		border: 1px solid #dbdbdb;
		border-radius: 4px;
	}

	.jv-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		color: #7a7a7a;
		font-style: italic;
	}

	.jv-empty i {
		font-size: 1.5rem;
	}

	:global(.jv-string) {
		color: #067d17;
	}

	:global(.jv-number) {
		color: #0b76e0;
	}

	:global(.jv-boolean) {
		color: #d10808;
	}

	:global(.jv-null) {
		color: #929292;
		font-style: italic;
	}

	:global(.jv-key) {
		color: #a31515;
	}

	:global(.jv-line-num) {
		display: inline-block;
		width: 2.5em;
		text-align: right;
		padding-right: 0.75em;
		color: #b0b0b0;
		user-select: none;
		border-right: 1px solid #e0e0e0;
		margin-right: 0.75em;
	}
</style>
