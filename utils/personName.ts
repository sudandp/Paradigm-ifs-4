type NameParts = {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
} | null | undefined;

/** A name token is valid only if it has letters and no digits (drops mobile numbers, IDs, OCR junk). */
const isValidNameToken = (t: string) => /\p{L}/u.test(t) && !/\d/.test(t);

/**
 * Splits a raw name string into clean tokens:
 * drops tokens containing digits / no letters and removes repeated words
 * ("Savitha 9108826105 Savitha" -> ["Savitha"]).
 */
export const cleanNameTokens = (raw?: string | null): string[] => {
    if (!raw || typeof raw !== 'string') return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tok of raw.trim().split(/\s+/)) {
        const t = tok.replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, ''); // strip stray punctuation at edges
        if (!t || !isValidNameToken(t)) continue;
        const key = t.toLowerCase().replace(/\.$/, '');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(t);
    }
    // Aadhaar OCR often mixes the regional-script name with the English one ("ಸವಿತ Savitha").
    // If any English (Latin) words exist, keep only those.
    const latin = out.filter(t => /^[A-Za-z.'-]+$/.test(t));
    return latin.length > 0 ? latin : out;
};

/** Cleans a single name field (first / middle / last). */
export const cleanNamePart = (raw?: string | null): string => cleanNameTokens(raw).join(' ');

/**
 * Full name as "First Middle Last":
 * skips empty / numeric parts and words already shown
 * (first="Savitha", middle="9108826105", last="Savitha" -> "Savitha").
 */
export const getFullName = (p: NameParts | any): string =>
    cleanNameTokens([p?.firstName, p?.middleName, p?.lastName].filter(s => typeof s === 'string').join(' ')).join(' ');

/** Legacy "First Last" form (no middle name) – used to detect auto-filled values. */
export const getFirstLastName = (p: NameParts | any): string =>
    cleanNameTokens([p?.firstName, p?.lastName].filter(s => typeof s === 'string').join(' ')).join(' ');
