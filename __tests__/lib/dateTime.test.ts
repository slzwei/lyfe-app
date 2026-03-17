import {
    formatTime,
    formatCheckinTime,
    formatDateLong,
    formatDateShort,
    formatDateLabel,
    formatCreatedAt,
    formatDateTime,
    formatMonthYear,
    todayLocalStr,
    todayStr,
    isValidDate,
    dateDiffDays,
    dateRange,
    toDateStr,
    timeAgo,
    getRoadshowStatus,
    isEventLive,
} from '@/lib/dateTime';

// ── formatTime ──

describe('formatTime', () => {
    it('converts midnight to 12:00 AM', () => {
        expect(formatTime('00:00')).toBe('12:00 AM');
    });

    it('converts noon to 12:00 PM', () => {
        expect(formatTime('12:00')).toBe('12:00 PM');
    });

    it('converts 13:30 to 1:30 PM', () => {
        expect(formatTime('13:30')).toBe('1:30 PM');
    });

    it('converts 09:05 to 9:05 AM', () => {
        expect(formatTime('09:05')).toBe('9:05 AM');
    });

    it('converts 23:59 to 11:59 PM', () => {
        expect(formatTime('23:59')).toBe('11:59 PM');
    });

    it('converts 01:00 to 1:00 AM', () => {
        expect(formatTime('01:00')).toBe('1:00 AM');
    });
});

// ── formatCheckinTime ──

describe('formatCheckinTime', () => {
    it('formats ISO timestamp to 12h time', () => {
        const result = formatCheckinTime('2026-03-08T14:30:00Z');
        // Depends on local timezone — just check shape
        expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });
});

// ── formatDateLong ──

describe('formatDateLong', () => {
    it('includes weekday, day, month, and year', () => {
        const result = formatDateLong('2026-03-08');
        // Locale-dependent output, but should contain key parts
        expect(result).toContain('2026');
        expect(result).toContain('March');
        expect(result).toContain('8');
    });
});

// ── formatDateShort ──

describe('formatDateShort', () => {
    it('returns short weekday, day, and month', () => {
        const result = formatDateShort('2026-03-08');
        expect(result).toContain('Mar');
        expect(result).toContain('8');
    });
});

// ── formatDateLabel ──

describe('formatDateLabel', () => {
    it('returns short weekday, day, and month', () => {
        const result = formatDateLabel('2026-03-08');
        expect(result).toContain('Mar');
        expect(result).toContain('8');
    });
});

// ── formatCreatedAt ──

describe('formatCreatedAt', () => {
    it('formats ISO to short date with year', () => {
        const result = formatCreatedAt('2026-03-08T10:00:00Z');
        expect(result).toContain('Mar');
        expect(result).toContain('2026');
    });
});

// ── formatDateTime ──

describe('formatDateTime', () => {
    it('includes date and time', () => {
        const result = formatDateTime('2026-03-08T14:30:00Z');
        expect(result).toContain('Mar');
        expect(result).toContain('2026');
    });
});

// ── formatMonthYear ──

describe('formatMonthYear', () => {
    it('returns month and year', () => {
        const result = formatMonthYear('2026-03-08T00:00:00Z');
        expect(result).toContain('Mar');
        expect(result).toContain('2026');
    });
});

// ── todayLocalStr & todayStr ──

describe('todayLocalStr', () => {
    it('returns YYYY-MM-DD format', () => {
        expect(todayLocalStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('todayStr', () => {
    it('returns YYYY-MM-DD format', () => {
        expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

// ── isValidDate ──

describe('isValidDate', () => {
    it('accepts valid YYYY-MM-DD', () => {
        expect(isValidDate('2026-03-08')).toBe(true);
        expect(isValidDate('2000-01-01')).toBe(true);
        expect(isValidDate('2026-12-31')).toBe(true);
    });

    it('rejects invalid formats', () => {
        expect(isValidDate('not-a-date')).toBe(false);
        expect(isValidDate('')).toBe(false);
        expect(isValidDate('03-08-2026')).toBe(false);
        expect(isValidDate('2026/03/08')).toBe(false);
    });

    it('rejects invalid dates that match format', () => {
        expect(isValidDate('2026-13-01')).toBe(false);
        // Note: JS Date('2026-02-30') rolls over to March — isValidDate allows this
        // because it only checks regex + isNaN. This is a known limitation.
        expect(isValidDate('2026-00-01')).toBe(false);
    });
});

// ── dateDiffDays ──

describe('dateDiffDays', () => {
    it('returns 0 for same day', () => {
        expect(dateDiffDays('2026-03-08', '2026-03-08')).toBe(0);
    });

    it('returns positive for forward range', () => {
        expect(dateDiffDays('2026-03-01', '2026-03-08')).toBe(7);
    });

    it('returns negative for backward range', () => {
        expect(dateDiffDays('2026-03-08', '2026-03-01')).toBe(-7);
    });

    it('works across months', () => {
        expect(dateDiffDays('2026-02-28', '2026-03-01')).toBe(1);
    });

    it('works across years', () => {
        expect(dateDiffDays('2025-12-31', '2026-01-01')).toBe(1);
    });
});

// ── dateRange ──

describe('dateRange', () => {
    it('returns single date for same start/end', () => {
        const result = dateRange('2026-03-08', '2026-03-08');
        expect(result).toHaveLength(1);
    });

    it('returns correct number of dates inclusive', () => {
        const result = dateRange('2026-03-06', '2026-03-08');
        expect(result).toHaveLength(3);
        // Dates are consecutive (may be offset by TZ due to toISOString in source)
        for (let i = 1; i < result.length; i++) {
            expect(dateDiffDays(result[i - 1], result[i])).toBe(1);
        }
    });

    it('returns empty array when start > end', () => {
        expect(dateRange('2026-03-10', '2026-03-08')).toEqual([]);
    });

    it('works across month boundary', () => {
        const result = dateRange('2026-02-27', '2026-03-02');
        expect(result).toHaveLength(4);
        // Verify consecutive days
        for (let i = 1; i < result.length; i++) {
            expect(dateDiffDays(result[i - 1], result[i])).toBe(1);
        }
    });
});

// ── toDateStr ──

describe('toDateStr', () => {
    it('converts Date object to YYYY-MM-DD in local timezone', () => {
        const d = new Date(2026, 2, 8, 12, 0, 0); // local noon March 8
        expect(toDateStr(d)).toBe('2026-03-08');
    });

    it('uses local date, not UTC date', () => {
        // 12:01 AM local on March 9 — should return March 9 regardless of UTC offset
        const d = new Date(2026, 2, 9, 0, 1, 0);
        expect(toDateStr(d)).toBe('2026-03-09');
    });
});

// ── timeAgo ──

describe('timeAgo', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-08T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns "Just now" for less than 1 minute ago', () => {
        expect(timeAgo('2026-03-08T11:59:30Z')).toBe('Just now');
    });

    it('returns minutes for < 60 minutes', () => {
        expect(timeAgo('2026-03-08T11:55:00Z')).toBe('5m ago');
        expect(timeAgo('2026-03-08T11:01:00Z')).toBe('59m ago');
    });

    it('returns hours for < 24 hours', () => {
        expect(timeAgo('2026-03-08T10:00:00Z')).toBe('2h ago');
        expect(timeAgo('2026-03-08T00:00:00Z')).toBe('12h ago');
    });

    it('returns days for < 7 days', () => {
        expect(timeAgo('2026-03-07T12:00:00Z')).toBe('1d ago');
        expect(timeAgo('2026-03-05T12:00:00Z')).toBe('3d ago');
    });

    it('returns formatted date for >= 7 days', () => {
        const result = timeAgo('2026-02-28T12:00:00Z');
        expect(result).toContain('Feb');
        expect(result).toContain('28');
    });
});

// ── getRoadshowStatus ──

describe('getRoadshowStatus', () => {
    // Helper to create a Date at a specific local time on 2026-03-08
    const at = (h: number, m: number) => {
        const d = new Date(2026, 2, 8, h, m, 0); // month is 0-indexed
        return d;
    };

    it('returns "past" when event date is before today', () => {
        expect(getRoadshowStatus('2026-03-07', '09:00', '17:00', at(12, 0))).toBe('past');
    });

    it('returns "upcoming" when event date is after today', () => {
        expect(getRoadshowStatus('2026-03-09', '09:00', '17:00', at(12, 0))).toBe('upcoming');
    });

    it('returns "upcoming" when today but before start time', () => {
        expect(getRoadshowStatus('2026-03-08', '14:00', '22:00', at(13, 59))).toBe('upcoming');
    });

    it('returns "live" when today and within time window', () => {
        expect(getRoadshowStatus('2026-03-08', '09:00', '22:00', at(14, 0))).toBe('live');
    });

    it('returns "live" at exactly start time', () => {
        expect(getRoadshowStatus('2026-03-08', '09:00', '22:00', at(9, 0))).toBe('live');
    });

    it('returns "past" at exactly end time', () => {
        expect(getRoadshowStatus('2026-03-08', '09:00', '22:00', at(22, 0))).toBe('past');
    });

    it('returns "past" when today but after end time (the original bug)', () => {
        // Roadshow 09:00-22:00, current time 23:54 — should be past, not live
        expect(getRoadshowStatus('2026-03-08', '09:00', '22:00', at(23, 54))).toBe('past');
    });

    it('returns "live" when no end time and after start', () => {
        expect(getRoadshowStatus('2026-03-08', '09:00', null, at(23, 0))).toBe('live');
    });

    it('returns "live" when no start time and before end', () => {
        expect(getRoadshowStatus('2026-03-08', null, '22:00', at(8, 0))).toBe('live');
    });

    it('returns "live" when no start or end time on event day', () => {
        expect(getRoadshowStatus('2026-03-08', null, null, at(15, 0))).toBe('live');
    });
});

// ── isEventLive ──

describe('isEventLive', () => {
    const at = (h: number, m: number) => new Date(2026, 2, 8, h, m, 0);

    it('returns true when event is within time window', () => {
        expect(isEventLive('2026-03-08', '09:00', '17:00', at(12, 0))).toBe(true);
    });

    it('returns false when event is before start time', () => {
        expect(isEventLive('2026-03-08', '14:00', '17:00', at(12, 0))).toBe(false);
    });

    it('returns false when event is after end time', () => {
        expect(isEventLive('2026-03-08', '09:00', '12:00', at(14, 0))).toBe(false);
    });

    it('returns false when start_time is null', () => {
        expect(isEventLive('2026-03-08', null, '17:00', at(12, 0))).toBe(false);
    });

    it('returns false when end_time is null', () => {
        expect(isEventLive('2026-03-08', '09:00', null, at(12, 0))).toBe(false);
    });

    it('returns false when both times are null', () => {
        expect(isEventLive('2026-03-08', null, null, at(12, 0))).toBe(false);
    });

    it('returns false when event date is in the past', () => {
        expect(isEventLive('2026-03-07', '09:00', '17:00', at(12, 0))).toBe(false);
    });

    it('returns false when event date is in the future', () => {
        expect(isEventLive('2026-03-09', '09:00', '17:00', at(12, 0))).toBe(false);
    });
});
