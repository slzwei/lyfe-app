/**
 * Tests for lib/phone.ts — SG mobile phone helpers.
 */
import { formatSgPhone, localSgPhone, normalizeSgPhone } from '@/lib/phone';

describe('normalizeSgPhone', () => {
    it('normalizes the accepted input shapes to 65XXXXXXXX', () => {
        expect(normalizeSgPhone('90000000')).toBe('6590000000');
        expect(normalizeSgPhone('+65 9000 0000')).toBe('6590000000');
        expect(normalizeSgPhone('6590000000')).toBe('6590000000');
        expect(normalizeSgPhone('+6590000000')).toBe('6590000000');
        expect(normalizeSgPhone('81234567')).toBe('6581234567');
    });

    it('rejects non-SG, malformed, and empty input', () => {
        expect(normalizeSgPhone('+90000000')).toBeNull();
        expect(normalizeSgPhone('61234567')).toBeNull();
        expect(normalizeSgPhone('1234')).toBeNull();
        expect(normalizeSgPhone('60123456789')).toBeNull();
        expect(normalizeSgPhone('')).toBeNull();
        expect(normalizeSgPhone(null)).toBeNull();
        expect(normalizeSgPhone(undefined)).toBeNull();
    });
});

describe('localSgPhone', () => {
    it('returns the 8-digit local form for valid SG mobiles', () => {
        expect(localSgPhone('6590000000')).toBe('90000000');
        expect(localSgPhone('+65 9000 0000')).toBe('90000000');
    });

    it('returns null for invalid input', () => {
        expect(localSgPhone('+90000000')).toBeNull();
        expect(localSgPhone(null)).toBeNull();
    });
});

describe('formatSgPhone', () => {
    it('formats stored phones as +65 XXXX XXXX', () => {
        expect(formatSgPhone('6590000000')).toBe('+65 9000 0000');
        expect(formatSgPhone('90000000')).toBe('+65 9000 0000');
    });

    it('returns a dash for empty input', () => {
        expect(formatSgPhone(null)).toBe('—');
        expect(formatSgPhone('')).toBe('—');
    });
});
