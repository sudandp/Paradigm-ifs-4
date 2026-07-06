import * as fs from 'fs';

const settings = JSON.parse(fs.readFileSync('scratch/raw_settings.json', 'utf8'));

function findPaths(obj: any, targetKey: string, currentPath: string = ''): string[] {
    const paths: string[] = [];
    if (!obj || typeof obj !== 'object') return paths;

    for (const key in obj) {
        const path = currentPath ? `${currentPath}.${key}` : key;
        if (key === targetKey) {
            paths.push(path);
        }
        if (typeof obj[key] === 'object') {
            paths.push(...findPaths(obj[key], targetKey, path));
        }
    }
    return paths;
}

console.log("Paths to missed_checkout_config:", findPaths(settings, 'missed_checkout_config'));
console.log("Paths to missedCheckoutConfig:", findPaths(settings, 'missedCheckoutConfig'));
console.log("Paths to role_mapping:", findPaths(settings, 'role_mapping'));
console.log("Paths to roleMapping:", findPaths(settings, 'roleMapping'));
