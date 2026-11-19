/** 16 px line icons in the style of Zendesk Garden (stroke = currentColor). */
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.5,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  focusable: 'false',
} as const;

export function IconMore() {
  return (
    <svg {...base} stroke="none" fill="currentColor">
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}

/** Speech lines: "audio as text". */
export function IconTranscript() {
  return (
    <svg {...base}>
      <path d="M2.5 4.5h11M2.5 8h8M2.5 11.5h5" />
      <path d="M12 10v3M14 11v1M10 11v1" />
    </svg>
  );
}

export function IconCopy() {
  return (
    <svg {...base}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
    </svg>
  );
}

/** Internal note (page with folded corner). */
export function IconNote() {
  return (
    <svg {...base}>
      <path d="M3.5 2.5h6l3 3v8h-9z" />
      <path d="M9.5 2.5v3h3M5.5 8.5h5M5.5 11h3" />
    </svg>
  );
}

export function IconRefresh() {
  return (
    <svg {...base}>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 2.5v3h-3" />
    </svg>
  );
}

export function IconClose() {
  return (
    <svg {...base}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconCheck() {
  return (
    <svg {...base}>
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}
