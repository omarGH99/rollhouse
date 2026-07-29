import {
  SAVE_VERSION,
  deserializeSession,
  serializeSession,
} from './persistence';
import {
  createSession,
  defaultPlayers,
  gameReducer,
  sessionReducer,
} from './gameReducer';
import { GameState } from '../types';

/** Serialize, then tamper with the parsed payload before re-stringifying. */
const corrupt = (mutate: (state: Record<string, unknown>) => void): string => {
  const session = createSession();
  const parsed = JSON.parse(serializeSession(session));
  mutate(parsed.state);
  return JSON.stringify(parsed);
};

describe('round trip', () => {
  it('restores an in-progress game exactly', () => {
    let session = createSession(defaultPlayers(3));
    session = sessionReducer(session, { type: 'ROLL' });
    session = sessionReducer(session, { type: 'TOGGLE_HOLD', dieId: 1 });

    const restored = deserializeSession(serializeSession(session));
    expect(restored).not.toBeNull();
    expect(restored!.state).toEqual(session.state);
  });

  it('preserves dice, holds and rolls left', () => {
    let session = createSession();
    session = sessionReducer(session, { type: 'ROLL' });
    session = sessionReducer(session, { type: 'TOGGLE_HOLD', dieId: 0 });
    const restored = deserializeSession(serializeSession(session))!;
    expect(restored.state.dice).toEqual(session.state.dice);
    expect(restored.state.rollsLeft).toBe(session.state.rollsLeft);
    expect(restored.state.dice[0].held).toBe(true);
  });

  it('preserves AI seats', () => {
    const session = createSession([
      { name: 'You', kind: 'human' },
      { name: 'Bot', kind: 'ai' },
    ]);
    const restored = deserializeSession(serializeSession(session))!;
    expect(restored.state.players[1].kind).toBe('ai');
  });

  it('drops the undo history rather than persisting it', () => {
    let session = createSession();
    session = sessionReducer(session, { type: 'ROLL' });
    session = sessionReducer(session, { type: 'SCORE', category: 'chance' });
    expect(session.history).toHaveLength(1);

    const restored = deserializeSession(serializeSession(session))!;
    expect(restored.history).toHaveLength(0);
  });

  it('stamps a version and a timestamp', () => {
    const parsed = JSON.parse(serializeSession(createSession()));
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(typeof parsed.savedAt).toBe('number');
  });
});

describe('rejects unusable saves', () => {
  it('returns null for absent or empty input', () => {
    expect(deserializeSession(null)).toBeNull();
    expect(deserializeSession('')).toBeNull();
  });

  it('returns null for malformed JSON rather than throwing', () => {
    expect(deserializeSession('{ not json')).toBeNull();
    expect(deserializeSession('null')).toBeNull();
    expect(deserializeSession('[]')).toBeNull();
  });

  it('refuses a future or missing schema version', () => {
    const session = createSession();
    const parsed = JSON.parse(serializeSession(session));
    parsed.version = SAVE_VERSION + 1;
    expect(deserializeSession(JSON.stringify(parsed))).toBeNull();

    delete parsed.version;
    expect(deserializeSession(JSON.stringify(parsed))).toBeNull();
  });

  it('refuses a finished game, which is not worth resuming', () => {
    const session = createSession();
    const parsed = JSON.parse(serializeSession(session));
    parsed.state.phase = 'gameover';
    expect(deserializeSession(JSON.stringify(parsed))).toBeNull();
  });

  it.each([
    ['no players', (s: Record<string, unknown>) => { s.players = []; }],
    ['one player', (s: Record<string, unknown>) => {
      s.players = [{ name: 'a', kind: 'human' }];
      s.scores = [s.scores as unknown[]].flat().slice(0, 1);
    }],
    ['seat count mismatch', (s: Record<string, unknown>) => {
      (s.players as unknown[]).push({ name: 'c', kind: 'human' });
    }],
    ['bad player kind', (s: Record<string, unknown>) => {
      (s.players as { kind: string }[])[0].kind = 'robot';
    }],
    ['die out of range', (s: Record<string, unknown>) => {
      (s.dice as { value: number }[])[0].value = 9;
    }],
    ['non-integer die', (s: Record<string, unknown>) => {
      (s.dice as { value: number }[])[0].value = 2.5;
    }],
    ['no dice', (s: Record<string, unknown>) => { s.dice = []; }],
    ['bad phase', (s: Record<string, unknown>) => { s.phase = 'paused'; }],
    ['round out of range', (s: Record<string, unknown>) => { s.round = 99; }],
    ['round below one', (s: Record<string, unknown>) => { s.round = 0; }],
    ['seat index out of range', (s: Record<string, unknown>) => {
      s.currentPlayer = 7;
    }],
    ['negative seat index', (s: Record<string, unknown>) => {
      s.incomingPlayer = -1;
    }],
    ['negative rolls', (s: Record<string, unknown>) => { s.rollsLeft = -1; }],
    ['unknown category in lastScored', (s: Record<string, unknown>) => {
      s.lastScored = { player: 0, category: 'nonsense', points: 5 };
    }],
    ['score sheet with a bad cell', (s: Record<string, unknown>) => {
      (s.scores as Record<string, unknown>[])[0].ones = 'lots';
    }],
    ['score sheet missing entirely', (s: Record<string, unknown>) => {
      s.scores = [null, null];
    }],
  ])('rejects %s', (_label, mutate) => {
    expect(deserializeSession(corrupt(mutate))).toBeNull();
  });
});

describe('resuming a restored game', () => {
  it('can be played on normally', () => {
    let session = createSession();
    session = sessionReducer(session, { type: 'ROLL' });
    const restored = deserializeSession(serializeSession(session))!;

    const next: GameState = gameReducer(restored.state, {
      type: 'SCORE',
      category: 'chance',
    });
    expect(next.phase).toBe('handoff');
    expect(next.scores[0].chance).not.toBeNull();
  });
});
