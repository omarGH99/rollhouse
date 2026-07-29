import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { Scorecard } from './Scorecard';
import { createEmptyScoreSheet } from '../logic/scoring';
import { seatAccent } from '../theme';
import { Player, ScoreSheet } from '../types';

const humans = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Player ${i + 1}`, kind: 'human' as const }));

const sheets = (n: number, overrides: Partial<ScoreSheet>[] = []): ScoreSheet[] =>
  Array.from({ length: n }, (_, i) => ({
    ...createEmptyScoreSheet(),
    ...(overrides[i] ?? {}),
  }));

const setup = (props: Partial<React.ComponentProps<typeof Scorecard>> = {}) => {
  const players = props.players ?? humans(2);
  return render(
    <Scorecard
      players={players}
      scores={props.scores ?? sheets(players.length)}
      currentPlayer={0}
      accent={seatAccent(0)}
      previews={{}}
      previewNonce={0}
      selectable={false}
      lastScoredCategory={null}
      onSelect={jest.fn()}
      {...props}
    />,
  );
};

describe('seats', () => {
  it.each([2, 3, 4])('renders a header for each of %i seats', (n) => {
    setup({ players: humans(n), scores: sheets(n) });
    for (let i = 1; i <= n; i += 1) {
      expect(screen.getByText(`P${i}`)).toBeTruthy();
    }
  });

  it('marks AI seats with B rather than P', () => {
    setup({
      players: [
        { name: 'You', kind: 'human' },
        { name: 'Bot', kind: 'ai' },
      ],
    });
    expect(screen.getByText('P1')).toBeTruthy();
    expect(screen.getByText('B2')).toBeTruthy();
  });
});

describe('structure', () => {
  it('renders every category row', () => {
    setup();
    expect(screen.getByText(/^Ones/)).toBeTruthy();
    expect(screen.getByText(/^Sixes/)).toBeTruthy();
    expect(screen.getByText(/^QOMAR/)).toBeTruthy();
    expect(screen.getByText(/^Chance/)).toBeTruthy();
  });

  it('renders both section headers and the summary rows', () => {
    setup();
    expect(screen.getByText('UPPER')).toBeTruthy();
    expect(screen.getByText('LOWER')).toBeTruthy();
    expect(screen.getByText('Subtotal')).toBeTruthy();
    expect(screen.getByText('Bonus')).toBeTruthy();
    expect(screen.getByText('TOTAL')).toBeTruthy();
  });
});

describe('totals', () => {
  it('adds the upper bonus once the threshold is reached', () => {
    const bonusSheet: Partial<ScoreSheet> = {
      ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18,
    };
    setup({ scores: sheets(2, [bonusSheet]) });
    // 63 subtotal, +35 bonus, so a grand total of 98.
    expect(screen.getByText('63')).toBeTruthy();
    expect(screen.getByText('35')).toBeTruthy();
    expect(screen.getByText('98')).toBeTruthy();
  });

  it('withholds the bonus one point short', () => {
    const shortSheet: Partial<ScoreSheet> = {
      ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 17,
    };
    setup({ scores: sheets(2, [shortSheet]) });
    // 62 shows twice — as the upper subtotal and again as the grand total,
    // which is exactly the point: with no bonus the two must agree.
    expect(screen.getAllByText('62')).toHaveLength(2);
    expect(screen.queryByText('35')).toBeNull();
  });
});
