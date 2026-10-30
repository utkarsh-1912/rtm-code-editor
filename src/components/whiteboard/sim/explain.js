// One line under the load slider that says where the system is struggling, built only
// from the measured snapshot.
import { simKind, isClient, hasCapacity, isSimNode } from "./topology";

const SATURATED = 85; // busy %, from here requests start to wait
const nameOf = (n) => (n.text || "").split("\n")[0].trim() || "This block";
export const fmtRate = (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
export const fmtMs = (v) => (v >= 10000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);

const FIX = {
    db: "add read replicas (instances) or put a cache in front of it",
    cache: "give it more instances or concurrency",
    queue: "add workers behind it, or let each one take more at once",
    worker: "add workers (instances) or cut the time each job takes",
    lb: "raise its concurrency or run more instances",
    cdn: "raise its concurrency or run more instances",
};

export function explain(elements, snap, load) {
    const nodes = elements.filter(isSimNode);
    if (!nodes.some(isClient)) return "Add a Client or User block and connect it to the system to send traffic.";
    if (!snap) return "Measuring…";
    const measured = nodes.filter(hasCapacity).map((n) => ({ n, m: snap.nodes[n.id] })).filter((x) => x.m);
    const unset = nodes.filter((n) => !isClient(n) && !hasCapacity(n)).length;
    if (!measured.length) return "No block has capacity set yet. Select a block and open Properties to give it some.";

    measured.sort((a, b) => b.m.busy - a.m.busy || b.m.waiting - a.m.waiting);
    const { n, m } = measured[0];
    const failing = snap.system.errors >= 0.01 ? ` ${Math.round(snap.system.errors * 100)}% of requests fail.` : "";
    if (m.busy >= SATURATED) {
        const drop = m.shed > 0 ? `, dropping ${fmtRate(m.shed)}/s` : "";
        const fix = FIX[simKind(n)] || "add instances, raise its concurrency or cut its service time";
        return `${nameOf(n)} is ${m.busy}% busy with ${m.waiting} waiting${drop}: requests queue there first. To go further, ${fix}.${failing}`;
    }
    const note = unset ? ` ${unset} block${unset === 1 ? " has" : "s have"} no capacity set and count as instant.` : "";
    return `No bottleneck at ${fmtRate(load)} req/s. Busiest is ${nameOf(n)} at ${m.busy}% busy, p99 ${fmtMs(m.p99)}.${failing}${note}`;
}
