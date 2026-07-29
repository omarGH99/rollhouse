import React from 'react';
import { Text, View } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { FitToHeight, MIN_SCALE } from './FitToHeight';

/**
 * `onLayout` never fires in the test renderer, so both measurements are driven
 * explicitly. That is also what makes these assertions meaningful: the scale is
 * a pure function of the two heights, and this pins that function down.
 */
const measure = (available: number, natural: number) => {
  fireEvent(screen.getByTestId('fit-scroller'), 'layout', {
    nativeEvent: { layout: { height: available, width: 400, x: 0, y: 0 } },
  });
  fireEvent(screen.getByTestId('fit-content'), 'layout', {
    nativeEvent: { layout: { height: natural, width: 400, x: 0, y: 0 } },
  });
};

const scaleOf = () => {
  const style = screen.getByTestId('fit-content').props.style;
  const flat = Object.assign(
    {},
    ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style]),
  );
  return flat.transform?.[0]?.scale;
};

const marginOf = () => {
  const style = screen.getByTestId('fit-content').props.style;
  const flat = Object.assign(
    {},
    ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style]),
  );
  return flat.marginBottom;
};

const setup = (props = {}) =>
  render(
    <FitToHeight {...props}>
      <Text>board</Text>
    </FitToHeight>,
  );

describe('scaling', () => {
  it('renders its children', () => {
    setup();
    expect(screen.getByText('board')).toBeTruthy();
  });

  it('stays at 1 when the content already fits', () => {
    setup();
    measure(900, 500);
    expect(scaleOf()).toBe(1);
  });

  it('never scales above 1, however much room there is', () => {
    setup();
    measure(2000, 300);
    expect(scaleOf()).toBe(1);
  });

  it('shrinks just enough to fit when the content is too tall', () => {
    setup();
    // Chosen to land above MIN_SCALE, so this exercises the computed path
    // rather than the clamp.
    measure(900, 1000);
    // (900 - 2px slack) / 1000
    expect(scaleOf()).toBeCloseTo(0.898, 3);
  });

  it('clamps at MIN_SCALE rather than shrinking to unreadability', () => {
    setup();
    measure(400, 2000);
    expect(scaleOf()).toBe(MIN_SCALE);
  });

  it('keeps the floor high enough not to undo touch target sizing', () => {
    // A 38px row must not be scaled below roughly 32px.
    expect(MIN_SCALE).toBeGreaterThanOrEqual(0.85);
  });

  it('reclaims the layout space the transform gives back', () => {
    setup();
    measure(900, 1000);
    // A transform does not shrink the layout box, so without this negative
    // margin every screen would gain a band of dead space.
    expect(marginOf()).toBeCloseTo(-1000 * (1 - 0.898), 0);
  });
});

describe('scrolling', () => {
  it('does not scroll while the content fits', () => {
    setup();
    measure(900, 500);
    expect(screen.getByTestId('fit-scroller').props.scrollEnabled).toBe(false);
  });

  it('scrolls once even the clamped scale cannot fit', () => {
    setup();
    measure(400, 2000);
    expect(screen.getByTestId('fit-scroller').props.scrollEnabled).toBe(true);
  });

  it('stays locked when the caller disables scrolling, even if overflowing', () => {
    // The board must be inert behind a full-screen curtain.
    setup({ scrollEnabled: false });
    measure(400, 2000);
    expect(screen.getByTestId('fit-scroller').props.scrollEnabled).toBe(false);
  });
});

describe('content padding', () => {
  it('applies caller padding inside the measured box', () => {
    // Regression guard: on the scroll container this padding would sit outside
    // the transform, so it would be neither scaled nor counted, and the board
    // would overflow by exactly the padding amount.
    render(
      <FitToHeight contentStyle={{ paddingTop: 40 }}>
        <View />
      </FitToHeight>,
    );
    const style = screen.getByTestId('fit-content').props.style;
    const flat = Object.assign(
      {},
      ...(Array.isArray(style) ? style.flat(Infinity).filter(Boolean) : [style]),
    );
    expect(flat.paddingTop).toBe(40);
  });
});
