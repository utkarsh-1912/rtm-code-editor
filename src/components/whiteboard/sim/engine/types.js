/* eslint-disable */
/*
 * Vendored from Breakscale (https://github.com/xevrion/breakscale), src/sim/,
 * commit c58de51, compiled from TypeScript to JavaScript. Do not edit by hand.
 *
 * MIT License. Copyright (c) 2026 Breakscale contributors.
 * Full licence text: ./LICENSE
 */
export const TRAFFIC_PATTERNS = [
    'steady',
    'ramp',
    'spike',
    'diurnal',
];
/**
 * The same list at runtime, for the validators that cannot read a type.
 * Written out beside the type rather than derived from it, for the reason
 * TRAFFIC_PATTERNS is: a union and an array cannot be generated from one
 * another in TypeScript, so the pairing is checked by a test instead.
 */
export const BULKHEAD_MODES = ['reject', 'wait'];
/**
 * Seconds for one cycle when a client does not say.
 *
 * 60 is chosen so a reader watching in real time sees a whole cycle without
 * waiting: a full ramp, or a gap between two spikes, inside a minute.
 */
export const DEFAULT_TRAFFIC_PERIOD_S = 60;
