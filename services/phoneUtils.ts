/**
 * Normalizes an Indian phone number string down to a standardized 10-digit format.
 * Returns an empty string '' if the input cannot be parsed into a valid 10-digit number.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
        return digits.slice(2);
    }
    if (digits.length === 11 && digits.startsWith('0')) {
        return digits.slice(1);
    }
    if (digits.length === 10) {
        return digits;
    }
    return '';
}
