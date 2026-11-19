import { themeFromColor } from '@/entrypoints/content/ui/theme';

describe('themeFromColor', () => {
  it.each([
    ['rgb(255, 255, 255)', 'light'],
    ['rgb(236, 249, 249)', 'light'],
    ['rgb(24, 28, 31)', 'dark'],
    ['rgba(24, 28, 31, 1)', 'dark'],
    ['rgba(0, 0, 0, 0)', 'light'],
    ['transparent', 'light'],
  ])('%s → %s', (color, theme) => {
    expect(themeFromColor(color)).toBe(theme);
  });
});
