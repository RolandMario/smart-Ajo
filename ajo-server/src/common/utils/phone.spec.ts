import { isSamePhone, ngPhoneVariants, toE164Nigeria } from './phone';

/**
 * These guards exist because a real ₦ transfer was silently dropped: members
 * are stored as `+2347068497568`, Paystack webhooks send `07068497568`, and
 * the old exact-match lookup credited nobody.
 */
describe('toE164Nigeria', () => {
  it('normalises every common Nigerian format to E.164', () => {
    for (const input of [
      '+2347068497568',
      '2347068497568',
      '07068497568',
      '7068497568',
      '0706 849 7568',
      '+234 (0) 706-849-7568',
    ]) {
      expect(toE164Nigeria(input)).toBe('+2347068497568');
    }
  });

  it('leaves non-Nigerian or unparseable numbers untouched', () => {
    expect(toE164Nigeria('+447911123456')).toBe('+447911123456');
    expect(toE164Nigeria(' 12345 ')).toBe('12345');
  });

  it('returns undefined for empty input', () => {
    expect(toE164Nigeria(undefined)).toBeUndefined();
    expect(toE164Nigeria(null)).toBeUndefined();
    expect(toE164Nigeria('   ')).toBeUndefined();
  });
});

describe('ngPhoneVariants', () => {
  it('returns every stored form of the same number', () => {
    expect(ngPhoneVariants('07068497568')).toEqual([
      '+2347068497568',
      '2347068497568',
      '07068497568',
      '7068497568',
    ]);
  });

  it('deduplicates when the input already is one of the variants', () => {
    expect(ngPhoneVariants('+2347068497568')).toHaveLength(4);
  });

  it('returns a single variant for values it cannot parse', () => {
    expect(ngPhoneVariants('+447911123456')).toEqual(['+447911123456']);
    expect(ngPhoneVariants('')).toEqual([]);
  });
});

describe('isSamePhone', () => {
  it('matches the same number written in different formats', () => {
    expect(isSamePhone('+2347068497568', '07068497568')).toBe(true);
    expect(isSamePhone('2347068497568', '7068497568')).toBe(true);
  });

  it('rejects different numbers and empty input', () => {
    expect(isSamePhone('+2347068497568', '08012345678')).toBe(false);
    expect(isSamePhone(undefined, '08012345678')).toBe(false);
  });
});
