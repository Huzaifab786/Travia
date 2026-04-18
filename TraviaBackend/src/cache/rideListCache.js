const TTL_MS = 5000;

const cache = new Map();

function buildKey(params) {
  return JSON.stringify(params || {});
}

function getCachedRideList(params) {
  const key = buildKey(params);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return JSON.parse(entry.value);
}

function setCachedRideList(params, rides) {
  const key = buildKey(params);
  cache.set(key, {
    value: JSON.stringify(rides),
    expiresAt: Date.now() + TTL_MS,
  });
}

function invalidateRideListCache() {
  cache.clear();
}

module.exports = {
  getCachedRideList,
  setCachedRideList,
  invalidateRideListCache,
};
