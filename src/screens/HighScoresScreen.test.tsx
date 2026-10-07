import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { HighScoresScreen } from './HighScoresScreen';
import { HighScores, ScoreEntry, emptyHighScores } from '../logic/highScores';
import { emptyStats } from '../logic/stats';

const entry = (name: string, score: number, extra: Partial<ScoreEntry> = {}): ScoreEntry => ({
  name,
  score,
  // Noon, so the day is the same in whatever timezone the test runs.
  date: new Date(2026, 9, 7, 12).getTime(),
  opponents: 1,
  hinted: false,
  ...extra,
});

const setup = (
  highScores: HighScores = emptyHighScores(),
  props: Partial<React.ComponentProps<typeof HighScoresScreen>> = {},
) =>
  render(
    <HighScoresScreen
      visible
      stats={emptyStats()}
      highScores={highScores}
      initialMode="classic"
      onClose={jest.fn()}
      onReset={jest.fn()}
      {...props}
    />,
  );

describe('high scores', () => {
  it('says so when a game type has no scores yet', () => {
    setup();
    expect(screen.getByText(/No Classic game finished yet/)).toBeTruthy();
  });

  it('lists a table in order, with who and when', () => {
    setup({
      ...emptyHighScores(),
      classic: [entry('Omar', 281), entry('Sara', 240, { opponents: 0 })],
    });
    expect(screen.getByText('Omar')).toBeTruthy();
    expect(screen.getByText('281')).toBeTruthy();
    expect(screen.getByText('7 Oct · table of 2')).toBeTruthy();
    expect(screen.getByText('7 Oct · solo')).toBeTruthy();
  });

  it('marks a score that was played with hints', () => {
    setup({ ...emptyHighScores(), classic: [entry('Omar', 281, { hinted: true })] });
    expect(screen.getByText(/with hints$/)).toBeTruthy();
  });

  it('opens on the game type it is given', () => {
    setup({ ...emptyHighScores(), quick: [entry('Omar', 71)] }, { initialMode: 'quick' });
    expect(screen.getByText('71')).toBeTruthy();
  });

  it('switches table on a tab', () => {
    setup({
      ...emptyHighScores(),
      classic: [entry('Omar', 281)],
      marathon: [entry('Sara', 1502)],
    });
    expect(screen.queryByText('1502')).toBeNull();
    fireEvent.press(screen.getByLabelText('Marathon scores'));
    expect(screen.getByText('1502')).toBeTruthy();
    expect(screen.queryByText('281')).toBeNull();
  });

  it('asks twice before erasing', () => {
    const onReset = jest.fn();
    setup(emptyHighScores(), { onReset });
    fireEvent.press(screen.getByLabelText('Clear scores and record'));
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Confirm clearing scores and record'));
    expect(onReset).toHaveBeenCalled();
  });
});
