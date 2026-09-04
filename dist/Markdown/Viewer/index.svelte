<script>
	import { marked, Renderer } from 'marked';

	/**
	 * @typedef {Object} MarkdownViewerProps
	 * @property {string} [markdown=''] - The raw Markdown string to render.
	 * @property {string} [content_class=''] - Additional CSS class(es) for the wrapper div.
	 * @property {boolean} [allow_html=false] - Whether raw HTML in Markdown is rendered. When false, raw HTML is escaped and rendered as plain text (prevents XSS).
	 * @property {boolean} [gfm=true] - Enable GitHub Flavored Markdown (tables, task lists, etc.).
	 * @property {boolean} [breaks=false] - Convert line breaks to <br>.
	 * @property {boolean} [showBox=false] - Wrap content in a Bulma .box container.
	 * @property {string} [empty_message=''] - Message shown when markdown is empty. Empty string = render nothing.
	 * @property {import('marked').MarkedOptions} [options={}] - Additional options passed to marked. Note: a safe renderer always takes precedence for security.
	 */

	/** @type {MarkdownViewerProps & Record<string, any>} */
	let {
		markdown = $bindable(''),
		content_class = $bindable(''),
		allow_html = false,
		gfm = true,
		breaks = false,
		showBox = false,
		empty_message = '',
		options = {}
	} = $props();

	const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|data|file):/i;

	function hasDangerousProtocol(url) {
		if (!url) return true;
		// relative URLs (no scheme) are always safe
		if (!/^[a-z][a-z0-9+.\-]*:/i.test(url.trim())) return false;
		return DANGEROUS_PROTOCOLS.test(url.trim());
	}

	function escapeHtml(text) {
		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function createSafeRenderer(allowHtml) {
		const renderer = new Renderer();

		const baseLink = renderer.link.bind(renderer);
		renderer.link = (token) => {
			if (hasDangerousProtocol(token.href)) {
				// drop the <a> tag but keep the visible text
				return renderer.parser.parseInline(token.tokens);
			}
			return baseLink(token);
		};

		const baseImage = renderer.image.bind(renderer);
		renderer.image = (token) => {
			if (hasDangerousProtocol(token.href)) return '';
			return baseImage(token);
		};

		if (!allowHtml) {
			renderer.html = (token) => escapeHtml(token.text);
		}

		return renderer;
	}

	function renderMarkdown(src) {
		try {
			if (!src || src.trim() === '') return '';
			return marked.parse(src, {
				...options,
				async: false,
				gfm,
				breaks,
				renderer: createSafeRenderer(allow_html)
			});
		} catch (err) {
			console.error('[MarkdownViewer] Parse error:', err);
			return `<p class="has-text-danger">Error rendering Markdown.</p>`;
		}
	}

	let html_string = $derived(renderMarkdown(markdown));
	let is_empty = $derived(!markdown || markdown.trim() === '');
</script>

{#if showBox}
	<div class="box">
		{#if is_empty && empty_message}
			<p class="has-text-grey">{empty_message}</p>
		{:else if !is_empty}
			<div class="content {content_class}">{@html html_string}</div>
		{/if}
	</div>
{:else}
	{#if is_empty && empty_message}
		<p class="has-text-grey">{empty_message}</p>
	{:else if !is_empty}
		<div class="content {content_class}">{@html html_string}</div>
	{/if}
{/if}