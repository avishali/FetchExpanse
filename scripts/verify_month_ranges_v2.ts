
// Minimal standalone test for getMonthRange logic
// Copy-pasting the logic since we can't easily import renderer TS in ts-node without setup
function getMonthRange(year: number, monthIndex: number) {
    const from = new Date(year, monthIndex, 1);
    const toInclusive = new Date(year, monthIndex + 1, 0);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        return `${y}-${pad(m)}-${pad(day)}`;
    };

    return {
        fromStr: fmt(from),
        toInclusiveStr: fmt(toInclusive),
        days: toInclusive.getDate()
    };
}

const tests = [
    { y: 2024, m: 1, name: 'Feb 2024 (Leap)', exp: 29, end: '2024-02-29' },
    { y: 2025, m: 1, name: 'Feb 2025', exp: 28, end: '2025-02-28' },
    { y: 2025, m: 10, name: 'Nov 2025', exp: 30, end: '2025-11-30' },
    { y: 2025, m: 11, name: 'Dec 2025', exp: 31, end: '2025-12-31' },
    { y: 2025, m: 0, name: 'Jan 2025', exp: 31, end: '2025-01-31' },
    { y: 2025, m: 3, name: 'Apr 2025', exp: 30, end: '2025-04-30' }
];

let fail = false;
console.log('Running Month Range Tests (Local Time Logic)...');

tests.forEach(t => {
    const res = getMonthRange(t.y, t.m);
    const passDays = res.days === t.exp;
    const passEnd = res.toInclusiveStr === t.end;
    
    if (passDays && passEnd) {
        console.log(`PASS: ${t.name} -> ${res.days} days, ends ${res.toInclusiveStr}`);
    } else {
        console.error(`FAIL: ${t.name} -> Expected ${t.exp} days ending ${t.end}, got ${res.days} days ending ${res.toInclusiveStr}`);
        fail = true;
    }
});

if (fail) process.exit(1);
console.log('ALL TESTS PASSED');
