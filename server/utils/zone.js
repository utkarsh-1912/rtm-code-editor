// Wall-clock time in a time zone <-> real instants (no library; uses Intl).
const validZone = (tz) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return 'UTC'; }
};

const parts = (t, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
}).formatToParts(new Date(t)).map((p) => [p.type, p.value]));

// How far `tz` is ahead of UTC at instant `t`, in ms.
const offset = (t, tz) => {
    const p = parts(t, tz);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
};

// Year/month/day + "HH:MM" on the clock in `tz` -> Date.
function zonedTime(y, m, d, hhmm, tz) {
    const [h, mi] = String(hhmm).split(':').map(Number);
    const wall = Date.UTC(y, m - 1, d, h, mi);
    let t = wall - offset(wall, tz);
    t = wall - offset(t, tz);
    return new Date(t);
}

// The calendar date (and weekday) of instant `t` in `tz`.
function dateIn(t, tz) {
    const p = parts(t, tz);
    return { y: +p.year, m: +p.month, d: +p.day, weekday: p.weekday.slice(0, 3).toLowerCase() };
}

module.exports = { validZone, zonedTime, dateIn, offset };
