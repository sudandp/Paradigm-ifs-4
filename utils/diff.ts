/**
 * Simple diff utility to compare two objects and return only the changed fields.
 * Returns an object where each key is a field name, and the value is { old: any, new: any }
 */
export const getObjectDiff = (oldObj: any, newObj: any): Record<string, { old: any; new: any }> => {
    const diff: Record<string, { old: any; new: any }> = {};
    
    // We only care about keys in the new object (or those that were in the old)
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    
    // Fields to exclude from diffing (metadata, IDs, etc.)
    const excludeFields = ['id', 'createdAt', 'updatedAt', 'sNo', 'revisionCount', 'createdBy', 'createdByName', 'createdByRole'];

    allKeys.forEach(key => {
        if (excludeFields.includes(key)) return;

        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];

        // Simple equality check (works for strings, numbers, booleans)
        // For dates, we might need more specific handling but standard toString/ISO compares usually suffice for trackers
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            // Only add if it's actually different (null vs undefined check)
            if (!(oldVal == null && newVal == null)) {
                diff[key] = {
                    old: oldVal,
                    new: newVal
                };
            }
        }
    });

    return diff;
};

/**
 * Formats a field name into a human-readable label
 */
export const formatFieldLabel = (field: string): string => {
    return field
        .replace(/([A-Z])/g, ' $1') // insert a space before all caps
        .replace(/^./, (str) => str.toUpperCase()) // capitalize the first letter
        .trim();
};
