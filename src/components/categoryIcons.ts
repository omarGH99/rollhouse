import type React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { Category } from '../types';

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** One matching neon glyph per category. */
export const CATEGORY_ICONS: Record<Category, IoniconName> = {
  ones: 'ellipse-outline',
  twos: 'swap-horizontal-outline',
  threes: 'triangle-outline',
  fours: 'square-outline',
  fives: 'star-outline',
  sixes: 'grid-outline',
  threeOfAKind: 'layers-outline',
  fourOfAKind: 'albums-outline',
  fullHouse: 'home-outline',
  smallStraight: 'trending-up-outline',
  largeStraight: 'analytics-outline',
  yahtzee: 'flame-outline',
  chance: 'shuffle-outline',
};
