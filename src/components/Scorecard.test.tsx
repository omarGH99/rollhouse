import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { Scorecard } from './Scorecard';
import { createEmptyScoreSheet } from '../logic/scoring';
import { seatAccent } from '../theme';
import { GameMode, Player, ScoreSheet } from '../types';

const humans = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Player ${i + 1}`, kind: 'human' as const }));

/** One single-column card per seat. */
const cards = (n: number, overrides: Partial<ScoreSheet>[] = []): ScoreSheet[][] =>
  Array.from({ length: n }, (_, i) => [
    { ...createEmptyScoreSheet(), ...(overrides[i] ?? {}) },
  ]);

/** One three-column card per seat, with `first` laid over seat 0's columns. */
const marathonCards = (n: number, first: Partial<ScoreSheet>[] = []): ScoreSheet[][] =>
  Array.from({ length: n }, (_, seat) =>
    [0, 1, 2].map((column) => ({
      ...createEmptyScoreSheet(),
      ...(seat === 0 ? (first[column] ?? {}) : {}),
    })),
  );

const setup = (props: Partial<React.ComponentProps<typeof Scorecard>> = {}) => {
  const players = props.players ?? humans(2);
  const mode: GameMode = props.mode ?? 'classic';
  return render(
    <Scorecard
      mode={mode}
      players={players}
      scores={
        props.scores ??
        (mode === 'marathon' ? marathonCards(players.length) : cards(players.length))
      }
      currentPlayer={0}
      accent={seatAccent(0)}
      previews={mode === 'marathon' ? [{}, {}, {}] : [{}]}
      previewNonce={0}
      selectable={false}
      lastScored={null}
      onSelect={jest.fn()}
      {...props}
    />,
  );
};

describe('seats', () => {
  it.each([1, 2, 3, 4])('renders a header for each of %i seats', (n) => {
    setup({ players: humans(n), scores: cards(n) });
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
    expect(screen.getByText(/^Rollhouse/)).toBeTruthy();
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
    setup({ scores: cards(2, [bonusSheet]) });
    // 63 subtotal, +35 bonus, so a grand total of 98.
    expect(screen.getByText('63')).toBeTruthy();
    expect(screen.getByText('35')).toBeTruthy();
    expect(screen.getByText('98')).toBeTruthy();
  });

  it('withholds the bonus one point short', () => {
    const shortSheet: Partial<ScoreSheet> = {
      ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 17,
    };
    setup({ scores: cards(2, [shortSheet]) });
    // 62 shows twice — as the upper subtotal and again as the grand total,
    // which is exactly the point: with no bonus the two must agree.
    expect(screen.getAllByText('62')).toHaveLength(2);
    expect(screen.queryByText('35')).toBeNull();
  });

  it('shows the extra-Rollhouse row only once one has been earned', () => {
    setup();
    expect(screen.queryByText('Rollhouse bonus')).toBeNull();
  });

  it('counts each extra Rollhouse for 100', () => {
    setup({ scores: cards(2, [{ rollhouse: 50, extraRollhouses: 2 }]) });
    expect(screen.getByText('Rollhouse bonus')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('250')).toBeTruthy();
  });
});

describe('quick game', () => {
  it('has an upper section and nothing else', () => {
    setup({ mode: 'quick' });
    expect(screen.getByText('UPPER')).toBeTruthy();
    expect(screen.getByText(/^Sixes/)).toBeTruthy();
    expect(screen.queryByText('LOWER')).toBeNull();
    expect(screen.queryByText(/^Chance/)).toBeNull();
    expect(screen.queryByText('Lower total')).toBeNull();
  });
});

describe('marathon', () => {
  it('heads the columns with what each is worth', () => {
    setup({ mode: 'marathon' });
    expect(screen.getByText('×1')).toBeTruthy();
    expect(screen.getByText('×2')).toBeTruthy();
    expect(screen.getByText('×3')).toBeTruthy();
  });

  it('multiplies each column and sums them for the player', () => {
    setup({
      mode: 'marathon',
      scores: marathonCards(2, [{ chance: 10 }, { chance: 10 }, { chance: 10 }]),
    });
    // Columns are worth 10, 20 and 30: 60 in all.
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByLabelText("Player 1's card, 60 points")).toBeTruthy();
  });

  it('swaps to another seat’s card on a tap, and back', () => {
    setup({ mode: 'marathon', scores: marathonCards(2, [{ chance: 10 }]) });
    expect(screen.getByText('SCORECARD')).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Player 2's card, 0 points"));
    expect(screen.getByText("PLAYER 2'S CARD")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Player 1's card, 10 points"));
    expect(screen.getByText('SCORECARD')).toBeTruthy();
  });

  it('has no seat strip when playing alone', () => {
    setup({ mode: 'marathon', players: humans(1), scores: marathonCards(1) });
    expect(screen.queryByLabelText(/'s card,/)).toBeNull();
    expect(screen.getByText('×3')).toBeTruthy();
    // With no strip to carry it, the card states the overall score itself.
    expect(screen.getByText('0 in all')).toBeTruthy();
  });
});
