import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { palette, radius, shadow } from '../theme';

interface Props extends ViewProps {
  /** Blur strength, 0-100. */
  intensity?: number;
  /** Optional accent tint washed over the fill. */
  tint?: string;
  borderColor?: string;
  cornerRadius?: number;
  /** Lift off the table. Pass 0 for panels that should sit flush. */
  elevation?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * A raised card on the felt: deep green fill, brass pinstripe, real drop
 * shadow. Rounded corners + `overflow: hidden` so the blur is clipped to the
 * card shape on both platforms.
 */
export const FeltPanel: React.FC<Props> = ({
  intensity = 18,
  tint,
  borderColor = palette.hairline,
  cornerRadius = radius.lg,
  elevation = 8,
  style,
  children,
  ...rest
}) => (
  <View
    style={[
      styles.wrapper,
      { borderRadius: cornerRadius, borderColor },
      elevation > 0 ? shadow(elevation) : null,
      style,
    ]}
    {...rest}
  >
    <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, styles.fill]} />
    {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  fill: {
    backgroundColor: palette.feltRaised,
    opacity: 0.92,
  },
});
