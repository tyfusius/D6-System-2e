/**
 * Reuse configuration projections during one synchronous read operation.
 * A scope never survives an await: returning a Promise releases it immediately.
 * Thus the next event/render/authority operation observes fresh settings,
 * registrations, language and ownership without relying on document identity.
 * Callers must keep the scoped work read-only.
 */
let scope: Map<object, unknown> | undefined;
let revision = 0;

export function withRuntimeReadScope<T>(read: () => T): T {
  if (scope) return read();
  scope = new Map();
  try {
    return read();
  } finally {
    scope = undefined;
  }
}

export function readRuntimeProjection<T>(key: object, read: () => T): T {
  return withRuntimeReadScope(() => {
    const active = scope;
    if (!active) return read();
    if (active.has(key)) return active.get(key) as T;
    const startedRevision = revision;
    const value = read();
    // A synchronous contribution change must not resurrect an older projection.
    if (revision === startedRevision) active.set(key, value);
    return value;
  });
}

/** For synchronous registry mutations that may trigger nested read callbacks. */
export function invalidateRuntimeReadScope(): void {
  revision += 1;
  scope?.clear();
}
