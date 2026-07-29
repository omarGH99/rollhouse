import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

import { useReducedMotion } from './useReducedMotion';

const Probe: React.FC = () => <Text>{useReducedMotion() ? 'reduced' : 'full'}</Text>;

describe('useReducedMotion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports full motion by default', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('full')).toBeTruthy());
  });

  it('reports reduced motion when the OS setting is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('reduced')).toBeTruthy());
  });

  it('subscribes to later changes', () => {
    const remove = jest.fn();
    const addListener = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove } as never);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const view = render(<Probe />);
    expect(addListener).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));

    // And unsubscribes, so the listener does not outlive the component.
    view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('falls back to full motion if the query rejects', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockRejectedValue(new Error('unsupported'));
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('full')).toBeTruthy());
  });
});
