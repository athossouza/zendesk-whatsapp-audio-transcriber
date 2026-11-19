export type Theme = 'light' | 'dark';

/**
 * Zendesk has its own light/dark setting, independent of the OS, so the theme
 * is read from the page background instead of `prefers-color-scheme`.
 */
export function themeFromColor(color: string): Theme {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(color);
  if (!m) return 'light';
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  if (alpha < 0.5) return 'light'; // transparent: assume the default light page
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Number(v) / 255) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.4 ? 'dark' : 'light';
}

export function pageTheme(doc: Document = document): Theme {
  for (const el of [doc.querySelector('main'), doc.body, doc.documentElement]) {
    if (!el) continue;
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return themeFromColor(bg);
  }
  return 'light';
}
