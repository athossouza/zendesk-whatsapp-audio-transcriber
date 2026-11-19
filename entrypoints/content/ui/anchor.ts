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
const MIN_W = 300;
/** ~62 characters per line at 14 px plus padding: 50–75 is the readable range (Baymard). */
const MAX_W = 480;
/** Smallest box that still reads well (about 6 lines plus header and footer). */
const COMFORT_HEIGHT = 200;

/**
 * Where the transcription box goes, in order of preference:
 * 1. below the player, inside the conversation, if there is comfortable room;
 * 2. above it, inside the conversation (the newest audio sits right above the editor);
 * 3. otherwise below it, allowed to cover the reply editor while open (small
 *    laptop screens: the editor takes half the height and neither side fits).
 * Hidden when the player scrolls out of the conversation (`clip`).
 */
export function placePanel(anchor: Box, clip: Box, viewportHeight: number): Placement {
  const visible = anchor.bottom > clip.top && anchor.top < clip.bottom;
  const width = Math.min(MAX_W, Math.max(MIN_W, anchor.width));
  const left = Math.max(clip.left, Math.min(anchor.left, clip.right - width));
  const below = clip.bottom - anchor.bottom - GAP * 2;
  const above = anchor.top - clip.top - GAP * 2;
  const belowPage = viewportHeight - anchor.bottom - GAP * 4;

  const placeBelow = (room: number): Placement => ({
    visible,
    left,
    width,
    top: anchor.bottom + GAP,
    bottom: null,
    maxHeight: Math.max(120, room),
  });

  if (below >= COMFORT_HEIGHT) return placeBelow(below);
  if (above >= COMFORT_HEIGHT) {
    return {
      visible,
      left,
      width,
      top: null,
      bottom: viewportHeight - anchor.top + GAP,
      maxHeight: above,
    };
  }
  return placeBelow(Math.max(below, belowPage));
}

/** Menu right-aligned under the ⋯ button, flipped above when it would leave `clip`. */
export function placeMenu(
  button: Box,
  clip: Box,
  menuHeight: number,
  viewportHeight: number,
): Placement {
  const visible = button.bottom > clip.top && button.top < clip.bottom;
  const width = 248;
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
  // Floating UI starts hidden (CSS) and shows only once placed: no flash in the corner.
  el.style.visibility = 'visible';
  el.style.left = `${p.left}px`;
  el.style.width = `${p.width}px`;
  el.style.top = p.top === null ? '' : `${p.top}px`;
  el.style.bottom = p.bottom === null ? '' : `${p.bottom}px`;
  el.style.maxHeight = `${p.maxHeight}px`;
}
