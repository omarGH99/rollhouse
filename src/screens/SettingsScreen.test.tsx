import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_SETTINGS } from '../logic/settings';

const setup = (props: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) =>
  render(
    <SettingsScreen
      visible
      settings={DEFAULT_SETTINGS}
      shakeSupported
      onChange={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />,
  );

describe('settings screen', () => {
  it('renders nothing when not visible', () => {
    setup({ visible: false });
    expect(screen.queryByText('Settings')).toBeNull();
  });

  it('lists every option with its current state', () => {
    setup();
    expect(screen.getByLabelText('Sound').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Vibration').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Fast bots').props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Hint button').props.accessibilityState.checked).toBe(false);
  });

  it('flips just the option that was tapped', () => {
    const onChange = jest.fn();
    setup({ onChange });
    fireEvent.press(screen.getByLabelText('Sound'));
    expect(onChange).toHaveBeenCalledWith({ sound: false });
    fireEvent.press(screen.getByLabelText('Hint button'));
    expect(onChange).toHaveBeenLastCalledWith({ hints: true });
  });

  it('hides shake to throw on a device that cannot be shaken', () => {
    setup({ shakeSupported: false });
    expect(screen.queryByLabelText('Shake to throw')).toBeNull();
    expect(screen.getByLabelText('Sound')).toBeTruthy();
  });

  it('closes', () => {
    const onClose = jest.fn();
    setup({ onClose });
    fireEvent.press(screen.getByLabelText('Close settings'));
    expect(onClose).toHaveBeenCalled();
  });
});
