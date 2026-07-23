import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/audit_results.json', 'utf8'));

console.log(`Total users with records/issues: ${data.length}`);

const criticalUsers = data.filter((u: any) => u.issues.some((i: string) => i.includes('CRITICAL')));
const pendingUsers = data.filter((u: any) => u.issues.some((i: string) => i.includes('PENDING')));
const warningUsers = data.filter((u: any) => u.issues.some((i: string) => i.includes('WARNING')));
const missingLogUsers = data.filter((u: any) => u.issues.some((i: string) => i.includes('NOTICE')));

console.log(`\n--- CRITICAL ISSUES (Negative Balance: Taken > Earned) (${criticalUsers.length}) ---`);
criticalUsers.forEach((u: any) => {
    console.log(`User: ${u.name} (${u.email}) | Role: ${u.role}`);
    console.log(`  Opening: ${u.openingBalance} | Earned: ${u.dynamicEarnedDays} | Used: ${u.compOffDaysUsed} | Net: ${u.netSystemBalance}`);
    console.log(`  Issues:`, u.issues);
});

console.log(`\n--- PENDING REQUESTS (${pendingUsers.length}) ---`);
pendingUsers.forEach((u: any) => {
    console.log(`User: ${u.name} (${u.email}) | Pending: ${u.compOffDaysPending}d`);
});

console.log(`\n--- WARNINGS (${warningUsers.length}) ---`);
warningUsers.forEach((u: any) => {
    console.log(`User: ${u.name} (${u.email}) | Warnings:`, u.issues.filter((i: string) => i.includes('WARNING')));
});
