import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ErrorBoundary } from './ErrorBoundary';
import { clearGame } from '../storage';

jest.mock('../storage', () => ({
  clearGame: jest.fn(() => Promise.resolve()),
}));

/** Throws on first render, then behaves, so recovery can be observed. */
const Flaky: React.FC<{ failures: { count: number } }> = ({ failures }) => {
  if (failures.count > 0) {
    failures.count -= 1;
    throw new Error('BOOM');
  }
  return <Text>recovered</Text>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // React logs caught errors; silence just that noise.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
  });

  it('renders children while nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <Text>board</Text>
      </ErrorBoundary>,
    );
    expect(screen.getByText('board')).toBeTruthy();
  });

  it('shows recovery UI instead of a blank screen when a child throws', () => {
    render(
      <ErrorBoundary>
        <Flaky failures={{ count: 99 }} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('TRY AGAIN')).toBeTruthy();
    expect(screen.getByText('START A FRESH GAME')).toBeTruthy();
  });

  it('surfaces the underlying message', () => {
    render(
      <ErrorBoundary>
        <Flaky failures={{ count: 99 }} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('BOOM')).toBeTruthy();
  });

  it('remounts the subtree on retry without touching the save', () => {
    const failures = { count: 1 };
    render(
      <ErrorBoundary>
        <Flaky failures={failures} />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByText('TRY AGAIN'));
    expect(screen.getByText('recovered')).toBeTruthy();
    expect(clearGame).not.toHaveBeenCalled();
  });

  it('discards the saved game when starting fresh', () => {
    // Critical: a save that crashes the board would otherwise trap the player
    // in a relaunch loop into the same crash.
    const failures = { count: 1 };
    render(
      <ErrorBoundary>
        <Flaky failures={failures} />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByText('START A FRESH GAME'));
    expect(clearGame).toHaveBeenCalledTimes(1);
    expect(screen.getByText('recovered')).toBeTruthy();
  });
});
