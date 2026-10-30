/* eslint-disable */
/*
 * Vendored from Breakscale (https://github.com/xevrion/breakscale), src/sim/,
 * commit c58de51, compiled from TypeScript to JavaScript. Do not edit by hand.
 *
 * MIT License. Copyright (c) 2026 Breakscale contributors.
 * Full licence text: ./LICENSE
 */
/**
 * Defaults for config fields that only some kinds read.
 *
 * Every `case` below returns a literal for the knobs that kind actually
 * exposes; these fill in the rest. Keeping them in one spread means adding a
 * field to NodeConfig does not force an edit to all the existing cases.
 */
const EXTRA_DEFAULTS = {
    // Every scalable kind starts as a single machine. Present explicitly rather
    // than left undefined so the Inspector has something to show and a student
    // can see that "1" is a choice, not an absence -- the engine treats the two
    // identically.
    instances: 1,
    // replica: a 3-node read replica set, 50ms behind, mostly-read traffic.
    replicaCount: 3,
    replicationLagMs: 50,
    readFraction: 0.9,
    // shard: 4 partitions, keys spread evenly (no hot key) until you make one.
    shardCount: 4,
    shardCapacity: 4,
    hotKeyFraction: 0,
};
/** Sensible starting knobs for a freshly dropped node of each kind. */
export function defaultConfig(kind) {
    return { ...EXTRA_DEFAULTS, ...baseConfig(kind) };
}
/** Per-kind knobs. Fields a kind does not care about come from EXTRA_DEFAULTS. */
function baseConfig(kind) {
    switch (kind) {
        case 'client':
            return {
                capacity: 1,
                serviceMs: 0,
                serviceCv: 0,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 1000,
                retries: 0,
                rps: 50,
            };
        case 'lb':
            return {
                capacity: 256,
                serviceMs: 0.5,
                serviceCv: 0.2,
                queueLimit: 1024,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'service':
            return {
                capacity: 8,
                serviceMs: 25,
                serviceCv: 0.6,
                queueLimit: 64,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'cache':
            return {
                capacity: 32,
                serviceMs: 3,
                serviceCv: 0.4,
                queueLimit: 256,
                hitRate: 0.8,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'db':
            // Reads share the 6 slots; writes (10% at the default readFraction
            // 0.9) also pay 15ms of lock wait per concurrent writer. At the
            // default mix that is a barely-visible tax; raise the write share and
            // watch lockWaitMs climb while adding instances fixes nothing.
            return {
                capacity: 6,
                serviceMs: 30,
                serviceCv: 0.7,
                queueLimit: 32,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                lockMs: 15,
            };
        case 'queue':
            return {
                capacity: 1,
                serviceMs: 1,
                serviceCv: 0.2,
                queueLimit: 5000,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'worker':
            return {
                capacity: 4,
                serviceMs: 25,
                serviceCv: 0.6,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'replica':
            // Reads fan across the replicas, so per-replica capacity is modest.
            return {
                capacity: 4,
                serviceMs: 20,
                serviceCv: 0.6,
                queueLimit: 64,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'shard':
            // Per-shard slots live in shardCapacity; `capacity` is unused here.
            return {
                capacity: 4,
                serviceMs: 25,
                serviceCv: 0.6,
                queueLimit: 32,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'cdn':
            // An edge PoP: very fast, very high hit rate, lots of concurrency.
            // At hitRate 0.92 the origin behind it sees 8% of the offered load.
            return {
                capacity: 256,
                serviceMs: 2,
                serviceCv: 0.3,
                queueLimit: 2048,
                hitRate: 0.92,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'ratelimiter':
            // A doorman: refusing costs nothing, so no service time and no slots.
            // 100 rps sustained with one second of burst headroom.
            return {
                capacity: 1,
                serviceMs: 0,
                serviceCv: 0,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                rateLimitRps: 100,
                burst: 100,
            };
        case 'breaker':
            // Trips once half the downstream calls in a 5s window fail, stays open
            // 3s, then lets 3 probes decide whether to close.
            return {
                capacity: 1,
                serviceMs: 0,
                serviceCv: 0,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                errorThreshold: 0.5,
                windowMs: 5000,
                openMs: 3000,
                halfOpenProbes: 3,
            };
        case 'autoscaler':
            // Adds and removes INSTANCES to hold its target at 70% utilisation,
            // stepping by half the current fleet.
            //
            // THE TIMINGS, on a human scale. A student drags the load slider up and
            // this is what they should see, measured rather than guessed:
            //
            //   t+0.0s  load arrives; utilisation climbs and pins at 1.0
            //   t+~3s   cooldown expires, the controller decides and books machines
            //           (phase 'cooldown' -> 'warming', ghost instances appear)
            //   t+~7s   the machines boot and start serving (warmupMs=4000 later);
            //           utilisation falls back toward the setpoint
            //
            // So: something visibly happens within about three seconds, and the
            // whole arc completes in under ten. 4s of warmup is the balance point.
            // Shorter and the lag stops being legible -- capacity looks like it
            // answers instantly, which teaches the opposite of the truth. Much
            // longer (the previous default was 10s) and a student watching a live
            // graph concludes the component is broken before it ever acts.
            //
            // cooldownMs 3000 < warmupMs 4000 is deliberate and is the documented
            // oscillation regime: the controller can want a second step while the
            // first is still booting. It does not thrash, because a booked scale-up
            // blocks further decisions, but the fleet does hunt around the setpoint
            // rather than settling dead on it -- which is what real ones do.
            return {
                capacity: 1,
                serviceMs: 0,
                serviceCv: 0,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                targetUtil: 0.7,
                // In INSTANCES, not slots: between 1 and 12 machines.
                minCapacity: 1,
                maxCapacity: 12,
                cooldownMs: 3000,
                scaleStepPct: 0.5,
                warmupMs: 4000,
            };
        case 'region':
            // Two regions, serving from the first. The 5s failover is long enough
            // to see as a real outage on the error graph and short enough that a
            // student does not think the simulation has hung.
            return {
                capacity: 1,
                serviceMs: 0,
                serviceCv: 0,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                regions: 2,
                activeRegion: 0,
                failoverMs: 5000,
            };
        case 'objectstore':
            // Blob storage: every request pays a high flat latency, but the pool
            // is wide. 64 slots / 90ms -> ~710 rps of ceiling at ~90ms each,
            // which is "effectively unlimited" next to any database in this app.
            // The real limit is PER PREFIX: 150 rps on each of the 8 key
            // prefixes (~1200 rps spread evenly), and a hot prefix gets SlowDown
            // refusals while the rest of the store idles.
            return {
                capacity: 64,
                serviceMs: 90,
                serviceCv: 0.4,
                queueLimit: 1024,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                prefixRps: 150,
            };
        case 'searchindex':
            // Searches are cheap (8ms); a write pays +60ms of indexing on top and
            // becomes searchable only 1.5s after it commits. At the default 90/10
            // read mix the mean cost is ~14ms -> 12 slots gives ~850 rps.
            return {
                capacity: 12,
                serviceMs: 8,
                serviceCv: 0.5,
                queueLimit: 128,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                indexMs: 60,
                indexLagMs: 1500,
            };
        case 'timeseriesdb':
            // Appends cost 1.5ms; a range query pays +120ms. At 5% range queries
            // the mean is ~7.5ms -> 16 slots gives ~2100 rps of mixed traffic,
            // which is the "metrics firehose" headroom the kind exists to show.
            return {
                capacity: 16,
                serviceMs: 1.5,
                serviceCv: 0.4,
                queueLimit: 1024,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                rangeQueryFraction: 0.05,
                rangeQueryMs: 120,
            };
        case 'graphdb':
            // Depth 2 (friends-of-friends) costs 3x the base 6ms -> 18ms mean,
            // 8 slots -> ~440 rps. Each extra hop of depth divides that by 3.
            return {
                capacity: 8,
                serviceMs: 6,
                serviceCv: 0.5,
                queueLimit: 64,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                traversalDepth: 2,
            };
        case 'coldstorage':
            // Archival: SECONDS per restore JOB, a hard quota of 24 concurrent
            // jobs (24 / 2.8s is ~8.5 rps of ceiling), and NO queue: a restore
            // beyond the quota is refused on the spot, not queued. Fine for a
            // trickle of restores, hopeless for anything shaped like online
            // traffic. Callers need a long timeout. queueLimit is ignored.
            return {
                capacity: 24,
                serviceMs: 2800,
                serviceCv: 0.3,
                queueLimit: 64,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'vectordb':
            // Mean query cost is serviceMs * log2(2 + indexSizeK) / (1 - recall):
            // 0.5ms * ~10 * 10 = ~50ms at one million vectors and 0.9 recall, so
            // 16 slots gives ~320 rps. Pushing recall to 0.99 costs 10x that.
            return {
                capacity: 16,
                serviceMs: 0.5,
                serviceCv: 0.4,
                queueLimit: 128,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                indexSizeK: 1000,
                recallTarget: 0.9,
            };
        case 'streambroker':
            // A partitioned log: 1ms producer ack, 4 partitions, and queueLimit is
            // RETENTION in messages. Per consumer group the parallelism ceiling is
            // the partition count, so throughput per group = 4 x (1000/consumerMs).
            return {
                capacity: 1,
                serviceMs: 1,
                serviceCv: 0.2,
                queueLimit: 2000,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                partitions: 4,
            };
        case 'pubsub':
            // A topic: near-instant ack, then one delivery per subscriber edge.
            // No knobs of its own; the amplification comes from the wiring.
            return {
                capacity: 1,
                serviceMs: 0.5,
                serviceCv: 0.2,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
        case 'websocket':
            // Capacity is CONNECTIONS HELD: 400 per instance, held ~30s each, so
            // by Little's law it saturates at about 13 new connections/sec per
            // instance. The 5ms serviceMs is only the handshake.
            return {
                capacity: 400,
                serviceMs: 5,
                serviceCv: 0.4,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                connectionMs: 30000,
            };
        case 'apigateway':
            // The front door: 2ms of auth/routing work per request, a 300 rps
            // token bucket with one second of burst headroom, and 1% bad auth.
            return {
                capacity: 64,
                serviceMs: 2,
                serviceCv: 0.3,
                queueLimit: 256,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                rateLimitRps: 300,
                burst: 300,
                authFailRate: 0.01,
            };
        case 'sidecar':
            // The proxy tax: 2ms on every request, in exchange for 2 retries, a
            // 500ms per-attempt deadline, and outlier ejection after 5 straight
            // downstream failures (3s ejection, matching the breaker's openMs).
            return {
                capacity: 32,
                serviceMs: 2,
                serviceCv: 0.2,
                queueLimit: 64,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 500,
                retries: 2,
                rps: 0,
                outlierAfter: 5,
                openMs: 3000,
            };
        case 'lambda':
            // Serverless: 25ms of work when warm, +350ms cold start, instances kept
            // warm 12s, at most 40 running at once (beyond that the platform
            // throttles; there is no queue). `capacity` is unused here.
            return {
                capacity: 1,
                serviceMs: 25,
                serviceCv: 0.5,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                coldStartMs: 350,
                keepWarmMs: 12000,
                maxConcurrency: 40,
            };
        case 'cron':
            // A batch job: every 20s it dumps 50 requests down each outgoing edge
            // at once. Not a request path; requests wired INTO it are refused.
            return {
                capacity: 1,
                serviceMs: 0,
                serviceCv: 0,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                intervalMs: 20000,
                batchSize: 50,
            };
        case 'bulkhead':
            // A pool of 8 concurrent calls. Refusing is free, so no slots, no
            // queue, no service time: the pool count is the whole component.
            return {
                capacity: 1,
                serviceMs: 0,
                serviceCv: 0,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                bulkheadMax: 8,
                bulkheadMode: 'reject',
                acquireQueueMax: 100,
                acquireTimeoutMs: 1000,
            };
        case 'retryqueue':
            // Delivery concurrency of 8 at ~3ms dispatch cost. Each failed
            // delivery gets 2 redeliveries with backoff before it dead-letters;
            // the 1s per-attempt deadline is what turns a hung consumer into a
            // retryable failure instead of a stuck message.
            return {
                capacity: 8,
                serviceMs: 3,
                serviceCv: 0.3,
                queueLimit: 2000,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 1000,
                retries: 2,
                rps: 0,
            };
        case 'transcoder':
            // Batch regime: 1.2 SECONDS per job, two jobs per box. One instance
            // is 2 * (1000/1200) = ~1.7 jobs/s; feed it from a queue and size the
            // farm against the arrival rate, because a structural deficit grows
            // the backlog forever. Each finished job hands 3 renditions (the
            // quality ladder) downstream as detached uploads, so storage sees 3x
            // the job rate.
            return {
                capacity: 2,
                serviceMs: 1200,
                serviceCv: 0.4,
                queueLimit: 8,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                renditions: 3,
            };
        case 'edgecompute':
            // A PoP function: ~1ms, lots of concurrency, and it can fully answer
            // 30% of requests without the origin ever hearing about them -- as
            // long as the execution fits the 2ms CPU budget; the tail that runs
            // past it is killed and passed to the origin anyway.
            return {
                capacity: 64,
                serviceMs: 1,
                serviceCv: 0.3,
                queueLimit: 512,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                edgeShare: 0.3,
                cpuMsCap: 2,
            };
        case 'writebehind':
            // `capacity` is the dirty buffer (memory, not threads): up to 256
            // acknowledged writes held at once. At the 200ms flush residence
            // that supports ~1280 writes/s before the buffer itself fills.
            // Every write in it is lost if this node crashes.
            return {
                capacity: 256,
                serviceMs: 1,
                serviceCv: 0.3,
                queueLimit: 512,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                flushDelayMs: 200,
            };
        case 'loadshedder':
            // Admits 300 rps sustained. 30% of the key space is best-effort
            // traffic, and 30% of the bucket is reserved for the rest, so under
            // saturation the best-effort tier is dropped first.
            return {
                capacity: 1,
                serviceMs: 0,
                serviceCv: 0,
                queueLimit: 0,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
                rateLimitRps: 300,
                burst: 300,
                lowPriorityShare: 0.3,
                priorityReserve: 0.3,
            };
        default:
            return {
                capacity: 1,
                serviceMs: 10,
                serviceCv: 0.5,
                queueLimit: 32,
                hitRate: 0,
                errorRate: 0,
                timeoutMs: 0,
                retries: 0,
                rps: 0,
            };
    }
}
