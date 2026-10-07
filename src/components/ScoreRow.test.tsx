import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ColumnView, ScoreRow } from './ScoreRow';
import { createEmptyScoreSheet } from '../logic/scoring';
import { palette, seatAccent } from '../theme';
import { ScoreSheet } from '../types';

/** One column per seat, as in a single-column game: seat 0 is on turn. */
const seats = (overrides: Partial<ScoreSheet>[] = [], count = 2): ColumnView[] =>
  Array.from({ length: count }, (_, i) => ({
    key: `s${i}`,
    sheet: { ...createEmptyScoreSheet(), ...(overrides[i] ?? {}) },
    accent: seatAccent(i),
    active: i === 0,
    column: 0,
    name: `Player ${i + 1}`,
  }));

/** One seat's three columns, as in Marathon: all of them are on turn. */
const stacked = (overrides: Partial<ScoreSheet>[] = []): ColumnView[] =>
  [0, 1, 2].map((column) => ({
    key: `c${column}`,
    sheet: { ...createEmptyScoreSheet(), ...(overrides[column] ?? {}) },
    accent: seatAccent(0),
    active: true,
    column,
    name: `times ${column + 1}`,
  }));

const setup = (props: Partial<React.ComponentProps<typeof ScoreRow>> = {}) =>
  render(
    <ScoreRow
      category="chance"
      columns={seats()}
      accent={seatAccent(0)}
      previews={[{}]}
      previewNonce={0}
      rolled={false}
      live={false}
      justScored={false}
      onSelect={jest.fn()}
      {...props}
    />,
  );

/** Dice are out and the board is taking a score. */
const inPlay = { rolled: true, live: true };

/**
 * Flattened style of the row's label. The hint is a nested `Text`, so the
 * library reports the outer node's content as "Chance   Sum of all dice" —
 * hence the prefix match rather than an exact one.
 */
const labelStyle = (label = /^Chance/) => {
  const node = screen.getByText(label);
  return Array.isArray(node.props.style)
    ? Object.assign({}, ...node.props.style.flat(Infinity).filter(Boolean))
    : node.props.style;
};

describe('rendering', () => {
  it('shows the category label and its hint on one line', () => {
    setup();
    // Label and hint share a single Text node, which is what keeps each row
    // to one line and the whole board on one screen.
    expect(screen.getByText('Chance   Sum of all dice')).toBeTruthy();
  });

  it('renders one cell per column', () => {
    setup();
    // Two open columns, so two placeholder dashes.
    expect(screen.getAllByText('–')).toHaveLength(2);
  });

  it('renders a cell for every seat in a four-player game', () => {
    setup({ columns: seats([], 4) });
    expect(screen.getAllByText('–')).toHaveLength(4);
  });

  it('shows a recorded score instead of a dash', () => {
    setup({ columns: seats([{ chance: 21 }]) });
    expect(screen.getByText('21')).toBeTruthy();
    expect(screen.getAllByText('–')).toHaveLength(1);
  });

  it('shows the prospective score when the box is open and dice are live', () => {
    setup({ ...inPlay, previews: [{ chance: 17 }] });
    expect(screen.getByText('17')).toBeTruthy();
  });

  it('shows no preview in a column that is not on turn', () => {
    const columns = seats().map((view) => ({ ...view, active: false }));
    setup({ ...inPlay, columns, previews: [{ chance: 17 }] });
    expect(screen.queryByText('17')).toBeNull();
  });

  it('labels the five-alike box with the game’s own name', () => {
    setup({ category: 'rollhouse' });
    expect(screen.getByText(/^Rollhouse/)).toBeTruthy();
  });
});

describe('availability colouring', () => {
  it('is plain ink before the player has rolled', () => {
    setup({ rolled: false });
    expect(labelStyle().color).toBe(palette.cardInk);
  });

  it('turns green once rolled while the box is open', () => {
    setup({ rolled: true });
    expect(labelStyle().color).toBe(palette.cardOpen);
  });

  it('turns red once rolled when the box is spent', () => {
    setup({ rolled: true, columns: seats([{ chance: 12 }]) });
    expect(labelStyle().color).toBe(palette.cardClosed);
  });

  it('stays green while any of the player’s own columns is open', () => {
    setup({ rolled: true, columns: stacked([{ chance: 12 }, { chance: 9 }]) });
    expect(labelStyle().color).toBe(palette.cardOpen);
  });
});

describe('non-colour cues', () => {
  it('strikes through a spent box so the cue survives colour blindness', () => {
    setup({ columns: seats([{ chance: 12 }]) });
    expect(labelStyle().textDecorationLine).toBe('line-through');
  });

  it('leaves an open box unstruck', () => {
    setup();
    expect(labelStyle().textDecorationLine).toBeUndefined();
  });
});

describe('interaction', () => {
  it('reports the category and column when tapped while it can score', () => {
    const onSelect = jest.fn();
    setup({ ...inPlay, previews: [{ chance: 17 }], onSelect });
    fireEvent.press(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('chance', 0);
  });

  it('does not fire when the board is not taking a score', () => {
    const onSelect = jest.fn();
    setup({ live: false, previews: [{ chance: 17 }], onSelect });
    fireEvent.press(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not fire for a box the rules do not allow', () => {
    // Open, but with no preview: a Joker has ruled this box out.
    const onSelect = jest.fn();
    setup({ ...inPlay, previews: [{}], onSelect });
    fireEvent.press(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks itself disabled for assistive tech when it cannot score', () => {
    setup();
    expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('announces the prospective score in its label', () => {
    setup({ ...inPlay, previews: [{ chance: 24 }] });
    expect(screen.getByLabelText('Chance, worth 24 points')).toBeTruthy();
  });
});

describe('several columns on turn', () => {
  const previews = [{ chance: 20 }, { chance: 20 }, { chance: 20 }];

  it('offers each open column as its own target', () => {
    const onSelect = jest.fn();
    setup({ ...inPlay, columns: stacked(), previews, onSelect });
    fireEvent.press(screen.getByLabelText('Chance times 3, worth 20 points'));
    expect(onSelect).toHaveBeenCalledWith('chance', 2);
  });

  it('does not offer a column where the box is already filled', () => {
    setup({ ...inPlay, columns: stacked([{}, { chance: 11 }]), previews });
    expect(screen.queryByLabelText(/^Chance times 2/)).toBeNull();
    expect(screen.getByLabelText('Chance times 1, worth 20 points')).toBeTruthy();
  });

  it('makes the whole row the target again once one column remains', () => {
    const onSelect = jest.fn();
    setup({
      ...inPlay,
      columns: stacked([{ chance: 8 }, { chance: 11 }]),
      previews,
      onSelect,
    });
    fireEvent.press(screen.getByLabelText('Chance, worth 20 points'));
    expect(onSelect).toHaveBeenCalledWith('chance', 2);
  });
});
