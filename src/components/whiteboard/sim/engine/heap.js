/* eslint-disable */
/*
 * Vendored from Breakscale (https://github.com/xevrion/breakscale), src/sim/,
 * commit c58de51, compiled from TypeScript to JavaScript. Do not edit by hand.
 *
 * MIT License. Copyright (c) 2026 Breakscale contributors.
 * Full licence text: ./LICENSE
 */
export class MinHeap {
    constructor() {
        this.items = [];
    }
    get size() {
        return this.items.length;
    }
    push(item) {
        const a = this.items;
        a.push(item);
        let i = a.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (less(a[i], a[parent])) {
                swap(a, i, parent);
                i = parent;
            }
            else
                break;
        }
    }
    pop() {
        const a = this.items;
        if (a.length === 0)
            return undefined;
        const top = a[0];
        const last = a.pop();
        if (a.length > 0) {
            a[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let smallest = i;
                if (l < a.length && less(a[l], a[smallest]))
                    smallest = l;
                if (r < a.length && less(a[r], a[smallest]))
                    smallest = r;
                if (smallest === i)
                    break;
                swap(a, i, smallest);
                i = smallest;
            }
        }
        return top;
    }
    peek() {
        return this.items[0];
    }
    clear() {
        this.items.length = 0;
    }
}
function less(a, b) {
    return a.time !== b.time ? a.time < b.time : a.seq < b.seq;
}
function swap(a, i, j) {
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
}
