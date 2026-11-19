/**
 * Placement of floating UI (menu, transcription box) relative to an element of
 * the Zendesk page. Pure functions so they can be unit-tested.
 *
 * Why floating: each message of the Agent Workspace conversation is a fixed-height
 * row with `overflow: hidden` (virtualized list), so anything rendered inside the
 * bubble is clipped (found on the real page, ticket 454).
 */
export interface Box {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
}

export interface Placement {
  visible: boolean;
  left: number;
  width: number;
  /** Set when placed below the anchor. */
  top: number | null;
  /** Set when placed above the anchor (distance from the viewport bottom). */
  bottom: number | null;
  maxHeight: number;
}

const GAP = 4;
const MIN_W = 280;
const MAX_W = 560;
const MIN_SPACE_BELOW = 220;

/**
 * Below the anchor when there is room, otherwise above it (the newest audio sits
 * right above the reply editor). Hidden when the anchor scrolls out of `clip`.
 */
export function placePanel(anchor: Box, clip: Box, viewportHeight: number): Placement {
  const visible = anchor.bottom > clip.top && anchor.top < clip.bottom;
  const width = Math.min(MAX_W, Math.max(MIN_W, anchor.width));
  const left = Math.max(clip.left, Math.min(anchor.left, clip.right - width));
  const below = clip.bottom - anchor.bottom - GAP * 2;
  const above = anchor.top - clip.top - GAP * 2;
  if (below >= MIN_SPACE_BELOW || below >= above) {
    return {
      visible,
      left,
      width,
      top: anchor.bottom + GAP,
      bottom: null,
      maxHeight: Math.max(120, below),
    };
  }
  return {
    visible,
    left,
    width,
    top: null,
    bottom: viewportHeight - anchor.top + GAP,
    maxHeight: Math.max(120, above),
  };
}

/** Menu right-aligned under the ⋯ button, flipped above when it would leave `clip`. */
export function placeMenu(
  button: Box,
  clip: Box,
  menuHeight: number,
  viewportHeight: number,
): Placement {
  const visible = button.bottom > clip.top && button.top < clip.bottom;
  const width = 220;
  const left = Math.max(0, button.right - width);
  const fitsBelow = button.bottom + GAP + menuHeight <= Math.max(clip.bottom, viewportHeight - 8);
  return fitsBelow
    ? { visible, left, width, top: button.bottom + GAP, bottom: null, maxHeight: 400 }
    : {
        visible,
        left,
        width,
        top: null,
        bottom: viewportHeight - button.top + GAP,
        maxHeight: 400,
      };
}

export function toBox(r: DOMRect): Box {
  return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width };
}

export function applyPlacement(el: HTMLElement, p: Placement): void {
  el.style.display = p.visible ? '' : 'none';
  el.style.left = `${p.left}px`;
  el.style.width = `${p.width}px`;
  el.style.top = p.top === null ? '' : `${p.top}px`;
  el.style.bottom = p.bottom === null ? '' : `${p.bottom}px`;
  el.style.maxHeight = `${p.maxHeight}px`;
}
