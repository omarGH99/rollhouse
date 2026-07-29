import {
  awaitsTurnStart,
  DICE_COUNT,
  GameSession,
  HISTORY_LIMIT,
  MAX_ROLLS,
  canRoll,
  canScore,
  canUndo,
  createInitialState,
  createSession,
  defaultPlayers,
  diceValues,
  gameReducer,
  isAiTurn,
  sessionReducer,
} from './gameReducer';
import { ALL_CATEGORIES, TOTAL_ROUNDS, isSheetComplete } from './scoring';
import { Category, GameState, Player } from '../types';

const humans = (n: number): Player[] => defaultPlayers(n);

/** First category still open for the active player. */
const firstOpen = (state: GameState): Category =>
  ALL_CATEGORIES.find((c) => state.scores[state.currentPlayer][c] === null)!;

/** Roll, then score the first open box. */
const playTurn = (state: GameState): GameState => {
  const rolled = gameReducer(state, { type: 'ROLL' });
  return gameReducer(rolled, { type: 'SCORE', category: firstOpen(rolled) });
};

/** Drive a whole game to gameover, returning the final state. */
const playOut = (start: GameState): GameState => {
  let state = start;
  let guard = 0;
  while (state.phase !== 'gameover' && guard < 500) {
    guard += 1;
    state =
      state.phase === 'handoff'
        ? gameReducer(state, { type: 'BEGIN_TURN' })
        : playTurn(state);
  }
  return state;
};

describe('createInitialState', () => {
  it('defaults to two human seats', () => {
    const state = createInitialState();
    expect(state.players).toHaveLength(2);
    expect(state.players.every((p) => p.kind === 'human')).toBe(true);
  });

  it.each([2, 3, 4])('supports %i players with one sheet each', (n) => {
    const state = createInitialState(humans(n));
    expect(state.players).toHaveLength(n);
    expect(state.scores).toHaveLength(n);
    expect(state.scores.every((s) => !isSheetComplete(s))).toBe(true);
  });

  it('rejects a single-player game', () => {
    expect(() => createInitialState(humans(1))).toThrow(/at least 2/);
  });

  it('caps seats at four', () => {
    expect(createInitialState(humans(6)).players).toHaveLength(4);
  });

  it('gives each player an independent sheet', () => {
    const state = createInitialState(humans(3));
    state.scores[0].ones = 3;
    expect(state.scores[1].ones).toBeNull();
    expect(state.scores[2].ones).toBeNull();
  });

  it('deals five dice and a full set of rolls', () => {
    const state = createInitialState();
    expect(state.dice).toHaveLength(DICE_COUNT);
    expect(state.rollsLeft).toBe(MAX_ROLLS);
    expect(state.hasRolled).toBe(false);
  });
});

describe('guards', () => {
  it('refuses to score before the first roll', () => {
    const state = createInitialState();
    expect(canScore(state, 'chance')).toBe(false);
    expect(gameReducer(state, { type: 'SCORE', category: 'chance' })).toBe(state);
  });

  it('refuses to hold before the first roll', () => {
    const state = createInitialState();
    expect(gameReducer(state, { type: 'TOGGLE_HOLD', dieId: 0 })).toBe(state);
  });

  it('refuses a fourth roll', () => {
    let state = createInitialState();
    for (let i = 0; i < MAX_ROLLS; i += 1) {
      state = gameReducer(state, { type: 'ROLL' });
    }
    expect(state.rollsLeft).toBe(0);
    expect(canRoll(state)).toBe(false);
    expect(gameReducer(state, { type: 'ROLL' })).toBe(state);
  });

  it('refuses to hold after the last roll, when it can no longer matter', () => {
    let state = createInitialState();
    for (let i = 0; i < MAX_ROLLS; i += 1) {
      state = gameReducer(state, { type: 'ROLL' });
    }
    expect(gameReducer(state, { type: 'TOGGLE_HOLD', dieId: 0 })).toBe(state);
  });

  it('refuses to reuse a filled category', () => {
    const rolled = gameReducer(createInitialState(), { type: 'ROLL' });
    const scored = gameReducer(rolled, { type: 'SCORE', category: 'chance' });
    expect(canScore(scored, 'chance')).toBe(false);
    expect(gameReducer(scored, { type: 'SCORE', category: 'chance' })).toBe(scored);
  });

  it('ignores BEGIN_TURN outside the handoff phase', () => {
    const state = createInitialState();
    expect(gameReducer(state, { type: 'BEGIN_TURN' })).toBe(state);
  });
});

describe('rolling and holding', () => {
  it('leaves held dice untouched across a reroll', () => {
    const rolled = gameReducer(createInitialState(), { type: 'ROLL' });
    const held = gameReducer(rolled, { type: 'TOGGLE_HOLD', dieId: 0 });
    const kept = held.dice[0].value;
    const again = gameReducer(held, { type: 'ROLL' });
    expect(again.dice[0].held).toBe(true);
    expect(again.dice[0].value).toBe(kept);
  });

  it('toggles a hold back off', () => {
    const rolled = gameReducer(createInitialState(), { type: 'ROLL' });
    const on = gameReducer(rolled, { type: 'TOGGLE_HOLD', dieId: 2 });
    const off = gameReducer(on, { type: 'TOGGLE_HOLD', dieId: 2 });
    expect(off.dice[2].held).toBe(false);
  });

  it('bumps rollNonce so the dice animation can retrigger', () => {
    const a = createInitialState();
    const b = gameReducer(a, { type: 'ROLL' });
    expect(b.rollNonce).toBe(a.rollNonce + 1);
  });

  it('only ever produces faces 1-6', () => {
    let state = createInitialState();
    for (let i = 0; i < 200; i += 1) {
      state = gameReducer(state, { type: 'ROLL' });
      if (state.rollsLeft === 0) state = gameReducer(state, { type: 'ROLL' });
      diceValues(state.dice).forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      });
      if (state.rollsLeft === 0) {
        state = gameReducer(state, { type: 'SCORE', category: firstOpen(state) });
        state = gameReducer(state, { type: 'BEGIN_TURN' });
      }
    }
  });
});

describe('turn order', () => {
  it.each([2, 3, 4])('cycles through all %i seats before advancing the round', (n) => {
    let state = createInitialState(humans(n));
    expect(state.round).toBe(1);

    for (let seat = 0; seat < n; seat += 1) {
      expect(state.currentPlayer).toBe(seat);
      // The round must not tick over until the last seat has played.
      expect(state.round).toBe(1);
      state = playTurn(state);
      state = gameReducer(state, { type: 'BEGIN_TURN' });
    }

    expect(state.round).toBe(2);
    expect(state.currentPlayer).toBe(0);
  });

  it('hands off to the next seat, wrapping at the end', () => {
    let state = createInitialState(humans(3));
    state = playTurn(state);
    expect(state.incomingPlayer).toBe(1);
    state = gameReducer(state, { type: 'BEGIN_TURN' });
    state = playTurn(state);
    expect(state.incomingPlayer).toBe(2);
    state = gameReducer(state, { type: 'BEGIN_TURN' });
    state = playTurn(state);
    expect(state.incomingPlayer).toBe(0);
  });

  it('resets dice and rolls at the start of each turn', () => {
    let state = playTurn(createInitialState());
    state = gameReducer(state, { type: 'BEGIN_TURN' });
    expect(state.rollsLeft).toBe(MAX_ROLLS);
    expect(state.hasRolled).toBe(false);
    expect(state.dice.every((d) => !d.held)).toBe(true);
  });
});

describe('full games', () => {
  it.each([2, 3, 4])('a %i-player game ends with every sheet complete', (n) => {
    const final = playOut(createInitialState(humans(n)));
    expect(final.phase).toBe('gameover');
    expect(final.round).toBe(TOTAL_ROUNDS);
    expect(final.scores).toHaveLength(n);
    expect(final.scores.every(isSheetComplete)).toBe(true);
  });

  it('does not hand off after the final turn', () => {
    const final = playOut(createInitialState());
    expect(final.phase).toBe('gameover');
    expect(gameReducer(final, { type: 'BEGIN_TURN' })).toBe(final);
    expect(gameReducer(final, { type: 'ROLL' })).toBe(final);
  });
});

describe('players and seats', () => {
  it('identifies an AI turn only while that seat is active', () => {
    const state = createInitialState([
      { name: 'You', kind: 'human' },
      { name: 'Bot', kind: 'ai' },
    ]);
    expect(isAiTurn(state)).toBe(false);
    const next = gameReducer(playTurn(state), { type: 'BEGIN_TURN' });
    expect(next.currentPlayer).toBe(1);
    expect(isAiTurn(next)).toBe(true);
  });

  it('does not treat a handoff as an AI turn', () => {
    const state = playTurn(
      createInitialState([
        { name: 'You', kind: 'human' },
        { name: 'Bot', kind: 'ai' },
      ]),
    );
    expect(state.phase).toBe('handoff');
    expect(isAiTurn(state)).toBe(false);
  });

  it('RESET can change the seat layout', () => {
    const state = createInitialState(humans(2));
    const next = gameReducer(state, { type: 'RESET', players: humans(4) });
    expect(next.players).toHaveLength(4);
    expect(next.round).toBe(1);
  });

  it('RESET keeps the current layout when none is given', () => {
    const state = createInitialState(humans(3));
    expect(gameReducer(state, { type: 'RESET' }).players).toHaveLength(3);
  });
});

describe('undo', () => {
  const scoreOnce = (session: GameSession): GameSession => {
    const rolled = sessionReducer(session, { type: 'ROLL' });
    return sessionReducer(rolled, {
      type: 'SCORE',
      category: firstOpen(rolled.state),
    });
  };

  it('starts with nothing to undo', () => {
    expect(canUndo(createSession())).toBe(false);
  });

  it('records only scoring actions, not rolls or holds', () => {
    let session = createSession();
    session = sessionReducer(session, { type: 'ROLL' });
    session = sessionReducer(session, { type: 'TOGGLE_HOLD', dieId: 0 });
    expect(session.history).toHaveLength(0);
    session = sessionReducer(session, { type: 'SCORE', category: 'chance' });
    expect(session.history).toHaveLength(1);
  });

  it('restores the exact pre-score state, dice included', () => {
    let session = createSession();
    session = sessionReducer(session, { type: 'ROLL' });
    const before = session.state;
    session = sessionReducer(session, { type: 'SCORE', category: 'chance' });
    expect(session.state.phase).toBe('handoff');

    session = sessionReducer(session, { type: 'UNDO' });
    expect(session.state).toEqual(before);
    expect(session.state.scores[0].chance).toBeNull();
    expect(session.state.phase).toBe('turn');
    expect(canUndo(session)).toBe(false);
  });

  it('unwinds several turns in order', () => {
    let session = createSession();
    const snapshots: GameState[] = [];
    for (let i = 0; i < 3; i += 1) {
      session = sessionReducer(session, { type: 'ROLL' });
      snapshots.push(session.state);
      session = sessionReducer(session, {
        type: 'SCORE',
        category: firstOpen(session.state),
      });
      session = sessionReducer(session, { type: 'BEGIN_TURN' });
    }
    for (let i = 2; i >= 0; i -= 1) {
      // BEGIN_TURN is not itself undoable, so unwind past it to the score.
      while (session.state.phase !== 'handoff' && canUndo(session)) {
        session = sessionReducer(session, { type: 'UNDO' });
        if (session.state === snapshots[i]) break;
      }
      expect(session.state).toEqual(snapshots[i]);
    }
  });

  it('is a no-op with an empty stack', () => {
    const session = createSession();
    expect(sessionReducer(session, { type: 'UNDO' })).toBe(session);
  });

  it(`keeps at most ${HISTORY_LIMIT} snapshots`, () => {
    let session = createSession();
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
      session = scoreOnce(session);
      session = sessionReducer(session, { type: 'BEGIN_TURN' });
    }
    expect(session.history).toHaveLength(HISTORY_LIMIT);
  });

  it('clears the stack on reset', () => {
    let session = scoreOnce(createSession());
    expect(canUndo(session)).toBe(true);
    session = sessionReducer(session, { type: 'RESET' });
    expect(canUndo(session)).toBe(false);
  });

  it('leaves the session untouched when the inner action is illegal', () => {
    const session = createSession();
    expect(sessionReducer(session, { type: 'SCORE', category: 'chance' })).toBe(
      session,
    );
  });

  it('can undo the move that ended the game', () => {
    let session: GameSession = createSession();
    let guard = 0;
    while (session.state.phase !== 'gameover' && guard < 500) {
      guard += 1;
      session =
        session.state.phase === 'handoff'
          ? sessionReducer(session, { type: 'BEGIN_TURN' })
          : scoreOnce(session);
    }
    expect(session.state.phase).toBe('gameover');
    session = sessionReducer(session, { type: 'UNDO' });
    expect(session.state.phase).toBe('turn');
  });
});

describe('turn handoff', () => {
  const seat = (kind: 'human' | 'ai', i: number): Player => ({
    name: kind === 'ai' ? `Bot ${i + 1}` : `Player ${i + 1}`,
    kind,
  });

  /** Advance exactly as the app does: bots auto-start, people tap in. */
  const advance = (state: GameState): GameState =>
    state.phase === 'handoff' && !awaitsTurnStart(state)
      ? gameReducer(state, { type: 'BEGIN_TURN' })
      : state;

  it('waits for a person to start their own turn', () => {
    const state = playTurn(createInitialState(humans(2)));
    expect(state.phase).toBe('handoff');
    expect(awaitsTurnStart(state)).toBe(true);
    // Nothing auto-advances, so the tap target must be shown.
    expect(advance(state)).toBe(state);
  });

  it('starts a bot turn without waiting', () => {
    const state = playTurn(
      createInitialState([seat('human', 0), seat('ai', 1)]),
    );
    expect(awaitsTurnStart(state)).toBe(false);
    expect(advance(state).phase).toBe('turn');
  });

  it('hands back to the only human after a bot plays', () => {
    // Regression: the handoff screen used to be suppressed whenever there was
    // a single human, while the driver only auto-advanced for incoming bots.
    // Nothing then advanced the turn and the game stalled after every bot move.
    let state = createInitialState([seat('human', 0), seat('ai', 1)]);
    state = advance(playTurn(state)); // human scores, bot's turn begins
    expect(state.currentPlayer).toBe(1);

    state = playTurn(state); // bot scores
    expect(state.incomingPlayer).toBe(0);
    expect(awaitsTurnStart(state)).toBe(true);
  });

  it('never strands a game: every handoff is either tappable or automatic', () => {
    const layouts: Player[][] = [
      [seat('human', 0), seat('ai', 1)],
      [seat('ai', 0), seat('human', 1)],
      [seat('ai', 0), seat('ai', 1)],
      [seat('human', 0), seat('human', 1), seat('ai', 2)],
    ];

    for (const players of layouts) {
      let state = createInitialState(players);
      let guard = 0;
      while (state.phase !== 'gameover' && guard < 500) {
        guard += 1;
        if (state.phase === 'handoff') {
          // A handoff must be resolvable one way or the other.
          const tappable = awaitsTurnStart(state);
          state = gameReducer(state, { type: 'BEGIN_TURN' });
          expect(tappable || state.phase === 'turn').toBe(true);
        } else {
          state = playTurn(state);
        }
      }
      expect(state.phase).toBe('gameover');
    }
  });
});
