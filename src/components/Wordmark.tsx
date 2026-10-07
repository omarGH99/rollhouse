import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, textGlow } from '../theme';

/**
 * The game's title lockup: engraved capitals with a brass rule and a pip on
 * either side, so the header reads as a table plaque rather than a page title.
 */
export const Wordmark: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <View style={styles.root}>
    <Text
      numberOfLines={1}
      style={[styles.title, compact && styles.titleCompact, textGlow(palette.brass, 10)]}
    >
      ROLLHOUSE
    </Text>
    <View style={styles.ruleRow}>
      <View style={styles.rule} />
      <View style={styles.pip} />
      <View style={styles.rule} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.wordmark,
    fontSize: 20,
    color: palette.brassBright,
    // Cinzel is an all-caps Roman face; generous tracking is what makes it
    // read as engraved rather than merely large.
    letterSpacing: 2.5,
  },
  titleCompact: {
    fontSize: 17,
    letterSpacing: 1.5,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
    paddingRight: 6,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: palette.railTrim,
  },
  pip: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.brass,
  },
});
