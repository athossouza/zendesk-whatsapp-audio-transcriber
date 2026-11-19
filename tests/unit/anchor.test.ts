import {
  clampRect,
  clampSize,
  placeMenu,
  placePanel,
  type Box,
} from '@/entrypoints/content/ui/anchor';

const box = (top: number, bottom: number, left = 100, width = 300): Box => ({
  top,
  bottom,
  left,
  right: left + width,
  width,
});
const clip = box(100, 700, 0, 800);

describe('placePanel', () => {
  it('goes below the player when there is room', () => {
    const p = placePanel(box(200, 260), clip, 900);
    expect(p).toMatchObject({ visible: true, top: 264, bottom: null, left: 100, width: 300 });
    expect(p.maxHeight).toBe(700 - 260 - 8);
  });

  it('goes above the newest audio sitting right above the editor', () => {
    const p = placePanel(box(600, 660), clip, 900);
    expect(p).toMatchObject({ top: null, bottom: 900 - 600 + 4 });
    expect(p.maxHeight).toBe(600 - 100 - 8);
  });

  it('covers the reply editor when neither side of a short conversation fits', () => {
    // Laptop: conversation 200–520 px, editor below it; audio at 360–435.
    const short = box(200, 520, 0, 800);
    const p = placePanel(box(360, 435), short, 770);
    expect(p).toMatchObject({ top: 439, bottom: null });
    expect(p.maxHeight).toBe(770 - 435 - 16);
  });

  it('hides when the player scrolls out of the conversation', () => {
    expect(placePanel(box(20, 80), clip, 900).visible).toBe(false);
    expect(placePanel(box(720, 780), clip, 900).visible).toBe(false);
  });

  it('keeps width between 300 and 480 px (readable line length) and inside the conversation', () => {
    expect(placePanel(box(200, 260, 100, 100), clip, 900).width).toBe(300);
    expect(placePanel(box(200, 260, 0, 900), clip, 900).width).toBe(480);
    expect(placePanel(box(200, 260, 700, 300), clip, 900).left).toBe(800 - 300);
  });
});

describe('placeMenu', () => {
  it('right-aligns under the button and flips up near the bottom', () => {
    expect(placeMenu(box(200, 224, 500, 24), clip, 100, 900)).toMatchObject({
      top: 228,
      left: 524 - 248,
    });
    expect(placeMenu(box(860, 884, 500, 24), clip, 100, 900)).toMatchObject({
      top: null,
      bottom: 900 - 860 + 4,
    });
  });
});

describe('manual move and resize', () => {
  it('keeps size within 300–600 px wide and 120 px to the window height', () => {
    expect(clampSize(100, 50, 1400, 800)).toEqual({ width: 300, height: 120 });
    expect(clampSize(900, 2000, 1400, 800)).toEqual({ width: 600, height: 784 });
    expect(clampSize(450, null, 1400, 800)).toEqual({ width: 450, height: null });
    // Narrow window: never wider than the window.
    expect(clampSize(600, null, 500, 800).width).toBe(484);
  });

  it('keeps a dragged box reachable inside the window', () => {
    const r = { left: -200, top: -50, width: 480, height: 300 };
    expect(clampRect(r, 1400, 800)).toEqual({ left: 8, top: 8, width: 480, height: 300 });
    const far = { left: 5000, top: 5000, width: 480, height: null };
    expect(clampRect(far, 1400, 800)).toEqual({
      left: 1400 - 480 - 8,
      top: 800 - 120 - 8,
      width: 480,
      height: null,
    });
  });
});
