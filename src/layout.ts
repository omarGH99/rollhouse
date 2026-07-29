import { spacing } from './theme';

/**
 * The board's one genuine design tension, in two numbers.
 *
 * Thirteen score rows plus dice, a roll button and totals do not fit a phone
 * screen at a comfortable finger size. Something has to give: either rows are
 * small and everything fits, or rows are properly tappable and the board
 * scrolls. These two values are the whole dial, and they move together —
 * raising the row height without lowering the scale floor just makes the
 * auto-fit shrink the taller rows straight back down.
 *
 * Apple asks for 44pt touch targets, Android for 48dp. `ROOMY` gets close;
 * `COMPACT` trades that away to keep the board on one screen.
 *
 *   COMPACT  ~30px rows, floor 0.72  → fits most phones, targets are small
 *   ROOMY    ~38px rows, floor 0.85  → scrolls on phones, comfortable to tap
 */
const DENSITY = {
  compact: { rowPadding: spacing(1.5), minScale: 0.72 },
  roomy: { rowPadding: spacing(2.5), minScale: 0.85 },
} as const;

/** Flip this one word to move the whole board between the two settings. */
const CHOICE: keyof typeof DENSITY = 'compact';

/** Vertical padding on each score row, above and below the text. */
export const SCORE_ROW_PADDING = DENSITY[CHOICE].rowPadding;

/**
 * How far the board may be scaled down to fit before it gives up and scrolls
 * instead. Scaling applies to the whole board including its controls, so this
 * is effectively a floor on touch target size as well.
 */
export const MIN_BOARD_SCALE = DENSITY[CHOICE].minScale;
