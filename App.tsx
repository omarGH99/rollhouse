import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  CinzelDecorative_700Bold,
  useFonts,
} from '@expo-google-fonts/cinzel-decorative';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { FeltBackdrop } from './src/components/FeltBackdrop';
import { RulesScreen } from './src/components/RulesScreen';
import { SettingsScreen } from './src/components/SettingsScreen';
import { SetupScreen } from './src/components/SetupScreen';
import { StatsScreen } from './src/components/StatsScreen';
import { useRollhouseGame } from './src/hooks/useRollhouseGame';
import { useSettings } from './src/hooks/useSettings';
import { SHAKE_SUPPORTED } from './src/hooks/useShake';
import { MODES, roundsFor } from './src/logic/modes';
import { GameScreen } from './src/screens/GameScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { accents, palette } from './src/theme';
import { GameMode, Player } from './src/types';

type Sheet = 'rules' | 'scores' | 'setup' | 'settings' | null;

const Root: React.FC = () => {
  // Every session opens on the menu, whether or not there is a game to resume.
  const [playing, setPlaying] = useState(false);
  const { settings, update } = useSettings();
  const game = useRollhouseGame(playing, settings.fastBots);
  const { state, ready, inProgress, stats, highScores, newGame, resetStats } = game;
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  const startGame = (players: Player[], mode: GameMode) => {
    close();
    newGame(players, mode);
    setPlaying(true);
  };

  // Until the saved game has been read back, show the bare table. Rendering a
  // screen first would flash a default game for a frame before the restored
  // one replaces it.
  if (!ready) {
    return (
      <View style={styles.root}>
        <FeltBackdrop accent={accents[0]} />
      </View>
    );
  }

  const resume = inProgress
    ? `${MODES[state.mode].label} · round ${state.round} of ${roundsFor(state.mode)} · ${state.players
        .map((p) => p.name)
        .join(', ')}`
    : null;

  return (
    <View style={styles.root}>
      {playing ? (
        <GameScreen
          game={game}
          settings={settings}
          paused={sheet !== null}
          onOpenMenu={() => setPlaying(false)}
          onOpenRules={() => setSheet('rules')}
        />
      ) : (
        <MenuScreen
          resume={resume}
          onContinue={() => setPlaying(true)}
          onNewGame={() => setSheet('setup')}
          onScores={() => setSheet('scores')}
          onRules={() => setSheet('rules')}
          onSettings={() => setSheet('settings')}
        />
      )}

      <StatsScreen
        visible={sheet === 'scores'}
        stats={stats}
        highScores={highScores}
        initialMode={state.mode}
        onClose={close}
        onReset={resetStats}
      />

      <RulesScreen visible={sheet === 'rules'} onClose={close} />

      <SettingsScreen
        visible={sheet === 'settings'}
        settings={settings}
        shakeSupported={SHAKE_SUPPORTED}
        onChange={update}
        onClose={close}
      />

      <SetupScreen
        visible={sheet === 'setup'}
        initialPlayers={state.players}
        initialMode={state.mode}
        replacing={inProgress}
        onCancel={close}
        onStart={startGame}
      />

      <StatusBar style="light" />
    </View>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({ CinzelDecorative_700Bold });

  // Hold on the splash rather than flashing a fallback face in the title.
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
});
