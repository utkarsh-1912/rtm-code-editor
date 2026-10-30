/* eslint-disable */
/*
 * Vendored from Breakscale (https://github.com/xevrion/breakscale), src/sim/,
 * commit c58de51, compiled from TypeScript to JavaScript. Do not edit by hand.
 *
 * MIT License. Copyright (c) 2026 Breakscale contributors.
 * Full licence text: ./LICENSE
 */
/** Keyspace the engine draws request keys from; mirrored here for sizing. */
const KEYSPACE = 64;
function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
/** Read an optional config number, treating absent/NaN as `fallback`. */
function num(v, fallback) {
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
/* ================================================================== *
 * objectstore -- blob storage (S3-like)
 *
 * A wide flat-latency pool with one mechanism of its own: PER-PREFIX rate
 * ceilings. A blob store partitions its keyspace by prefix and each
 * partition sustains `prefixRps` on its own; a request that finds its
 * prefix over the ceiling is refused instantly with a SlowDown
 * ('throttled'), while the rest of the store idles. That is the S3 503,
 * and it is why blob-store performance advice is about key LAYOUT --
 * spread your prefixes -- rather than about capacity. The gate consumes
 * zero randomness (a continuous token bucket per prefix, refilled against
 * simulated time exactly like the rate limiter); requests that pass it
 * are served on the engine's ordinary wide slot pool.
 *
 * No instance model and no scaleField: it is a managed service, one
 * logical thing an autoscaler has no business resizing -- which is itself
 * part of the lesson, because when a prefix melts there is no "add
 * servers" knob to reach for.
 * ================================================================== */
/**
 * Fixed prefix count the 64-key keyspace folds onto. A constant rather
 * than a knob: the lesson lives in `prefixRps` and in the key layout of
 * the traffic, not in how many prefixes exist.
 */
const OBJECT_PREFIXES = 8;
function objectPrefixRate(state) {
    const r = state.config.prefixRps;
    return r !== undefined && r > 0 ? r : 0;
}
/** Bring ONE prefix's bucket up to date with simulated time. */
function objectRefill(ext, prefix, rate, now) {
    if (rate !== ext.lastRate) {
        // The ceiling moved: re-cap every bucket rather than letting one filled
        // under the old ceiling stay oversized.
        for (let p = 0; p < OBJECT_PREFIXES; p++) {
            if (ext.tokens[p] > rate)
                ext.tokens[p] = rate;
        }
        ext.lastRate = rate;
    }
    const elapsed = now - ext.lastRefillMs[prefix];
    if (elapsed <= 0)
        return;
    ext.lastRefillMs[prefix] = now;
    ext.tokens[prefix] += (elapsed / 1000) * rate;
    if (ext.tokens[prefix] > rate)
        ext.tokens[prefix] = rate;
}
const objectstore = {
    kind: 'objectstore',
    servesRequests: true,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'own',
    creditsJoinCompletion: true,
    initState(state) {
        const rate = objectPrefixRate(state);
        const tokens = new Float64Array(OBJECT_PREFIXES);
        // Buckets start full, like every other token bucket in the app: an idle
        // store absorbs one burst per prefix before the ceiling bites.
        tokens.fill(rate > 0 ? rate : 0);
        return { tokens, lastRefillMs: new Float64Array(OBJECT_PREFIXES), lastRate: rate };
    },
    onAdmit(ctx, state, req) {
        const rate = objectPrefixRate(state);
        // No ceiling configured: a plain wide pool, exactly the old behaviour.
        if (rate <= 0)
            return 'serve';
        const ext = state.ext;
        const prefix = ((req.key % OBJECT_PREFIXES) + OBJECT_PREFIXES) % OBJECT_PREFIXES;
        objectRefill(ext, prefix, rate, ctx.now);
        if (ext.tokens[prefix] < 1) {
            ctx.countCustom(state, 'slowdown', 1);
            ctx.reject(state, req, 'throttled');
            return 'handled';
        }
        ext.tokens[prefix] -= 1;
        return 'serve';
    },
    decorateStats(ctx, state, stats) {
        stats.slowdownRate = ctx.counterRate(state, 'slowdown');
    },
};
const coldDrained = (_ctx, state, _req) => {
    const ext = state.ext;
    if (ext.jobs > 0)
        ext.jobs--;
};
const coldstorage = {
    kind: 'coldstorage',
    servesRequests: true,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    // No queue and no engine slots: jobs are tracked in ext, timed by
    // serveWithin, and the only admission outcomes are "job started" and
    // "refused". queueLimit is ignored, because a vault has no line to wait in.
    pump: 'none',
    creditsJoinCompletion: true,
    initState: () => ({ jobs: 0 }),
    onAdmit(ctx, state, req) {
        const ext = state.ext;
        if (ext.jobs >= ctx.effectiveCapacity(state)) {
            ctx.countCustom(state, 'restoreDenied', 1);
            ctx.reject(state, req, 'throttled');
            return 'handled';
        }
        ext.jobs++;
        ctx.serveWithin(state, req, coldDrained);
        return 'handled';
    },
    onTick(ctx, state) {
        const ext = state.ext;
        ctx.reportOccupancy(state, ext.jobs, ctx.effectiveCapacity(state));
    },
    decorateStats(ctx, state, stats) {
        const ext = state.ext;
        stats.inFlight = ext ? ext.jobs : 0;
        stats.queued = 0;
        stats.throttledRate = ctx.counterRate(state, 'restoreDenied');
    },
};
function poolExt(state) {
    return state.ext;
}
/**
 * Build the drain-and-pump callback for one kind. `onStart` runs just
 * before a request's service time begins (where staleness is judged and
 * served-class counters are booked); `onServed` runs when its service
 * time has elapsed (where a write's commit takes effect).
 */
function makeDrained(onStart, onServed) {
    const drained = (ctx, state, req) => {
        const ext = poolExt(state);
        if (ext.busy > 0)
            ext.busy--;
        // Measured cost booking: `served` is queries, `servedMs` is the actual
        // milliseconds each one took (surcharges included), so a mean cost
        // readout is measurement rather than arithmetic on the config.
        ctx.countCustom(state, 'served', 1);
        ctx.countCustom(state, 'servedMs', req.ownMs);
        if (onServed)
            onServed(ctx, state, req);
        // Pump: start whatever is waiting, up to capacity. Requests that
        // resolved while queued are skipped without occupying a slot, the same
        // rule the engine's own pumpQueue applies.
        const q = ext.queue;
        while (ext.busy < ctx.effectiveCapacity(state) && ext.head < q.length) {
            const next = q[ext.head];
            q[ext.head] = null;
            ext.head++;
            if (ext.head > 64 && ext.head * 2 >= q.length) {
                q.splice(0, ext.head);
                ext.head = 0;
            }
            if (!next)
                continue;
            startPoolService(ctx, state, next, onStart, drained);
        }
    };
    return drained;
}
function startPoolService(ctx, state, req, onStart, drained) {
    const ext = poolExt(state);
    ext.busy++;
    if (onStart)
        onStart(ctx, state, req);
    ctx.serveWithin(state, req, drained);
}
/** The shared admission path: classify, then slot-or-queue-or-shed. */
function poolAdmit(ctx, state, req, classify, onStart, drained) {
    const ext = poolExt(state);
    classify(ctx, state, req);
    if (ext.busy < ctx.effectiveCapacity(state)) {
        startPoolService(ctx, state, req, onStart, drained);
        return 'handled';
    }
    if (ext.queue.length - ext.head >= ctx.effectiveQueueLimit(state))
        return 'shed';
    ext.queue.push(req);
    return 'handled';
}
function initPool() {
    return { busy: 0, queue: [], head: 0 };
}
/** Occupancy publishing shared by every pooled kind (see replica for why). */
function reportPool(ctx, state) {
    ctx.reportOccupancy(state, poolExt(state).busy, ctx.effectiveCapacity(state));
}
function decoratePool(state, stats) {
    const ext = poolExt(state);
    stats.inFlight = ext.busy;
    stats.queued = ext.queue.length - ext.head;
}
/** Measured mean ms per served request over the window, or 0 when idle. */
function meanServedMs(ctx, state) {
    const served = ctx.counterRate(state, 'served');
    if (!(served > 0))
        return 0;
    const ms = ctx.counterRate(state, 'servedMs') / served;
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
}
function dbClassify(ctx, state, req) {
    const isWrite = ctx.roll() >= clamp01(num(state.config.readFraction, 0.9));
    ctx.markWrite(req, isWrite);
}
/**
 * At service start: judge contention against the writers holding slots at
 * this moment (not at admission -- a write that waited in the queue meets
 * the lock as it actually is when its turn comes).
 */
const dbStart = (ctx, state, req) => {
    ctx.countCustom(state, req.isWrite ? 'write' : 'read', 1);
    if (!req.isWrite)
        return;
    const ext = state.ext;
    const lockMs = Math.max(0, num(state.config.lockMs, 0));
    const wait = lockMs * ext.writers;
    if (wait > 0) {
        ctx.addServiceDelay(req, wait);
        ctx.countCustom(state, 'lockWaitMs', wait);
    }
    ext.writers++;
};
const dbDrained = makeDrained(dbStart, (_ctx, state, req) => {
    if (!req.isWrite)
        return;
    const ext = state.ext;
    if (ext.writers > 0)
        ext.writers--;
});
const db = {
    kind: 'db',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: true,
    initState: () => ({ ...initPool(), writers: 0 }),
    onAdmit(ctx, state, req) {
        return poolAdmit(ctx, state, req, dbClassify, dbStart, dbDrained);
    },
    onTick: reportPool,
    decorateStats(ctx, state, stats) {
        decoratePool(state, stats);
        const writes = ctx.counterRate(state, 'write');
        stats.readRate = ctx.counterRate(state, 'read');
        stats.writeRate = writes;
        const waited = ctx.counterRate(state, 'lockWaitMs');
        const mean = writes > 0 ? waited / writes : 0;
        stats.lockWaitMs = Number.isFinite(mean) && mean > 0 ? mean : 0;
    },
};
const searchDrained = makeDrained(
// At service start: a SEARCH is judged against the index it is actually
// reading right now. Judged here rather than at admission so a query
// that waited in line long enough for the refresh to land counts fresh,
// which is exactly how a real cluster behaves.
(ctx, state, req) => {
    if (req.isWrite)
        return;
    const ext = state.ext;
    const stale = ctx.now < ext.visibleAt[req.key % KEYSPACE];
    ctx.countCustom(state, stale ? 'staleSearch' : 'freshSearch', 1);
}, 
// At service end: the write has committed, so the refresh clock starts
// HERE. The admission-time claim below was only a lower bound.
(ctx, state, req) => {
    if (!req.isWrite)
        return;
    const ext = state.ext;
    const lag = Math.max(0, num(state.config.indexLagMs, 0));
    const key = req.key % KEYSPACE;
    const visible = ctx.now + lag;
    if (visible > ext.visibleAt[key])
        ext.visibleAt[key] = visible;
});
// The onStart hook runs inside searchDrained's pump as well; capture it once
// so admission and pump judge staleness identically.
const searchStart = (ctx, state, req) => {
    if (req.isWrite)
        return;
    const ext = state.ext;
    const stale = ctx.now < ext.visibleAt[req.key % KEYSPACE];
    ctx.countCustom(state, stale ? 'staleSearch' : 'freshSearch', 1);
};
function searchClassify(ctx, state, req) {
    // One unconditional draw decides search vs write, the same convention the
    // replica set uses for read vs write.
    const isWrite = ctx.roll() >= clamp01(num(state.config.readFraction, 0.9));
    ctx.markWrite(req, isWrite);
    if (isWrite) {
        // Writes pay the indexing surcharge on top of the drawn serviceMs.
        ctx.addServiceDelay(req, Math.max(0, num(state.config.indexMs, 0)));
        ctx.countCustom(state, 'indexWrite', 1);
        // Claim a lower-bound searchability deadline immediately: a zero-ms
        // service completes synchronously inside serveWithin, so waiting for
        // the commit alone would let a same-instant search read a write that
        // has not even been acknowledged yet. Pushed to its true value (commit
        // time + lag) in the onServed hook above.
        const ext = state.ext;
        const lag = Math.max(0, num(state.config.indexLagMs, 0));
        const key = req.key % KEYSPACE;
        const visible = ctx.now + lag;
        if (visible > ext.visibleAt[key])
            ext.visibleAt[key] = visible;
    }
}
const searchindex = {
    kind: 'searchindex',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: true,
    initState() {
        const visibleAt = new Float64Array(KEYSPACE);
        visibleAt.fill(-Infinity);
        return { ...initPool(), visibleAt };
    },
    onAdmit(ctx, state, req) {
        return poolAdmit(ctx, state, req, searchClassify, searchStart, searchDrained);
    },
    onTick: reportPool,
    decorateStats(ctx, state, stats) {
        decoratePool(state, stats);
        const fresh = ctx.counterRate(state, 'freshSearch');
        const stale = ctx.counterRate(state, 'staleSearch');
        const total = fresh + stale;
        stats.searchRate = total;
        stats.staleSearchRate = total > 0 ? stale / total : 0;
        stats.indexWriteRate = ctx.counterRate(state, 'indexWrite');
    },
};
/* ================================================================== *
 * timeseriesdb -- cheap appends, expensive range queries
 *
 * An append costs only the drawn serviceMs (fractions of the cost of a
 * row in a relational store); a range query pays `rangeQueryMs` on top,
 * for scanning and aggregating many points. A few percent of range
 * queries dominates the pool, which is the argument for keeping metrics
 * out of the main database stated as arithmetic.
 * ================================================================== */
const tsdbStart = (ctx, state, req) => {
    // Appends were marked as writes in classify; count what is actually
    // being SERVED, so the readout matches throughput rather than arrivals.
    ctx.countCustom(state, req.isWrite ? 'append' : 'rangeQuery', 1);
};
const tsdbDrained = makeDrained(tsdbStart, null);
function tsdbClassify(ctx, state, req) {
    // One unconditional draw: is this a range query? Taken whatever the
    // slider says, so replay does not depend on its value.
    const isRange = ctx.roll() < clamp01(num(state.config.rangeQueryFraction, 0));
    ctx.markWrite(req, !isRange);
    if (isRange) {
        ctx.addServiceDelay(req, Math.max(0, num(state.config.rangeQueryMs, 0)));
    }
}
const timeseriesdb = {
    kind: 'timeseriesdb',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: true,
    initState: initPool,
    onAdmit(ctx, state, req) {
        return poolAdmit(ctx, state, req, tsdbClassify, tsdbStart, tsdbDrained);
    },
    onTick: reportPool,
    decorateStats(ctx, state, stats) {
        decoratePool(state, stats);
        stats.appendRate = ctx.counterRate(state, 'append');
        stats.rangeQueryRate = ctx.counterRate(state, 'rangeQuery');
    },
};
/* ================================================================== *
 * graphdb -- traversal cost grows with depth
 *
 * Edges visited grow roughly with outDegree^depth, so with the modelled
 * mean out-degree of 3 a query costs serviceMs * 3^(depth-1): depth 1 is
 * one neighbourhood, depth 2 (friends-of-friends) is 3x, depth 3 is 9x.
 * The multiplier is applied as a deterministic surcharge on top of the
 * drawn serviceMs, so the depth slider moves the mean without touching
 * the variance shape.
 * ================================================================== */
/** Modelled mean out-degree per hop. Fixed, so depth is the single knob. */
const GRAPH_FANOUT = 3;
function graphClassify(ctx, state, req) {
    const depth = Math.max(1, Math.floor(num(state.config.traversalDepth, 1)));
    const base = Math.max(0, state.config.serviceMs);
    const mult = Math.pow(GRAPH_FANOUT, Math.min(depth, 8) - 1);
    ctx.addServiceDelay(req, base * (mult - 1));
}
const graphDrained = makeDrained(null, null);
const graphdb = {
    kind: 'graphdb',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: true,
    initState: initPool,
    onAdmit(ctx, state, req) {
        return poolAdmit(ctx, state, req, graphClassify, null, graphDrained);
    },
    onTick: reportPool,
    decorateStats(ctx, state, stats) {
        decoratePool(state, stats);
        stats.traversalCostMs = meanServedMs(ctx, state);
    },
};
/* ================================================================== *
 * vectordb -- embedding search over a large index
 *
 * Cost model: an ANN index probes log2(2 + indexSizeK) partitions, and
 * the recall target multiplies how much of each partition must actually
 * be scanned, as 1 / (1 - recall). So mean query cost is
 *
 *   serviceMs * log2(2 + indexSizeK) / (1 - recallTarget)
 *
 * and the two knobs move it independently: growing the corpus is a
 * logarithm, chasing the last point of recall is a hyperbola. Recall is
 * clamped to 0.99, where the multiplier is already 100x.
 * ================================================================== */
function vectorClassify(ctx, state, req) {
    const sizeK = Math.max(0, num(state.config.indexSizeK, 0));
    const recall = Math.min(0.99, Math.max(0, num(state.config.recallTarget, 0)));
    const base = Math.max(0, state.config.serviceMs);
    const mult = Math.log2(2 + sizeK) / (1 - recall);
    if (mult > 1)
        ctx.addServiceDelay(req, base * (mult - 1));
}
const vectorDrained = makeDrained(null, null);
const vectordb = {
    kind: 'vectordb',
    servesRequests: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: true,
    initState: initPool,
    onAdmit(ctx, state, req) {
        return poolAdmit(ctx, state, req, vectorClassify, null, vectorDrained);
    },
    onTick: reportPool,
    decorateStats(ctx, state, stats) {
        decoratePool(state, stats);
        stats.queryCostMs = meanServedMs(ctx, state);
    },
};
export const STORE_BEHAVIOURS = [
    db,
    objectstore,
    searchindex,
    timeseriesdb,
    graphdb,
    coldstorage,
    vectordb,
];
