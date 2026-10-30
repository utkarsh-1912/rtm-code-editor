// Board elements -> simulator topology.
//
// Only system-design blocks take part: a node's `kind` (its template id) picks the engine
// component type, and its capacity comes from `node.sim`:
//   { instances, concurrency, serviceMs, cv, queueLimit, timeoutMs, retries, hitRate? }
// A block without `node.sim` has no known capacity. It still passes traffic on (instantly,
// with unlimited room) so the blocks behind it get real load, and the board labels it
// "no capacity set" instead of showing numbers for it.
// Freehand strokes, text and plain flowchart shapes are ignored, and so is any connector
// that touches one of them.
import { defaultConfig } from "./engine/defaults";

// Template id -> engine kind. Kinds whose engine model adds rules the Properties popover
// can't show (API gateway rate limits, object-store prefix limits, search indexing) map to a
// plain service, so every number on the board follows from values people can see.
const KIND = {
    client: "client",
    user: "client",
    lb: "lb",
    gateway: "service",
    service: "service",
    worker: "worker",
    db: "db",
    nosql: "db",
    cache: "cache",
    queue: "queue",
    storage: "service",
    cdn: "cdn",
    external: "service",
    search: "service",
};

export const simKind = (node) => (node?.type === "node" && node.kind ? KIND[node.kind] || null : null);
export const isSimNode = (node) => !!simKind(node);
export const isClient = (node) => simKind(node) === "client";
export const hasHitRate = (node) => ["cache", "cdn"].includes(simKind(node));

// Fields in the Properties popover, in order. Clients only take the caller-side ones.
export const SIM_FIELDS = [
    { key: "instances", label: "Instances", min: 1, max: 512, step: 1, hint: "Copies running (machines, pods)" },
    { key: "concurrency", label: "Concurrency", min: 1, max: 4096, step: 1, hint: "Requests one instance works on at once" },
    { key: "serviceMs", label: "Service time (ms)", min: 0, max: 60000, step: 0.5, hint: "Mean time to handle one request" },
    { key: "cv", label: "Variability", min: 0, max: 4, step: 0.1, hint: "0 = every request takes the same time, 1 = very uneven" },
    { key: "queueLimit", label: "Queue limit", min: 0, max: 100000, step: 1, hint: "Requests that may wait; more are dropped" },
    { key: "hitRate", label: "Hit rate", min: 0, max: 1, step: 0.01, hint: "Share of reads answered without going further", only: hasHitRate },
    { key: "timeoutMs", label: "Timeout (ms)", min: 0, max: 600000, step: 1, hint: "Caller gives up after this; 0 = never" },
    { key: "retries", label: "Retries", min: 0, max: 10, step: 1, hint: "Tries again after a failure or timeout" },
];
const CLIENT_FIELDS = new Set(["timeoutMs", "retries"]);
export const fieldsFor = (node) => SIM_FIELDS.filter((f) => (isClient(node) ? CLIENT_FIELDS.has(f.key) : !f.only || f.only(node)));

// Typical starting values for a block, from the engine's own per-kind defaults.
export function typicalSim(node) {
    const c = defaultConfig(simKind(node) || "service");
    if (isClient(node)) return { timeoutMs: c.timeoutMs, retries: c.retries };
    const sim = { instances: c.instances || 1, concurrency: c.capacity, serviceMs: c.serviceMs, cv: c.serviceCv, queueLimit: c.queueLimit, timeoutMs: c.timeoutMs, retries: c.retries };
    if (hasHitRate(node)) sim.hitRate = c.hitRate;
    return sim;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const hasCapacity = (node) => !isClient(node) && num(node?.sim?.concurrency) != null && num(node?.sim?.serviceMs) != null;

// Room enough that a block without capacity never queues or drops.
const UNLIMITED = { instances: 1, capacity: 100000, serviceMs: 0, serviceCv: 0, queueLimit: 100000, timeoutMs: 0, retries: 0 };

function configFor(node, rps) {
    const kind = simKind(node);
    const base = defaultConfig(kind);
    const s = node.sim || {};
    const pick = (key, fallback) => (num(s[key]) != null ? s[key] : fallback);
    if (kind === "client") {
        return { ...base, rps, timeoutMs: pick("timeoutMs", base.timeoutMs), retries: pick("retries", base.retries) };
    }
    const cfg = hasCapacity(node)
        ? {
            ...base,
            instances: Math.max(1, Math.round(pick("instances", 1))),
            capacity: Math.max(1, Math.round(s.concurrency)),
            serviceMs: Math.max(0, s.serviceMs),
            serviceCv: Math.max(0, pick("cv", base.serviceCv)),
            queueLimit: Math.max(0, Math.round(pick("queueLimit", base.queueLimit))),
            timeoutMs: Math.max(0, pick("timeoutMs", 0)),
            retries: Math.max(0, Math.round(pick("retries", 0))),
        }
        : { ...base, ...UNLIMITED };
    if (hasHitRate(node)) cfg.hitRate = Math.min(1, Math.max(0, pick("hitRate", base.hitRate)));
    return cfg;
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// `load` is the board's total offered req/s, split evenly over its clients.
// Sorted by id: people adding blocks at the same time can end up with them in a different
// order, and the engine's random draws follow node order.
export function toTopology(elements, load) {
    const nodes = elements.filter(isSimNode).sort(byId);
    const ids = new Set(nodes.map((n) => n.id));
    const clients = nodes.filter(isClient).length;
    const rps = clients ? load / clients : 0;
    return {
        nodes: nodes.map((n) => ({ id: n.id, kind: simKind(n), label: "", x: 0, y: 0, config: configFor(n, rps) })),
        edges: elements
            .filter((e) => e.type === "connector" && e.from !== e.to && ids.has(e.from) && ids.has(e.to))
            .map((e) => ({ id: e.id, from: e.from, to: e.to, weight: 1 }))
            .sort(byId),
    };
}
