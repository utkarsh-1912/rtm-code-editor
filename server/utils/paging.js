// limit/offset from a query string. Returns null when the caller didn't ask for paging, so
// endpoints keep answering with a plain array for older callers.
function paging(query, { max = 100, fallback = 20 } = {}) {
    if (query.limit === undefined && query.offset === undefined && query.page === undefined) return null;
    const limit = Math.min(max, Math.max(1, parseInt(query.limit, 10) || fallback));
    const page = parseInt(query.page, 10);
    const offset = Number.isFinite(page) && page > 0 ? (page - 1) * limit : Math.max(0, parseInt(query.offset, 10) || 0);
    return { limit, offset };
}

module.exports = { paging };
