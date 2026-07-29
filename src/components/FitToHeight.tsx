import React, { forwardRef, useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { MIN_BOARD_SCALE } from '../layout';

/**
 * Below this, shrinking does more harm than scrolling. Paired with the row
 * height in layout.ts: scaling applies to the whole board including its
 * controls, so this is a floor on touch target size too.
 */
export const MIN_SCALE = MIN_BOARD_SCALE;

/** Slack in px, absorbing fractional layout heights. */
const FIT_EPSILON = 2;

interface Props {
  children: React.ReactNode;
  /** Set false to make the board inert behind a full-screen curtain. */
  scrollEnabled?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Reports the chosen scale, for diagnostics. */
  onScaleChange?: (scale: number, fits: boolean) => void;
}

/**
 * Scales its children down just enough to fit the available height.
 *
 * The measurement is honest rather than estimated: React Native's `onLayout`
 * reports the *pre-transform* layout box, so the natural height we read back
 * never changes as a result of the scale we apply. That removes the
 * measure → resize → re-measure feedback loop this kind of component usually
 * suffers from, and means the fit is exact for any content.
 *
 * Two details that are easy to get wrong:
 *  - A transform does not shrink the layout box, so the scaled child still
 *    reserves its full natural height. The negative bottom margin reclaims it,
 *    otherwise every screen gains a band of dead space.
 *  - Scaling past a point is worse than scrolling, so below `MIN_SCALE` the
 *    content is clamped and scrolling is re-enabled instead.
 */
export const FitToHeight = forwardRef<ScrollView, Props>(
  ({ children, scrollEnabled = true, contentStyle, onScaleChange }, ref) => {
    const [available, setAvailable] = useState(0);
    const [natural, setNatural] = useState(0);

    const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
      setAvailable(e.nativeEvent.layout.height);
    }, []);

    const onContentLayout = useCallback((e: LayoutChangeEvent) => {
      // Pre-transform height, so this is stable across scale changes.
      setNatural(e.nativeEvent.layout.height);
    }, []);

    const measured = available > 0 && natural > 0;
    // Give back a couple of pixels: fractional layout heights and the rounded
    // negative margin below otherwise leave a few px of pointless scroll.
    const required = measured ? (available - FIT_EPSILON) / natural : 1;
    const scale = Math.min(1, Math.max(required, MIN_SCALE));
    // True once even the clamped scale cannot fit the content.
    const overflows = measured && required < MIN_SCALE;

    React.useEffect(() => {
      if (measured) onScaleChange?.(scale, !overflows);
    }, [measured, scale, overflows, onScaleChange]);

    return (
      <ScrollView
        ref={ref}
        testID="fit-scroller"
        onLayout={onContainerLayout}
        scrollEnabled={scrollEnabled && overflows}
        showsVerticalScrollIndicator={false}
      >
        <View
          testID="fit-content"
          onLayout={onContentLayout}
          style={[
            styles.content,
            // Padding belongs *inside* the measured box. On the scroll
            // container it would sit outside the transform, so it would be
            // neither scaled nor counted — and the content would overflow by
            // exactly the padding amount.
            contentStyle,
            {
              transform: [{ scale }],
              // Reclaim the space the transform visually gave back.
              marginBottom: -natural * (1 - scale),
            },
          ]}
        >
          {children}
        </View>
      </ScrollView>
    );
  },
);

FitToHeight.displayName = 'FitToHeight';

const styles = StyleSheet.create({
  content: {
    // Scale toward the top so the header stays pinned as content shrinks.
    transformOrigin: 'top center',
  },
});
