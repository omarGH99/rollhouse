import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { clearGame } from '../storage';
import { accents, fonts, palette, radius, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  /** Bumped on recovery so the subtree remounts from scratch. */
  attempt: number;
}

/**
 * Last line of defence. Without this a single render throw leaves a blank
 * screen with no way out — which matters more here than in most apps, because
 * a saved game is restored on launch: if some state could crash the board, the
 * player would be stuck in a loop of relaunching into the same crash.
 *
 * "Start a fresh game" therefore clears the save as well as remounting, so
 * recovery cannot land back on the same bad state. Stats are deliberately left
 * alone — losing a game in progress is acceptable, losing a record is not.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // No crash reporter wired up yet; the console is the only sink we have.
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private recover = (discardSave: boolean) => {
    if (discardSave) void clearGame();
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  render() {
    const { error, attempt } = this.state;
    if (!error) {
      return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
    }

    return (
      <View style={styles.root}>
        <View style={styles.iconRing}>
          <Ionicons name="alert" size={28} color={accents[1].main} />
        </View>

        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The board hit an error and stopped. You can try picking up where you
          left off, or start over with a clean slate.
        </Text>

        <Text numberOfLines={3} style={styles.detail}>
          {error.message || String(error)}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={() => this.recover(false)}
          style={[styles.button, styles.buttonPrimary]}
        >
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>TRY AGAIN</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard the saved game and start fresh"
          onPress={() => this.recover(true)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>START A FRESH GAME</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(8),
    backgroundColor: palette.bg,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: accents[1].soft,
    marginBottom: spacing(5),
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '600',
    color: palette.textLight,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 21,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing(3),
  },
  detail: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: palette.textFaint,
    textAlign: 'center',
    marginTop: spacing(4),
  },
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing(3.5),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.hairline,
    marginTop: spacing(3),
  },
  buttonPrimary: {
    borderColor: accents[0].main,
    backgroundColor: accents[0].soft,
    marginTop: spacing(7),
  },
  buttonText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: palette.textMuted,
  },
  buttonTextPrimary: {
    color: accents[0].main,
  },
});
