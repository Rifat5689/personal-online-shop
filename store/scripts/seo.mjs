export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const plainText = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export function metadata({ title, description, image, url, type = 'website', noindex = false }) {
  const tags = [
    ['name', 'description', description], ['name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow'],
    ['property', 'og:type', type], ['property', 'og:site_name', 'Origins of Beauty'],
    ['property', 'og:title', title], ['property', 'og:description', description],
    ['property', 'og:url', url], ['property', 'og:image', image], ['property', 'og:image:alt', title],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', title],
    ['name', 'twitter:description', description], ['name', 'twitter:image', image],
  ];
  return `<title>${escapeHtml(title)}</title><link rel="canonical" href="${escapeHtml(url)}"/>` + tags.map(([attribute, name, content]) => `<meta ${attribute}="${name}" content="${escapeHtml(content)}"/>`).join('');
}
export function renderPage(template, data, body = '', schema) {
  return template.replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>/g, '')
    .replace(/<link rel="canonical"[^>]*>/g, '')
    .replace('</head>', `${metadata(data)}${schema ? `<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>` : ''}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}
