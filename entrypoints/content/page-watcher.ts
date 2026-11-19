/**
 * Watches the Agent Workspace SPA: DOM changes (throttled) and ticket changes
 * without page reloads (spec section 5).
 */
export interface PageWatcherOptions {
  onScan: () => void;
  onNavigate: (pathname: string) => void;
  throttleMs?: number;
  pollMs?: number;
}

export function watchPage(win: Window, opts: PageWatcherOptions): () => void {
  const throttleMs = opts.throttleMs ?? 300;
  let lastPath = win.location.pathname;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastRun = 0;

  const scheduleScan = (): void => {
    if (timer) return;
    const wait = Math.max(0, lastRun + throttleMs - Date.now());
    timer = setTimeout(() => {
      timer = null;
      lastRun = Date.now();
      opts.onScan();
    }, wait);
  };

  const checkPath = (): void => {
    const path = win.location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    opts.onNavigate(path);
    scheduleScan();
  };

  const observer = new MutationObserver(scheduleScan);
  observer.observe(win.document.body, { childList: true, subtree: true });

  // Navigation API fires before the URL changes; check right after it settles.
  const nav = (win as Window & { navigation?: EventTarget }).navigation;
  const onNav = (): void => void setTimeout(checkPath, 0);
  nav?.addEventListener('navigatesuccess', onNav);
  const poll = setInterval(checkPath, opts.pollMs ?? 1000);

  scheduleScan();

  return () => {
    observer.disconnect();
    nav?.removeEventListener('navigatesuccess', onNav);
    clearInterval(poll);
    if (timer) clearTimeout(timer);
  };
}
