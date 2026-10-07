import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ThrowScreen } from './ThrowScreen';
import { accents } from '../theme';
import { DieState, DieValue } from '../types';

const dice = (...values: number[]): DieState[] =>
  values.map((value, id) => ({ id, value: value as DieValue, held: false }));

const setup = (props: Partial<React.ComponentProps<typeof ThrowScreen>> = {}) =>
  render(
    <ThrowScreen
      visible
      playerName="Omar"
      accent={accents[0]}
      dice={dice(1, 2, 3, 4, 5)}
      rollsLeft={3}
      hasRolled={false}
      rollNonce={0}
      canRoll
      previews={[{}]}
      multipliers={[1]}
      shakeSupported
      onRoll={jest.fn()}
      onToggleHold={jest.fn()}
      onDone={jest.fn()}
      {...props}
    />,
  );

const rolled = { hasRolled: true, rollsLeft: 2, rollNonce: 1 };

describe('before the first throw', () => {
  it('renders nothing when not visible', () => {
    setup({ visible: false });
    expect(screen.queryByText('OMAR')).toBeNull();
  });

  it('names the player and invites a shake', () => {
    setup();
    expect(screen.getByText('OMAR')).toBeTruthy();
    expect(screen.getByText('YOUR THROW')).toBeTruthy();
    expect(screen.getByText(/Shake your phone/)).toBeTruthy();
  });

  it('does not mention shaking where the device cannot', () => {
    setup({ shakeSupported: false });
    expect(screen.queryByText(/shake/i)).toBeNull();
    expect(screen.getByText('Tap throw to roll the dice')).toBeTruthy();
  });

  it('throws from the button', () => {
    const onRoll = jest.fn();
    setup({ onRoll });
    fireEvent.press(screen.getByText('THROW DICE'));
    expect(onRoll).toHaveBeenCalled();
  });

  it('will not let dice be kept before they are thrown', () => {
    const onToggleHold = jest.fn();
    setup({ onToggleHold });
    fireEvent.press(screen.getByLabelText('Die showing 3'));
    expect(onToggleHold).not.toHaveBeenCalled();
  });

  it('still offers a look at the scorecard', () => {
    const onDone = jest.fn();
    setup({ onDone });
    fireEvent.press(screen.getByLabelText('View scorecard'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('between throws', () => {
  it('counts the throws', () => {
    setup(rolled);
    expect(screen.getByText('THROW 1 OF 3')).toBeTruthy();
    expect(screen.getByText('THROW AGAIN  ·  2 LEFT')).toBeTruthy();
  });

  it('keeps the die that was tapped', () => {
    const onToggleHold = jest.fn();
    setup({ ...rolled, onToggleHold });
    fireEvent.press(screen.getByLabelText('Die showing 3'));
    expect(onToggleHold).toHaveBeenCalledWith(2);
  });

  it('shows the best three paying boxes, highest first', () => {
    setup({
      ...rolled,
      previews: [
        { ones: 1, chance: 15, smallStraight: 30, largeStraight: 40, fullHouse: 0 },
      ],
    });
    expect(screen.getByText('Large Straight')).toBeTruthy();
    expect(screen.getByText('Small Straight')).toBeTruthy();
    expect(screen.getByText('Chance')).toBeTruthy();
    expect(screen.queryByText('Ones')).toBeNull();
    expect(screen.queryByText('Full House')).toBeNull();
  });

  it('ranks boxes by what their column makes them worth', () => {
    setup({
      ...rolled,
      multipliers: [1, 2, 3],
      previews: [{ chance: 20 }, { chance: 20 }, { sixes: 12 }],
    });
    // 20, 40 and 36: the x2 Chance leads, then the x3 Sixes.
    expect(screen.getByText('Chance ×2')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText('Sixes ×3')).toBeTruthy();
    expect(screen.getByText('36')).toBeTruthy();
  });

  it('leaves for the table to score', () => {
    const onDone = jest.fn();
    setup({ ...rolled, onDone });
    fireEvent.press(screen.getByLabelText('Score this hand'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('out of throws', () => {
  it('says so and locks the dice', () => {
    const onToggleHold = jest.fn();
    setup({ hasRolled: true, rollsLeft: 0, rollNonce: 3, canRoll: false, onToggleHold });
    expect(screen.getByText('NO THROWS LEFT')).toBeTruthy();
    expect(screen.getByText('That was your last throw')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Die showing 3'));
    expect(onToggleHold).not.toHaveBeenCalled();
  });
});

describe('hints', () => {
  const box = { category: 'chance' as const, column: 0 };

  it('has no hint button unless hints are switched on', () => {
    setup(rolled);
    expect(screen.queryByLabelText('Hint')).toBeNull();
  });

  it('offers a hint once the dice are out, not before', () => {
    setup({ onHint: jest.fn() });
    expect(screen.queryByLabelText('Hint')).toBeNull();
  });

  it('asks for one on a tap', () => {
    const onHint = jest.fn();
    setup({ ...rolled, onHint });
    fireEvent.press(screen.getByLabelText('Hint'));
    expect(onHint).toHaveBeenCalled();
  });

  it('marks the dice to keep', () => {
    setup({ ...rolled, onHint: jest.fn(), hint: { keep: [0, 3], box } });
    expect(screen.getAllByText('KEEP')).toHaveLength(2);
    expect(screen.getByText('Hint: keep the marked dice and throw the rest')).toBeTruthy();
  });

  it('says to throw everything when nothing is worth keeping', () => {
    setup({ ...rolled, onHint: jest.fn(), hint: { keep: [], box } });
    expect(screen.queryByText('KEEP')).toBeNull();
    expect(screen.getByText('Hint: throw all five again')).toBeTruthy();
  });

  it('names the box when the advice is to score', () => {
    setup({ ...rolled, onHint: jest.fn(), hint: { keep: [0, 1, 2, 3, 4], box } });
    expect(screen.queryByText('KEEP')).toBeNull();
    expect(screen.getByText('Hint: score it in Chance')).toBeTruthy();
  });

  it('names the column too when the card has several', () => {
    setup({
      hasRolled: true,
      rollsLeft: 0,
      rollNonce: 3,
      canRoll: false,
      multipliers: [1, 2, 3],
      previews: [{}, {}, {}],
      onHint: jest.fn(),
      hint: { keep: null, box: { category: 'chance', column: 2 } },
    });
    expect(screen.getByText('Hint: score it in Chance ×3')).toBeTruthy();
  });
});
