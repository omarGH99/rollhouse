import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ScoreRow } from './ScoreRow';
import { createEmptyScoreSheet } from '../logic/scoring';
import { palette, seatAccent } from '../theme';
import { ScoreSheet } from '../types';

const sheets = (overrides: Partial<ScoreSheet>[] = []): ScoreSheet[] =>
  [0, 1].map((i) => ({ ...createEmptyScoreSheet(), ...(overrides[i] ?? {}) }));

const setup = (props: Partial<React.ComponentProps<typeof ScoreRow>> = {}) =>
  render(
    <ScoreRow
      category="chance"
      scores={sheets()}
      currentPlayer={0}
      accent={seatAccent(0)}
      previewNonce={0}
      available
      rolled={false}
      selectable={false}
      justScored={false}
      onSelect={jest.fn()}
      {...props}
    />,
  );

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

  it('renders one cell per seat', () => {
    setup({ scores: sheets() });
    // Two open seats, so two placeholder dashes.
    expect(screen.getAllByText('–')).toHaveLength(2);
  });

  it('renders a cell for every seat in a four-player game', () => {
    const four = [0, 1, 2, 3].map(() => createEmptyScoreSheet());
    setup({ scores: four });
    expect(screen.getAllByText('–')).toHaveLength(4);
  });

  it('shows a recorded score instead of a dash', () => {
    setup({ scores: sheets([{ chance: 21 }]) });
    expect(screen.getByText('21')).toBeTruthy();
    expect(screen.getAllByText('–')).toHaveLength(1);
  });

  it('shows the prospective score when the box is open and dice are live', () => {
    setup({ rolled: true, selectable: true, preview: 17 });
    expect(screen.getByText('17')).toBeTruthy();
  });

  it('labels the five-alike box with the game\u2019s own name', () => {
    setup({ category: 'rollhouse' });
    expect(screen.getByText(/^Rollhouse/)).toBeTruthy();
  });
});

describe('availability colouring', () => {
  it('is plain ink before the player has rolled', () => {
    setup({ rolled: false, available: true });
    expect(labelStyle().color).toBe(palette.cardInk);
  });

  it('turns green once rolled while the box is open', () => {
    setup({ rolled: true, available: true });
    expect(labelStyle().color).toBe(palette.cardOpen);
  });

  it('turns red once rolled when the box is spent', () => {
    setup({ rolled: true, available: false, scores: sheets([{ chance: 12 }]) });
    expect(labelStyle().color).toBe(palette.cardClosed);
  });
});

describe('non-colour cues', () => {
  it('strikes through a spent box so the cue survives colour blindness', () => {
    setup({ available: false, scores: sheets([{ chance: 12 }]) });
    expect(labelStyle().textDecorationLine).toBe('line-through');
  });

  it('leaves an open box unstruck', () => {
    setup({ available: true });
    expect(labelStyle().textDecorationLine).toBeUndefined();
  });
});

describe('interaction', () => {
  it('reports the category when tapped while selectable', () => {
    const onSelect = jest.fn();
    setup({ selectable: true, rolled: true, onSelect });
    fireEvent.press(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('chance');
  });

  it('does not fire when the row is not selectable', () => {
    const onSelect = jest.fn();
    setup({ selectable: false, onSelect });
    fireEvent.press(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks itself disabled for assistive tech when not selectable', () => {
    setup({ selectable: false });
    expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('announces the prospective score in its label', () => {
    setup({ preview: 24, rolled: true, selectable: true });
    expect(screen.getByLabelText('Chance, worth 24 points')).toBeTruthy();
  });
});
