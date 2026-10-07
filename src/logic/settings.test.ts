import { DEFAULT_SETTINGS, deserializeSettings, serializeSettings } from './settings';

describe('settings', () => {
  it('round-trips', () => {
    const settings = { ...DEFAULT_SETTINGS, sound: false, hints: true };
    expect(deserializeSettings(serializeSettings(settings))).toEqual(settings);
  });

  it('falls back to the defaults when there is nothing usable', () => {
    expect(deserializeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(deserializeSettings('{ broken')).toEqual(DEFAULT_SETTINGS);
    expect(deserializeSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(deserializeSettings('[]')).toEqual(DEFAULT_SETTINGS);
  });

  it('gives a setting added since the save its default', () => {
    const settings = deserializeSettings(JSON.stringify({ sound: false }));
    expect(settings.sound).toBe(false);
    expect(settings.haptics).toBe(DEFAULT_SETTINGS.haptics);
    expect(settings.hints).toBe(DEFAULT_SETTINGS.hints);
  });

  it('ignores a value that is not a plain on or off', () => {
    const settings = deserializeSettings(JSON.stringify({ sound: 'no', fastBots: 1 }));
    expect(settings.sound).toBe(DEFAULT_SETTINGS.sound);
    expect(settings.fastBots).toBe(DEFAULT_SETTINGS.fastBots);
  });

  it('drops keys it does not know', () => {
    const settings = deserializeSettings(JSON.stringify({ sound: false, theme: 'neon' }));
    expect(Object.keys(settings).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });

  it('never hands back the shared defaults object', () => {
    const settings = deserializeSettings(null);
    settings.sound = false;
    expect(DEFAULT_SETTINGS.sound).toBe(true);
  });
});
