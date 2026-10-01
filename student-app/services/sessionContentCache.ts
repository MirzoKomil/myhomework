// A late response from a previous login (or a cleared cache) must not be
// returned to a new session, even when the old request was already in flight.
export function createSessionContentCache<T>(
  getIdentity: () => string,
  load: (identity: string) => Promise<T>,
  ttlMs: number,
  now = Date.now
) {
  let generation = 0;
  let cached: { identity: string; generation: number; value: T; at: number } | null = null;
  let pending: { identity: string; generation: number; promise: Promise<T> } | null = null;

  function invalidate() {
    generation += 1;
    cached = null;
    pending = null;
  }

  async function get(): Promise<T> {
    const identity = getIdentity();
    const version = generation;
    if (cached?.identity === identity && cached.generation === version && now() - cached.at < ttlMs) return cached.value;
    if (pending?.identity === identity && pending.generation === version) return pending.promise;
    const request = { identity, generation: version, promise: null as unknown as Promise<T> };
    request.promise = Promise.resolve().then(() => load(identity)).then(
      (value) => {
        if (version !== generation || identity !== getIdentity()) return get();
        cached = { identity, generation: version, value, at: now() };
        return value;
      },
      (error: unknown) => {
        if (version !== generation || identity !== getIdentity()) return get();
        throw error;
      }
    ).finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
    return request.promise;
  }

  return { get, invalidate };
}
