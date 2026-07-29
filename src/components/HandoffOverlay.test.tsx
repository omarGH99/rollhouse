import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { HandoffOverlay } from './HandoffOverlay';
import { Player } from '../types';

const players: Player[] = [
  { name: 'Player 1', kind: 'human' },
  { name: 'Player 2', kind: 'human' },
];

const setup = (props: Partial<React.ComponentProps<typeof HandoffOverlay>> = {}) =>
  render(
    <HandoffOverlay
      visible
      players={players}
      incomingPlayer={1}
      completedRound={3}
      roundFullyComplete={false}
      lastScored={{ player: 0, category: 'chance', points: 21 }}
      canUndo={false}
      onBegin={jest.fn()}
      onUndo={jest.fn()}
      {...props}
    />,
  );

describe('visibility', () => {
  it('renders nothing when not visible', () => {
    setup({ visible: false });
    expect(screen.queryByText(/Pass the device to/)).toBeNull();
  });

  it('names the incoming player', () => {
    setup();
    expect(screen.getByText(/Pass the device to/)).toBeTruthy();
    expect(screen.getByText('PLAYER 2')).toBeTruthy();
  });
});

describe('round wording', () => {
  it('says turn complete mid-round', () => {
    setup({ roundFullyComplete: false });
    expect(screen.getByText('ROUND 3 · TURN COMPLETE')).toBeTruthy();
  });

  it('says round complete once every seat has played', () => {
    setup({ roundFullyComplete: true });
    expect(screen.getByText('ROUND 3 COMPLETE')).toBeTruthy();
  });
});

describe('last score', () => {
  it('reports what the previous player took', () => {
    setup();
    expect(screen.getByText('Player 1 · Chance')).toBeTruthy();
    expect(screen.getByText('+21')).toBeTruthy();
  });

  it('copes with no score yet', () => {
    setup({ lastScored: null });
    expect(screen.queryByText(/\+/)).toBeNull();
  });
});

describe('undo', () => {
  it('is hidden when there is nothing to take back', () => {
    setup({ canUndo: false });
    expect(screen.queryByText('Undo my last score')).toBeNull();
  });

  it('is offered when a move can be taken back', () => {
    // Undo lives here because this is the one moment the player who just
    // scored still holds the device.
    setup({ canUndo: true });
    expect(screen.getByText('Undo my last score')).toBeTruthy();
  });

  it('fires the undo handler', () => {
    const onUndo = jest.fn();
    setup({ canUndo: true, onUndo });
    fireEvent.press(screen.getByLabelText('Undo my last score'));
    expect(onUndo).toHaveBeenCalled();
  });
});

describe('starting the turn', () => {
  it('fires the begin handler', () => {
    const onBegin = jest.fn();
    setup({ onBegin });
    fireEvent.press(screen.getByText('START MY TURN'));
    expect(onBegin).toHaveBeenCalled();
  });
});
