const TTL_MS = 2 * 60 * 1000;

const cache = new Map();

function toSnapshot(user) {
  if (!user || !user.id) {
    return null;
  }

  return {
    id: user.id,
    role: user.role || null,
    gender: user.gender || null,
  };
}

function getCachedUserSnapshot(userId) {
  const entry = cache.get(userId);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(userId);
    return null;
  }

  return entry.value;
}

function setCachedUserSnapshot(user) {
  const value = toSnapshot(user);

  if (!value) {
    return null;
  }

  cache.set(value.id, {
    value,
    expiresAt: Date.now() + TTL_MS,
  });

  return value;
}

function invalidateCachedUserSnapshot(userId) {
  cache.delete(userId);
}

module.exports = {
  getCachedUserSnapshot,
  setCachedUserSnapshot,
  invalidateCachedUserSnapshot,
};
