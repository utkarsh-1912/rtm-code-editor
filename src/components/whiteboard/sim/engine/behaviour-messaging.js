/* eslint-disable */
/*
 * Vendored from Breakscale (https://github.com/xevrion/breakscale), src/sim/,
 * commit c58de51, compiled from TypeScript to JavaScript. Do not edit by hand.
 *
 * MIT License. Copyright (c) 2026 Breakscale contributors.
 * Full licence text: ./LICENSE
 */
import { clamp01 } from './behaviour';
/**
 * Partitions the broker will keep, capped at the inspector's own maximum.
 *
 * The cap is here rather than at the slider because one ring buffer is
 * allocated per partition, and `partitions` is not one of the nine config
 * numbers `isTopology` checks: a shared link, a `.breakscale` file and a
 * restored session all carry whatever it says into that loop.
 */
const MAX_PARTITIONS = 64;
/**
 * A count from config, floored and held between `min` and `max`.
 *
 * `Infinity` was as much a hole as `NaN`: it is a number and it is not NaN,
 * so it passed the guard, survived `Math.floor`, and reached the loops that
 * build one structure per unit. Those do not fail on it, they simply never
 * finish.
 */
function clampInt(v, min, fallback, max = Number.MAX_SAFE_INTEGER) {
    if (v === undefined || !Number.isFinite(v))
        return fallback;
    const n = Math.floor(v);
    return n < min ? min : n > max ? max : n;
}
/* ================================================================== *
 * streambroker -- a partitioned, replayable log (Kafka-shaped)
 * ================================================================== */
/**
 * WHY THIS IS NOT THE QUEUE. The simple `queue` is one FIFO with one set of
 * competing consumers: a message is taken once and gone. A log is different
 * in every way that matters:
 *
 *  - PARTITIONED: a message lands in `key % partitions`, and order is
 *    preserved per partition, so one consumer group can process at most
 *    `partitions` messages in parallel. Partition count, not consumer
 *    count, is the parallelism ceiling; that is the single most
 *    misunderstood fact about Kafka and it falls straight out of this
 *    model.
 *  - MULTI-READER: every outgoing edge is an independent CONSUMER GROUP
 *    with its own cursor over the same messages. A slow analytics group
 *    falls behind without costing the billing group anything.
 *  - LAG, NOT BACKPRESSURE: producers are acked immediately no matter how
 *    far behind the consumers are. The cost of a slow consumer is invisible
 *    to the producer and shows up only as CONSUMER LAG, the headline
 *    metric here.
 *  - BOUNDED BY RETENTION: `queueLimit` is the log's retention in
 *    messages. A group that falls further behind than that skips forward
 *    and the skipped messages are simply lost to it; nonzero
 *    `retentionDropRate` means "you are not just slow, you are losing
 *    data".
 */
/** Per-partition retention floor, so a many-partition log still holds something. */
const MIN_RETENTION_PER_PARTITION = 16;
/** Hard cap on total retained messages, whatever the slider says. */
const MAX_TOTAL_RETENTION = 65536;
function brokerPartitions(state) {
    return clampInt(state.config.partitions, 1, 4, MAX_PARTITIONS);
}
function brokerRetention(state, partitions) {
    const total = Math.min(Math.max(1, Math.floor(state.config.queueLimit)), MAX_TOTAL_RETENTION);
    return Math.max(MIN_RETENTION_PER_PARTITION, Math.ceil(total / partitions));
}
function makeBrokerGroup(edge, partitions, startAt) {
    const next = new Float64Array(partitions);
    next.set(startAt);
    return {
        edgeId: edge.id,
        targetId: edge.to,
        next,
        inflight: new Uint8Array(partitions),
        done: 0,
        skipped: 0,
        pumping: false,
    };
}
function brokerExt(state) {
    return state.ext;
}
/**
 * Keep the broker's structure in step with its config and wiring.
 *
 * A partition-count change rebuilds the log and resets every cursor to the
 * head; changing the shape of a log discards in-flight position in reality
 * too (a Kafka repartition is a migration, not a slider), and starting the
 * groups caught-up is the least surprising of the honest options. A
 * rewired edge set rebuilds only the groups; a NEW group starts at the
 * current head, which is exactly a new Kafka group starting at 'latest'.
 */
function ensureBroker(state, ext) {
    const partitions = brokerPartitions(state);
    if (partitions !== ext.partitions) {
        const retention = brokerRetention(state, partitions);
        ext.partitions = partitions;
        ext.retention = retention;
        ext.rings = [];
        for (let p = 0; p < partitions; p++)
            ext.rings.push(new Int32Array(retention));
        ext.head = new Float64Array(partitions);
        ext.groups = [];
        ext.groupSig = '\u0000stale'; // force group rebuild below
    }
    const retention = brokerRetention(state, partitions);
    if (retention !== ext.retention) {
        // Retention slider moved: resize the rings. Contents restart empty and
        // cursors snap to head, for the same repartition honesty as above.
        ext.retention = retention;
        for (let p = 0; p < partitions; p++)
            ext.rings[p] = new Int32Array(retention);
        for (const g of ext.groups) {
            g.next.set(ext.head);
            g.inflight.fill(0);
        }
    }
    let sig = '';
    for (let i = 0; i < state.out.length; i++)
        sig += state.out[i].id + '\u0000';
    if (sig !== ext.groupSig) {
        const prev = new Map();
        for (const g of ext.groups)
            prev.set(g.edgeId, g);
        const groups = [];
        for (let i = 0; i < state.out.length; i++) {
            const edge = state.out[i];
            const kept = prev.get(edge.id);
            if (kept && kept.next.length === partitions) {
                kept.targetId = edge.to;
                groups.push(kept);
            }
            else {
                groups.push(makeBrokerGroup(edge, partitions, ext.head));
            }
        }
        ext.groups = groups;
        ext.groupSig = sig;
    }
    return ext;
}
/** Total messages this group still has ahead of it, deliveries in flight included. */
function groupLag(ext, g) {
    let lag = 0;
    for (let p = 0; p < ext.partitions; p++) {
        lag += ext.head[p] - g.next[p];
        lag += g.inflight[p];
    }
    return lag;
}
/**
 * Deliver as much as this group is allowed to have in flight: at most one
 * message per partition, in partition order. Called whenever new messages
 * land and whenever one of the group's deliveries resolves, so delivery is
 * entirely event-driven and never depends on the frame clock.
 */
function pumpGroup(ctx, state, ext, g, edge) {
    // Re-entered from onDownstreamResult while already draining: the active
    // drain loop below will pick the freed partition up on its next pass.
    if (g.pumping)
        return;
    g.pumping = true;
    let progress = true;
    while (progress) {
        progress = false;
        for (let p = 0; p < ext.partitions; p++) {
            if (g.inflight[p] !== 0)
                continue;
            // Skip past anything that already aged out of retention. Those messages
            // are gone for this group; that loss is the retentionDropRate readout.
            const oldest = ext.head[p] - ext.retention;
            if (g.next[p] < oldest) {
                const skipped = oldest - g.next[p];
                g.skipped += skipped;
                ctx.countCustom(state, 'retentionDrop', skipped);
                g.next[p] = oldest;
            }
            if (g.next[p] >= ext.head[p])
                continue;
            const key = ext.rings[p][g.next[p] % ext.retention];
            // Mark the partition in flight BEFORE emitting: an instant-ack
            // consumer resolves the delivery synchronously inside emitDetached,
            // and onDownstreamResult must find the flag set to correlate it
            // (it clears the flag, and this loop's next pass re-fills the slot).
            g.inflight[p] = 1;
            g.next[p] += 1;
            // A cut edge or missing target refuses the emit: the message stays
            // where it is and the group's lag keeps growing, which is exactly what
            // a partitioned broker link looks like from the outside.
            if (!ctx.emitDetached(state, edge, key)) {
                g.inflight[p] = 0;
                g.next[p] -= 1;
                g.pumping = false;
                return;
            }
            if (g.inflight[p] === 0)
                progress = true;
        }
    }
    g.pumping = false;
}
function pumpAllGroups(ctx, state, ext) {
    for (let i = 0; i < ext.groups.length; i++) {
        const edge = state.out[i];
        if (!edge || edge.id !== ext.groups[i].edgeId)
            continue;
        pumpGroup(ctx, state, ext, ext.groups[i], edge);
    }
}
const streambroker = {
    kind: 'streambroker',
    // A broker is a buffer with cursors, not a server: its ack slots mean
    // nothing, and its meaningful backlog is lag, published via decorateStats.
    servesRequests: false,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    // Deliveries join back through this node; crediting them would double-count
    // the broker's throughput, whose honest meaning is the PUBLISH rate booked
    // by the ack path.
    creditsJoinCompletion: false,
    // The whole pacing mechanism: a delivery resolving is what frees its
    // partition and triggers the next one.
    observesOutcome: true,
    // One unit per partition, like a shard: the per-partition backlog is where
    // a hot partition becomes visible.
    instanceModel: 'custom',
    initState(state) {
        const partitions = brokerPartitions(state);
        const retention = brokerRetention(state, partitions);
        const rings = [];
        for (let p = 0; p < partitions; p++)
            rings.push(new Int32Array(retention));
        return {
            partitions,
            rings,
            head: new Float64Array(partitions),
            retention,
            groups: [],
            groupSig: '',
            report: [],
        };
    },
    // A publish is acked after the broker's own (tiny) serviceMs, no matter
    // what the consumers are doing. That decoupling IS the product.
    onAdmit: () => 'passthru',
    onServiceComplete(ctx, state, req) {
        const ext = ensureBroker(state, brokerExt(state));
        const p = ((req.key % ext.partitions) + ext.partitions) % ext.partitions;
        ext.rings[p][ext.head[p] % ext.retention] = req.key;
        ext.head[p] += 1;
        ctx.countCustom(state, 'published', 1);
        pumpAllGroups(ctx, state, ext);
        // The producer's call ends here; deliveries are detached and downstream
        // never sees the publish request itself.
        return 'complete';
    },
    onDownstreamResult(ctx, state, req, ok) {
        const ext = ensureBroker(state, brokerExt(state));
        // Correlate the finished delivery back to its group (by the consumer it
        // landed on) and partition (by the key it carried). At most one delivery
        // per (group, partition) is ever in flight, so the pair identifies it.
        const p = ((req.key % ext.partitions) + ext.partitions) % ext.partitions;
        for (let i = 0; i < ext.groups.length; i++) {
            const g = ext.groups[i];
            if (g.targetId !== req.nodeId || g.inflight[p] === 0)
                continue;
            g.inflight[p] = 0;
            g.done += 1;
            ctx.countCustom(state, 'delivered', 1);
            if (!ok)
                ctx.countCustom(state, 'deliveryFailed', 1);
            const edge = state.out[i];
            if (edge && edge.id === g.edgeId)
                pumpGroup(ctx, state, ext, g, edge);
            return;
        }
    },
    /**
     * Unit p is partition p, filled with the WORST group's backlog in that
     * partition against retention; the partition strip therefore shows where
     * in the keyspace the slow consumer is drowning.
     */
    reportInstances(ctx, state) {
        const ext = ensureBroker(state, brokerExt(state));
        const out = ext.report;
        out.length = ext.partitions;
        for (let p = 0; p < ext.partitions; p++) {
            let worst = 0;
            for (const g of ext.groups) {
                const behind = ext.head[p] - g.next[p] + g.inflight[p];
                if (behind > worst)
                    worst = behind;
            }
            out[p] = clamp01(worst / ext.retention);
        }
        ctx.reportInstances(state, out, 0);
    },
    decorateStats(ctx, state, stats) {
        const ext = ensureBroker(state, brokerExt(state));
        let maxLag = 0;
        let inflight = 0;
        const byGroup = [];
        for (const g of ext.groups) {
            const lag = groupLag(ext, g);
            byGroup.push(lag);
            if (lag > maxLag)
                maxLag = lag;
            for (let p = 0; p < ext.partitions; p++)
                inflight += g.inflight[p];
        }
        stats.consumerLag = maxLag;
        stats.consumerLagByGroup = byGroup;
        stats.deliveryRate = ctx.counterRate(state, 'delivered');
        stats.retentionDropRate = ctx.counterRate(state, 'retentionDrop');
        // The generic meters, told the truth for this kind: the backlog is the
        // worst group's lag (drawn against queueLimit, which is retention), and
        // what is "in flight" is deliveries out at consumers.
        stats.queued = maxLag;
        stats.inFlight = inflight;
    },
};
/* ================================================================== *
 * pubsub -- fan-out of one publish to every subscriber
 * ================================================================== */
/**
 * The lesson is AMPLIFICATION. One publish becomes one delivery per
 * subscriber edge, all detached and all independent: a slow subscriber
 * queues and sheds at its own node without delaying the others or the
 * publisher, but the total work in the system is N times what the
 * publisher thinks it sent. Wiring five subscribers onto a 100 rps
 * publisher quietly makes 500 rps of load, and the deliveryRate readout is
 * that multiplication printed as a number.
 *
 * Unlike the streambroker there is no cursor, no retention and no pacing:
 * delivery is immediate and at-most-once. If a subscriber cannot keep up
 * the excess is shed at the subscriber, not remembered here, which is the
 * honest difference between a topic and a log.
 */
const pubsub = {
    kind: 'pubsub',
    servesRequests: false,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: false,
    onAdmit: () => 'passthru',
    onServiceComplete(ctx, state, req) {
        for (let i = 0; i < state.out.length; i++) {
            if (ctx.emitDetached(state, state.out[i], req.key)) {
                ctx.countCustom(state, 'delivered', 1);
            }
        }
        return 'complete';
    },
    decorateStats(ctx, state, stats) {
        stats.fanout = state.out.length;
        const delivered = ctx.counterRate(state, 'delivered');
        stats.deliveryRate = delivered;
        stats.publishAmplification = delivered;
    },
};
function wsExt(state) {
    return state.ext;
}
function wsOpen(ext) {
    return ext.expiry.length - ext.head;
}
/** Drop every connection whose lifetime has ended, as of `now`. */
function wsExpire(ext, now) {
    const q = ext.expiry;
    while (ext.head < q.length && q[ext.head] <= now)
        ext.head++;
    if (ext.head > 64 && ext.head * 2 >= q.length) {
        q.splice(0, ext.head);
        ext.head = 0;
    }
}
/** Open connections as of `now`, WITHOUT mutating: for pure snapshot reads. */
function wsOpenProjected(ext, now) {
    const q = ext.expiry;
    let head = ext.head;
    while (head < q.length && q[head] <= now)
        head++;
    return q.length - head;
}
const websocket = {
    kind: 'websocket',
    servesRequests: true,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    // Slot bookkeeping is connection-based and lives in `ext`; the engine's
    // busy/waiting pair never sees it, so there is nothing for it to pump.
    pump: 'none',
    creditsJoinCompletion: true,
    // One unit per instance; the waterline is connection occupancy, fed to the
    // engine through reportOccupancy below.
    instanceModel: 'slots',
    scaleField: 'instances',
    initState() {
        return { expiry: [], head: 0 };
    },
    onAdmit(ctx, state, req) {
        const ext = wsExt(state);
        wsExpire(ext, ctx.now);
        const cap = ctx.effectiveCapacity(state);
        if (wsOpen(ext) >= cap) {
            ctx.countCustom(state, 'connRefused', 1);
            ctx.reject(state, req, 'conn-refused');
            return 'handled';
        }
        const holdMs = Math.max(0, state.config.connectionMs ?? 30000);
        ext.expiry.push(ctx.now + holdMs);
        ctx.countCustom(state, 'connected', 1);
        // The HANDSHAKE is served now (serviceMs), and the request continues
        // downstream (session setup, auth) like any other call; the connection
        // slot stays held long after the handshake resolved, which is the whole
        // resource model. Nothing to do on drain: release is time-based.
        ctx.serveWithin(state, req, wsNoopDrain);
        return 'handled';
    },
    onTick(ctx, state) {
        const ext = wsExt(state);
        wsExpire(ext, ctx.now);
        ctx.reportOccupancy(state, wsOpen(ext), ctx.effectiveCapacity(state));
    },
    decorateStats(ctx, state, stats) {
        const ext = wsExt(state);
        const open = wsOpenProjected(ext, ctx.now);
        stats.connectionsOpen = open;
        stats.maxConnections = ctx.effectiveCapacity(state);
        stats.connectRate = ctx.counterRate(state, 'connected');
        stats.connectionRejectRate = ctx.counterRate(state, 'connRefused');
        // The generic in-flight meter means "connections held" here; the
        // handshake count is a detail nobody sizes a gateway by.
        stats.inFlight = open;
    },
};
function wsNoopDrain() {
    // Connection slots are released by time, in wsExpire; the handshake
    // finishing frees nothing.
}
function gwRate(state) {
    const r = state.config.rateLimitRps;
    return r !== undefined && r > 0 ? r : 0;
}
function gwBurst(state) {
    const b = state.config.burst;
    if (b !== undefined && b > 0)
        return b;
    const r = gwRate(state);
    return r > 0 ? r : 1;
}
/** Continuous refill against elapsed simulated time; same math as ratelimiter. */
function gwRefill(ctx, state, b) {
    const burst = gwBurst(state);
    if (burst !== b.lastBurst) {
        if (b.tokens > burst)
            b.tokens = burst;
        b.lastBurst = burst;
    }
    const elapsed = ctx.now - b.lastRefillMs;
    if (elapsed <= 0)
        return;
    b.lastRefillMs = ctx.now;
    const rate = gwRate(state);
    if (rate <= 0)
        return;
    b.tokens += (elapsed / 1000) * rate;
    if (b.tokens > burst)
        b.tokens = burst;
}
/** Bucket level as of now, without mutating: snapshot() must stay pure. */
function gwProjectedTokens(ctx, state, b) {
    const burst = gwBurst(state);
    let tokens = b.tokens > burst ? burst : b.tokens;
    const rate = gwRate(state);
    const elapsed = ctx.now - b.lastRefillMs;
    if (rate > 0 && elapsed > 0) {
        tokens += (elapsed / 1000) * rate;
        if (tokens > burst)
            tokens = burst;
    }
    return tokens;
}
const apigateway = {
    kind: 'apigateway',
    servesRequests: true,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'own',
    creditsJoinCompletion: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    initState: (state) => ({
        tokens: gwBurst(state),
        lastRefillMs: 0,
        lastBurst: gwBurst(state),
    }),
    onAdmit(ctx, state, req) {
        const b = state.ext;
        gwRefill(ctx, state, b);
        if (gwRate(state) > 0) {
            if (b.tokens < 1) {
                ctx.countCustom(state, 'throttled', 1);
                ctx.reject(state, req, 'throttled');
                return 'handled';
            }
            b.tokens -= 1;
        }
        const authFail = clamp01(state.config.authFailRate ?? 0);
        if (authFail > 0 && ctx.roll() < authFail) {
            ctx.countCustom(state, 'authRejected', 1);
            ctx.reject(state, req, 'unauthorized');
            return 'handled';
        }
        ctx.countCustom(state, 'admitted', 1);
        // Real slots and a real queue: auth and routing cost serviceMs each.
        return 'serve';
    },
    // The route table: exactly one backend per request, chosen by edge weight.
    route: () => 'one',
    pickEdge: (ctx, _state, _req, out) => ctx.pickWeightedOrLeastLoaded(out),
    decorateStats(ctx, state, stats) {
        const b = state.ext;
        stats.admittedRate = ctx.counterRate(state, 'admitted');
        stats.throttledRate = ctx.counterRate(state, 'throttled');
        stats.authRejectRate = ctx.counterRate(state, 'authRejected');
        stats.tokens = b ? gwProjectedTokens(ctx, state, b) : 0;
    },
};
function sidecarExt(state) {
    return state.ext;
}
function sidecarOutlierAfter(state) {
    return clampInt(state.config.outlierAfter, 1, 5);
}
function sidecarOpenMs(state) {
    const v = state.config.openMs;
    return v !== undefined && v > 0 ? v : 3000;
}
const sidecar = {
    kind: 'sidecar',
    servesRequests: true,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'own',
    creditsJoinCompletion: true,
    observesOutcome: true,
    instanceModel: 'slots',
    scaleField: 'instances',
    initState: () => ({
        phase: 'closed',
        openedAtMs: 0,
        consecutive: 0,
        probing: false,
        trips: 0,
    }),
    onAdmit(ctx, state, req) {
        const st = sidecarExt(state);
        // Lazy transition on simulated time, exactly like the breaker: the
        // ejection has served its openMs, so the next request may probe.
        if (st.phase === 'open' && ctx.now - st.openedAtMs >= sidecarOpenMs(state)) {
            st.phase = 'half-open';
            st.probing = false;
        }
        if (st.phase === 'open' || (st.phase === 'half-open' && st.probing)) {
            ctx.countCustom(state, 'rejected', 1);
            ctx.reject(state, req, 'rejected');
            return 'handled';
        }
        if (st.phase === 'half-open')
            st.probing = true;
        // The latency tax: real slots, real serviceMs, on every request.
        return 'serve';
    },
    onDownstreamResult(ctx, state, _req, ok) {
        const st = sidecarExt(state);
        if (!ok)
            ctx.countCustom(state, 'upstreamFail', 1);
        if (st.phase === 'half-open') {
            st.probing = false;
            if (ok) {
                st.phase = 'closed';
                st.consecutive = 0;
            }
            else {
                st.phase = 'open';
                st.openedAtMs = ctx.now;
                st.trips += 1;
            }
            return;
        }
        if (st.phase !== 'closed')
            return;
        if (ok) {
            st.consecutive = 0;
            return;
        }
        st.consecutive += 1;
        if (st.consecutive >= sidecarOutlierAfter(state)) {
            st.phase = 'open';
            st.openedAtMs = ctx.now;
            st.consecutive = 0;
            st.trips += 1;
        }
    },
    edgeStateFor(ctx, state, _edge, _index) {
        const st = state.ext;
        if (!st)
            return null;
        const open = st.phase === 'open' && ctx.now - st.openedAtMs < sidecarOpenMs(state);
        return open ? 'blocked' : null;
    },
    decorateStats(ctx, state, stats) {
        const st = state.ext;
        if (!st)
            return;
        const phase = st.phase === 'open' && ctx.now - st.openedAtMs >= sidecarOpenMs(state)
            ? 'half-open'
            : st.phase;
        stats.breakerState = phase;
        stats.breakerTrips = st.trips;
        stats.consecutiveFails = st.consecutive;
        stats.rejectedRate = ctx.counterRate(state, 'rejected');
        stats.upstreamFailRate = ctx.counterRate(state, 'upstreamFail');
    },
};
function lambdaExt(state) {
    return state.ext;
}
function lambdaLimit(state) {
    return clampInt(state.config.maxConcurrency, 1, 40);
}
/** Reclaim warm instances whose keep-alive ended, as of `now`. */
function lambdaReap(ext, now) {
    const q = ext.warmExpiry;
    while (ext.head < q.length && q[ext.head] <= now)
        ext.head++;
    if (ext.head > 64 && ext.head * 2 >= q.length) {
        q.splice(0, ext.head);
        ext.head = 0;
    }
}
/** Warm idle count as of `now` without mutating, for pure snapshot reads. */
function lambdaWarmProjected(ext, now) {
    const q = ext.warmExpiry;
    let head = ext.head;
    while (head < q.length && q[head] <= now)
        head++;
    return q.length - head;
}
const lambda = {
    kind: 'lambda',
    servesRequests: true,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: true,
    // One unit per live instance, busy or warm; the stack GROWS WITH LOAD,
    // which is the one picture that says "serverless" truthfully.
    instanceModel: 'custom',
    initState: () => ({ warmExpiry: [], head: 0, busy: 0 }),
    onAdmit(ctx, state, req) {
        const ext = lambdaExt(state);
        lambdaReap(ext, ctx.now);
        if (ext.busy >= lambdaLimit(state)) {
            ctx.countCustom(state, 'throttled', 1);
            ctx.reject(state, req, 'throttled');
            return 'handled';
        }
        const warm = ext.warmExpiry.length - ext.head;
        if (warm > 0) {
            // Reuse the most recently freed instance (LIFO), leaving the oldest to
            // expire; this is why keep-warm does not accumulate a large fleet.
            ext.warmExpiry.pop();
            ctx.countCustom(state, 'warmStart', 1);
        }
        else {
            ctx.countCustom(state, 'coldStart', 1);
            ctx.addServiceDelay(req, Math.max(0, state.config.coldStartMs ?? 350));
        }
        ext.busy += 1;
        ctx.serveWithin(state, req, onLambdaDrained);
        return 'handled';
    },
    onTick(ctx, state) {
        const ext = lambdaExt(state);
        lambdaReap(ext, ctx.now);
        ctx.reportOccupancy(state, ext.busy, lambdaLimit(state));
    },
    reportInstances(ctx, state) {
        const ext = lambdaExt(state);
        const warm = lambdaWarmProjected(ext, ctx.now);
        // Cap the drawn stack; the badge carries the true count past this.
        const total = Math.min(ext.busy + warm, 64);
        const out = lambdaReport;
        out.length = total;
        for (let i = 0; i < total; i++)
            out[i] = i < ext.busy ? 1 : 0;
        ctx.reportInstances(state, out, 0);
    },
    decorateStats(ctx, state, stats) {
        const ext = lambdaExt(state);
        const cold = ctx.counterRate(state, 'coldStart');
        const warmStarts = ctx.counterRate(state, 'warmStart');
        const started = cold + warmStarts;
        stats.coldStartRate = started > 0 ? cold / started : 0;
        stats.coldStartsPerSec = cold;
        stats.warmIdle = lambdaWarmProjected(ext, ctx.now);
        stats.runningNow = ext.busy;
        stats.inFlight = ext.busy;
        // The 'throttled' counter was already being booked at admission; publish
        // it so the UI can show refusals instead of inferring them from errors.
        stats.throttledRate = ctx.counterRate(state, 'throttled');
    },
};
/** Scratch for the lambda's instance vector; ctx.reportInstances copies it. */
const lambdaReport = [];
function onLambdaDrained(ctx, state, _req) {
    const ext = lambdaExt(state);
    if (ext.busy > 0)
        ext.busy -= 1;
    // The freed instance stays warm for keepWarmMs from THIS moment.
    const keep = Math.max(0, state.config.keepWarmMs ?? 12000);
    ext.warmExpiry.push(ctx.now + keep);
}
function cronExt(state) {
    return state.ext;
}
function cronInterval(state) {
    const v = state.config.intervalMs;
    return v !== undefined && v >= 250
        ? Math.floor(v)
        : v !== undefined && v > 0
            ? 250
            : 20000;
}
/** Requests per edge per firing, bounded so a slider cannot wedge the heap. */
function cronBatch(state) {
    return Math.min(clampInt(state.config.batchSize, 1, 50), 2000);
}
const cron = {
    kind: 'cron',
    servesRequests: false,
    generatesLoad: false,
    pullsFromQueues: false,
    buffersForConsumers: false,
    pump: 'none',
    creditsJoinCompletion: false,
    initState: () => ({ nextFireMs: -1, emitted: 0, keySeq: 0 }),
    // Traffic INTO a cron is a wiring mistake, same as into an autoscaler.
    onAdmit: (ctx, state, req) => {
        ctx.reject(state, req, 'no-route');
        return 'handled';
    },
    onTick(ctx, state) {
        const st = cronExt(state);
        const interval = cronInterval(state);
        if (st.nextFireMs < 0) {
            // First fire one full interval in, so a fresh topology settles first
            // and the burst reads as an event rather than as part of startup.
            st.nextFireMs = ctx.now + interval;
            return;
        }
        if (ctx.now < st.nextFireMs)
            return;
        const batch = cronBatch(state);
        for (let i = 0; i < state.out.length; i++) {
            const edge = state.out[i];
            for (let n = 0; n < batch; n++) {
                if (!ctx.emitDetached(state, edge, st.keySeq))
                    break;
                st.keySeq = (st.keySeq + 1) % 64;
                st.emitted += 1;
            }
        }
        ctx.countCustom(state, 'fired', 1);
        st.nextFireMs = ctx.now + interval;
    },
    decorateStats(ctx, state, stats) {
        const st = state.ext;
        if (!st)
            return;
        stats.nextFireInMs =
            st.nextFireMs < 0 ? cronInterval(state) : Math.max(0, st.nextFireMs - ctx.now);
        stats.batchEmitted = st.emitted;
        // What the next firing will dump downstream, all edges together. A pure
        // read of config and wiring, so the readout can say "burst 150" before
        // the burst ever lands.
        stats.burstSize = cronBatch(state) * state.out.length;
    },
};
/** The behaviours defined in this module, for registration in behaviour.ts. */
export const MESSAGING_BEHAVIOURS = [
    streambroker,
    pubsub,
    websocket,
    apigateway,
    sidecar,
    lambda,
    cron,
];
