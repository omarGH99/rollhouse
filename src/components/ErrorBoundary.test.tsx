import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ErrorBoundary } from './ErrorBoundary';
import { clearGame } from '../storage';

jest.mock('../storage', () => ({
  clearGame: jest.fn(() => Promise.resolve()),
}));

/**
 * Throws while the flag is set. A caller-controlled flag rather than a
 * decrementing counter: React re-invokes a failing render in development to
 * improve the stack trace, which silently eats a one-shot failure.
 */
const Flaky: React.FC<{ fault: { throwing: boolean } }> = ({ fault }) => {
  if (fault.throwing) throw new Error('BOOM');
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
        <Flaky fault={{ throwing: true }} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('TRY AGAIN')).toBeTruthy();
    expect(screen.getByText('START A FRESH GAME')).toBeTruthy();
  });

  it('surfaces the underlying message', () => {
    render(
      <ErrorBoundary>
        <Flaky fault={{ throwing: true }} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('BOOM')).toBeTruthy();
  });

  it('remounts the subtree on retry without touching the save', () => {
    const fault = { throwing: true };
    render(
      <ErrorBoundary>
        <Flaky fault={fault} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    // Whatever caused the fault is resolved before the player retries.
    fault.throwing = false;
    fireEvent.press(screen.getByText('TRY AGAIN'));

    expect(screen.getByText('recovered')).toBeTruthy();
    expect(clearGame).not.toHaveBeenCalled();
  });

  it('discards the saved game when starting fresh', () => {
    // Critical: a save that crashes the board would otherwise trap the player
    // in a relaunch loop into the same crash.
    const fault = { throwing: true };
    render(
      <ErrorBoundary>
        <Flaky fault={fault} />
      </ErrorBoundary>,
    );
    fault.throwing = false;
    fireEvent.press(screen.getByText('START A FRESH GAME'));
    expect(clearGame).toHaveBeenCalledTimes(1);
    expect(screen.getByText('recovered')).toBeTruthy();
  });
});
