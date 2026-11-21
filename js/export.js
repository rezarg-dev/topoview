// Saving the diagram as a file that looks the same outside the page.

/**
 * A copy of the SVG that carries its own styles.
 *
 * The page styles the diagram through its stylesheet and custom properties
 * on :root. In a standalone SVG file :root is the <svg> element, so copying
 * the rules and the theme attribute is enough for them to apply again.
 */
export function toStandaloneSvg(svg) {
  const copy = svg.cloneNode(true);
  const [, , width, height] = svg.getAttribute('viewBox').split(' ');
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', width);
  copy.setAttribute('height', height);
  copy.removeAttribute('class');
  copy.removeAttribute('id');

  const theme = document.documentElement.dataset.theme;
  if (theme) copy.setAttribute('data-theme', theme);

  const rules = [];
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) rules.push(rule.cssText);
  }
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  // The page gives the diagram its background through #canvas, which the
  // copy no longer has.
  style.textContent = `${rules.join('\n')}\nsvg { background: var(--background); font-family: system-ui, sans-serif; }`;
  copy.prepend(style);

  for (const node of copy.querySelectorAll('[tabindex]')) node.removeAttribute('tabindex');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}\n`;
}

export function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
