/* eslint-disable */
/*
 * Vendored from Breakscale (https://github.com/xevrion/breakscale), src/sim/,
 * commit c58de51, compiled from TypeScript to JavaScript. Do not edit by hand.
 *
 * MIT License. Copyright (c) 2026 Breakscale contributors.
 * Full licence text: ./LICENSE
 */
import { DATA_BEHAVIOURS } from './behaviour-data';
import { EDGE_BEHAVIOURS } from './behaviour-edge';
import { CONTROL_BEHAVIOURS } from './behaviour-control';
import { STORE_BEHAVIOURS } from './behaviour-store';
import { MESSAGING_BEHAVIOURS } from './behaviour-messaging';
import { RESILIENCE_BEHAVIOURS } from './behaviour-resilience';
/* ------------------------------------------------------------------ *
 * Behaviour definitions
 * ------------------------------------------------------------------ */
/**
 * A traffic source. Generates root requests at `rps` and hands each one
 * straight downstream; it never queues and never occupies a slot.
 */
const client = {
    kind: 'client',
    servesRequests: true,
    generatesLoad: true,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: false,
    onAdmit: () => 'passthru',
};
/**
 * A dispatcher. Picks exactly one downstream per request: weighted-random when
 * the edge weights differ, least-loaded when they are all equal.
 *
 * Its pool is real. There is no onAdmit, so the engine's default `serve` puts
 * `capacity`, `instances` and `queueLimit` through ordinary slot and queue
 * discipline. `passthru` skipped that, which made all three knobs inert and
 * left an autoscaler writing `instances` with nothing to turn (#52).
 */
const lb = {
    kind: 'lb',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'own',
    creditsJoinCompletion: true,
    route: () => 'one',
    pickEdge: (ctx, _state, _req, out) => ctx.pickWeightedOrLeastLoaded(out),
};
/** A plain server: finite slots, a bounded FIFO, then fan-out to everything. */
const service = {
    kind: 'service',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'own',
    creditsJoinCompletion: true,
};
/**
 * A read-through cache. On a hit it answers immediately; on a miss it falls
 * through to whatever backs it, or answers anyway if nothing is wired up.
 */
const cache = {
    kind: 'cache',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'own',
    creditsJoinCompletion: true,
    onServiceComplete: (ctx, state, _req) => {
        if (ctx.roll() < clamp01(state.config.hitRate)) {
            ctx.countHit(state);
            return 'complete';
        }
        ctx.countMiss(state);
        // No backing store wired up: a miss is still answered, just slowly.
        return state.out.length === 0 ? 'complete' : 'downstream';
    },
};
/* `db` lives in behaviour-store.ts with the other stores: it runs the
 * shared costed pool there, with write lock contention as its own
 * mechanism, and is registered via STORE_BEHAVIOURS below. */
/**
 * A buffer, not a server. It acknowledges the caller immediately (so the
 * caller's chain resolves as a success right there) and parks a detached copy
 * of the message for the workers to drain. Its "busy" count is meaningless, so
 * it reports zero utilisation.
 */
const queue = {
    kind: 'queue',
    servesRequests: false,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: true,
    pump: 'none',
    creditsJoinCompletion: true,
    onAdmit: (ctx, state, req) => {
        if (ctx.queueDepth(state) >= ctx.effectiveQueueLimit(state))
            return 'shed';
        ctx.ackAndBuffer(state, req);
        return 'handled';
    },
};
/**
 * A consumer. It is never pushed to: it pulls the oldest available message
 * across every queue node feeding it, which keeps the draw order deterministic
 * regardless of which queue was written to last.
 */
const worker = {
    kind: 'worker',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: true,
    buffersForConsumers: false,
    pump: 'sources',
    creditsJoinCompletion: true,
};
const ALL = [
    client,
    lb,
    service,
    cache,
    queue,
    worker,
    ...EDGE_BEHAVIOURS,
    ...CONTROL_BEHAVIOURS,
];
// Data-tier kinds (replica, shard) live in their own module: both carry real
// internal machinery, and keeping it there leaves this file declarative.
ALL.push(...DATA_BEHAVIOURS);
// Stores (db, object storage, search, time-series, graph, cold storage,
// vector) likewise: each carries a mechanism of its own, and five of the
// seven run the shared self-managed costed pool.
ALL.push(...STORE_BEHAVIOURS);
// Messaging and coordination kinds (streambroker, pubsub, websocket,
// apigateway, sidecar, lambda, cron): the glue between services. Same deal;
// real machinery lives in its own module, the registry stays declarative.
ALL.push(...MESSAGING_BEHAVIOURS);
// Resilience and delivery kinds (bulkhead, retryqueue, transcoder,
// edgecompute, writebehind, loadshedder): the failure-handling tier.
ALL.push(...RESILIENCE_BEHAVIOURS);
const BY_KIND = new Map();
for (const b of ALL)
    BY_KIND.set(b.kind, b);
/**
 * Resolve a kind's behaviour. Called once per node at buildNodes() time and
 * cached on the node state; never called from the event loop.
 */
export function behaviourFor(kind) {
    const b = BY_KIND.get(kind);
    if (b)
        return b;
    // An unknown kind degrades to plain-server semantics rather than throwing,
    // so a topology saved by a newer build still loads.
    return service;
}
export function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
