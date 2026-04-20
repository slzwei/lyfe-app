export function formatSgPhone(raw: string | null | undefined): string {
    if (!raw) return '—';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('65')) {
        return `+65 ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
    if (digits.length === 8) {
        return `+65 ${digits.slice(0, 4)} ${digits.slice(4)}`;
    }
    return raw;
}
