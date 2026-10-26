import {
  DonationFrequency,
  DonationSchedule,
} from '../../common/enums/donation.enum';
import {
  currentPeriodKey,
  describeSchedule,
  nextPeriodStart,
  periodLabel,
} from './donation-period';

/** Sunday 25 October 2026, 15:30 local time — inside ISO week 43. */
const NOW = new Date(2026, 9, 25, 15, 30);

describe('currentPeriodKey', () => {
  it('uses the constant `once` key for one-time pools', () => {
    expect(currentPeriodKey(DonationSchedule.ONE_TIME, undefined, NOW)).toBe(
      'once',
    );
  });

  it('treats a missing frequency as one-time', () => {
    expect(currentPeriodKey(DonationSchedule.INTERVAL, undefined, NOW)).toBe(
      'once',
    );
  });

  it('returns a calendar-day key for daily pools', () => {
    expect(
      currentPeriodKey(DonationSchedule.INTERVAL, DonationFrequency.DAILY, NOW),
    ).toBe('2026-10-25');
  });

  it('returns a zero-padded month key for monthly pools', () => {
    expect(
      currentPeriodKey(
        DonationSchedule.INTERVAL,
        DonationFrequency.MONTHLY,
        NOW,
      ),
    ).toBe('2026-10');
    expect(
      currentPeriodKey(
        DonationSchedule.INTERVAL,
        DonationFrequency.MONTHLY,
        new Date(2026, 0, 9),
      ),
    ).toBe('2026-01');
  });

  it('returns the calendar year for yearly pools', () => {
    expect(
      currentPeriodKey(
        DonationSchedule.INTERVAL,
        DonationFrequency.YEARLY,
        NOW,
      ),
    ).toBe('2026');
  });

  describe('weekly (ISO-8601) keys', () => {
    const cases: Array<[string, string]> = [
      // Monday and the following Sunday share a week.
      ['2026-10-19T12:00:00', '2026-W43'],
      ['2026-10-25T12:00:00', '2026-W43'],
      ['2026-10-26T12:00:00', '2026-W44'],
      // Late December can still belong to the previous ISO year.
      ['2026-12-31T12:00:00', '2026-W53'],
      ['2027-01-01T12:00:00', '2026-W53'],
      ['2027-01-04T12:00:00', '2027-W01'],
    ];

    it.each(cases)('%s -> %s', (iso, expected) => {
      expect(
        currentPeriodKey(
          DonationSchedule.INTERVAL,
          DonationFrequency.WEEKLY,
          new Date(iso),
        ),
      ).toBe(expected);
    });
  });

  it('changes the daily key at local midnight, not mid-day', () => {
    const lateNight = new Date(2026, 9, 25, 23, 59);
    const afterMidnight = new Date(2026, 9, 26, 0, 1);
    expect(
      currentPeriodKey(
        DonationSchedule.INTERVAL,
        DonationFrequency.DAILY,
        lateNight,
      ),
    ).not.toBe(
      currentPeriodKey(
        DonationSchedule.INTERVAL,
        DonationFrequency.DAILY,
        afterMidnight,
      ),
    );
  });
});

describe('nextPeriodStart', () => {
  it('returns null for one-time pools', () => {
    expect(nextPeriodStart(undefined, NOW)).toBeNull();
  });

  it('returns the next local midnight for daily pools', () => {
    expect(nextPeriodStart(DonationFrequency.DAILY, NOW)).toEqual(
      new Date(2026, 9, 26, 0, 0, 0, 0),
    );
  });

  it('returns the coming Monday for weekly pools', () => {
    // NOW is a Sunday, so tomorrow starts the next ISO week.
    expect(nextPeriodStart(DonationFrequency.WEEKLY, NOW)).toEqual(
      new Date(2026, 9, 26, 0, 0, 0, 0),
    );
    // A Monday rolls a full week forward.
    expect(
      nextPeriodStart(DonationFrequency.WEEKLY, new Date(2026, 9, 19)),
    ).toEqual(new Date(2026, 9, 26, 0, 0, 0, 0));
  });

  it('returns the first of next month / next year', () => {
    expect(nextPeriodStart(DonationFrequency.MONTHLY, NOW)).toEqual(
      new Date(2026, 10, 1, 0, 0, 0, 0),
    );
    expect(nextPeriodStart(DonationFrequency.YEARLY, NOW)).toEqual(
      new Date(2027, 0, 1, 0, 0, 0, 0),
    );
  });
});

describe('labels', () => {
  it('labels one-time pools explicitly', () => {
    expect(periodLabel(DonationSchedule.ONE_TIME, undefined)).toBe('one-time');
    expect(describeSchedule(DonationSchedule.ONE_TIME, undefined)).toBe(
      'one-time',
    );
  });

  it('labels each interval cadence', () => {
    expect(
      periodLabel(DonationSchedule.INTERVAL, DonationFrequency.DAILY),
    ).toBe('today');
    expect(
      periodLabel(DonationSchedule.INTERVAL, DonationFrequency.WEEKLY),
    ).toBe('this week');
    expect(
      periodLabel(DonationSchedule.INTERVAL, DonationFrequency.MONTHLY),
    ).toBe('this month');
    expect(
      periodLabel(DonationSchedule.INTERVAL, DonationFrequency.YEARLY),
    ).toBe('this year');

    expect(
      describeSchedule(DonationSchedule.INTERVAL, DonationFrequency.DAILY),
    ).toBe('daily');
    expect(
      describeSchedule(DonationSchedule.INTERVAL, DonationFrequency.WEEKLY),
    ).toBe('weekly');
    expect(
      describeSchedule(DonationSchedule.INTERVAL, DonationFrequency.MONTHLY),
    ).toBe('monthly');
    expect(
      describeSchedule(DonationSchedule.INTERVAL, DonationFrequency.YEARLY),
    ).toBe('yearly');
  });
});
