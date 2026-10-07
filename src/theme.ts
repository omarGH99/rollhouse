import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * "Casino Luxe" design tokens — deep emerald felt, brass hardware, ivory dice.
 * Everything visual in the app pulls from here so the palette can be re-skinned
 * in one place.
 *
 * The governing idea is *material*, not light: surfaces are felt and metal, so
 * depth comes from real drop shadows (`shadow`) rather than emissive glow.
 * `textGlow` still exists for the few places a warm brass halo earns its keep.
 */

export const palette = {
  /** Deepest tone — the room around the table. */
  bg: '#1A0A0D',
  /** The baize playing surface. */
  felt: '#0A2A17',
  feltRaised: '#113522',

  /** The padded oxblood rail running round the edge of the table. */
  rail: '#6E1F24',
  railDark: '#4A1319',
  railHighlight: '#8E2E33',
  /** Brass tack line where the rail meets the baize. */
  railTrim: 'rgba(201, 162, 39, 0.35)',

  /**
   * The scorecard is printed card stock, not another felt panel: a light
   * surface with dark ink, so the numbers stay readable at a glance.
   */
  card: '#FFFFFF',
  cardRow: '#F2F4F0',
  cardInk: '#16241C',
  cardInkMuted: '#55655B',
  cardHairline: 'rgba(22, 36, 28, 0.14)',
  /** Ruled line between scorecard rows, like a printed ledger. */
  cardRule: 'rgba(22, 36, 28, 0.18)',

  /**
   * Availability, from the active player's point of view: green where a box is
   * still open to them, red where it is spent. Both clear 6:1 on the ivory
   * card. Colour is never the only signal — an open box also shows a preview
   * number, and a spent one shows its score.
   */
  cardOpen: '#146B32',
  cardClosed: '#A32C22',

  /** Warm translucent fills layered over the felt. */
  panel: 'rgba(255, 248, 230, 0.035)',
  panelStrong: 'rgba(255, 248, 230, 0.075)',
  /** Brass pinstripe — the primary divider. */
  hairline: 'rgba(201, 162, 39, 0.18)',
  /** Neutral divider for places brass would be too loud. */
  hairlineSoft: 'rgba(244, 237, 221, 0.08)',

  /**
   * Body text. `textLight` and `textMuted` are the two legibility-first tokens
   * and should carry all prose: both clear 7:1 and 4.5:1 against the felt.
   * `textFaint` is decorative only — never use it for anything a player must
   * read, which is what it was wrongly doing for hints and subtitles.
   */
  textLight: '#F7F3E8',
  textMuted: '#B7CABC',

  /** Retained aliases so older call sites keep compiling. */
  text: '#F7F3E8',
  textDim: '#B7CABC',
  textFaint: '#7B9184',

  /** Real dice: bone-white with near-black pips. */
  dieFace: '#F2EAD8',
  dieFaceHeld: '#FFF9EA',
  diePip: '#16241C',
  dieEdge: 'rgba(10, 21, 16, 0.35)',

  brass: '#C9A227',
  brassBright: '#E8C765',
  danger: '#C25B4E',
} as const;

export type Accent = {
  /** Full-strength metal, for use on the dark felt. */
  main: string;
  /**
   * Darkened counterpart for use on the ivory scorecard. The felt colours are
   * tuned for a dark ground and fall to ~1.7:1 on ivory — legible seat colour
   * on a light card needs its own value, not an opacity tweak.
   */
  ink: string;
  /** ~50% — secondary text, icons. */
  dim: string;
  /** Tint fill for panels/pills. */
  soft: string;
  /** Barely-there wash for large surfaces. */
  wash: string;
};

/**
 * Seat colours are kept as plain 6-digit hex so callers can append an alpha
 * pair directly — `${seatAccent(i).main}22` — which is the idiom used for
 * translucent score-cell tints.
 */
const fromHex = (main: string, ink: string): Accent => ({
  main,
  ink,
  dim: `${main}8C`, // 55%
  soft: `${main}26`, // 15%
  wash: `${main}0F`, // 6%
});

/**
 * Seats are metals rather than neons, ordered so any prefix of the list stays
 * mutually distinguishable: a two-player game gets the two furthest apart in
 * hue, and each added seat slots into a gap rather than crowding a neighbour.
 */
/**
 * Felt colour first, then the card `ink`. The ink values deliberately avoid the
 * green/red availability pair: on the scorecard those two colours mean "open"
 * and "spent", so a seat tint close to either would make identity and status
 * ambiguous. That rules out a red-copper or a green-verdigris ink.
 */
export const accents: Accent[] = [
  fromHex('#E3B341', '#8A6510'), // gold      → dark brass
  fromHex('#D2724A', '#7A4A1E'), // copper    → umber
  fromHex('#7CBAA0', '#1F5A6B'), // verdigris → deep teal
  fromHex('#A694D6', '#57389B'), // amethyst  → deep violet
];

/** Seat colour, safe for any index. */
export const seatAccent = (seat: number): Accent => accents[seat % accents.length];


/** Opacity applied to seats that are not on turn. */
export const INACTIVE_SEAT_OPACITY = 0.4;

/**
 * A serif display face carries the "luxe" read; the body stays a clean sans so
 * dense scorecard rows remain legible. Swap `display` for a bundled face like
 * `@expo-google-fonts/playfair-display` if you want it exact — nothing else in
 * the app needs to change.
 */
export const fonts = {
  /**
   * Title lockup only. Bundled rather than platform-selected so the game's name
   * looks identical everywhere; loaded by `useAppFonts` before first render.
   */
  wordmark: 'CinzelDecorative_700Bold',
  display: Platform.select({
    ios: 'Baskerville',
    android: 'serif',
    default: 'Georgia, "Times New Roman", serif',
  }) as string,
  body: Platform.select({
    ios: 'Avenir Next',
    android: 'sans-serif-medium',
    default: 'System',
  }) as string,
  /** Score cells; fixed-width columns handle alignment, so no monospace needed. */
  numeric: Platform.select({
    ios: 'Avenir Next',
    android: 'sans-serif-medium',
    default: 'System',
  }) as string,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const spacing = (n: number) => n * 4;

/**
 * Material depth: a real drop shadow, as a felt table would cast. This is the
 * default way to lift a surface — prefer it over `viewGlow`.
 */
export const shadow = (elevation = 6): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#040B07',
      shadowOffset: { width: 0, height: Math.round(elevation / 2) },
      shadowOpacity: 0.5,
      shadowRadius: elevation,
    },
    default: { elevation },
  })!;

/** Warm halo on brass text. Kept subtle — this is candlelight, not neon. */
export const textGlow = (color: string, radius = 8): TextStyle => ({
  textShadowColor: color,
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: radius,
});

/**
 * Coloured glow. Reserved for the few genuinely emissive moments (a winning
 * total, the active CTA); iOS gets a true tinted shadow, Android falls back to
 * elevation, which can't be tinted.
 */
export const viewGlow = (color: string, radius = 12, opacity = 0.6): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    default: {
      elevation: Math.round(radius / 2),
      shadowColor: color,
    },
  })!;
