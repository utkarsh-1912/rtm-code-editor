/* eslint-disable no-restricted-globals */
// Runs the simulator off the main thread.
//
// The engine is deterministic for a given topology and seed, and it is always advanced in
// the same fixed steps, so the snapshot at board time t is the same on every client. Each
// client asks for the same t (from the room's shared clock) and so shows the same numbers.
//
// in:  { type: "setup", topology, seed }  new inputs: start again from zero
//      { type: "seek", t }                board time in ms (a multiple of STEP)
// out: { type: "snapshot", t, system, nodes, edges }
//      { type: "progress", t, goal }       while catching up to a far-off t
import { Engine } from "./engine/engine";

const STEP = 100;
// Simulated before board time 0, so the numbers are steady from the first frame.
const WARMUP = 10000;
// Steps per slice while catching up; new messages are handled between slices.
const SLICE = 50;

let topology = null;
let seed = 1;
let engine = null;
let simMs = 0;
let target = null;
let posted = null;
let pulls = new Map(); // worker id -> ids of queue -> worker links
let scheduled = false;

const round = (v, k = 1) => (Number.isFinite(v) ? Math.round(v * k) / k : 0);

function compact(snap, t) {
    const nodes = {};
    for (const [id, s] of Object.entries(snap.nodes)) {
        nodes[id] = {
            busy: round(s.utilization * 100),
            p99: round(s.p99),
            waiting: s.queued,
            served: round(s.throughput),
            offered: round(s.arrivalRate),
            errors: round(s.errorRate, 1000),
            shed: round(s.shedRate),
        };
    }
    const edges = {};
    for (const [id, rps] of Object.entries(snap.edgeFlow)) edges[id] = round(rps);
    // Workers pull from queues, so nothing is "sent" along a queue -> worker link. When a
    // worker has one queue feeding it, what it took in is that link's rate; with several the
    // split isn't measured, so those links show no rate.
    for (const [workerId, links] of pulls) {
        const taken = snap.nodes[workerId]?.arrivalRate;
        links.forEach((id) => { if (links.length === 1 && Number.isFinite(taken)) edges[id] = round(taken); else delete edges[id]; });
    }
    const sys = snap.system;
    return {
        type: "snapshot",
        t,
        system: { offered: round(sys.offeredRps), goodput: round(sys.goodputRps), p99: round(sys.p99), errors: round(sys.errorRate, 1000) },
        nodes,
        edges,
    };
}

function pump() {
    scheduled = false;
    if (!topology || target == null) return;
    const goal = WARMUP + target;
    if (!engine || simMs > goal) {
        engine = new Engine(topology, seed);
        simMs = 0;
        posted = null;
    }
    for (let i = 0; i < SLICE && simMs < goal; i++) {
        engine.advance(STEP);
        simMs += STEP;
    }
    if (simMs < goal) {
        self.postMessage({ type: "progress", t: Math.max(0, simMs - WARMUP), goal: target });
        schedule();
        return;
    }
    if (posted === target) return;
    posted = target;
    self.postMessage(compact(engine.snapshot(), target));
}

function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(pump, 0);
}

self.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type === "setup") {
        topology = msg.topology;
        const kindOf = new Map(topology.nodes.map((n) => [n.id, n.kind]));
        pulls = new Map();
        topology.edges.forEach((e) => {
            if (kindOf.get(e.from) !== "queue" || kindOf.get(e.to) !== "worker") return;
            pulls.set(e.to, [...(pulls.get(e.to) || []), e.id]);
        });
        seed = msg.seed >>> 0 || 1;
        engine = null;
        schedule();
    } else if (msg.type === "seek") {
        target = Math.max(0, Math.floor(msg.t / STEP) * STEP);
        schedule();
    }
};
