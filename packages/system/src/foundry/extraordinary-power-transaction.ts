/** Shared by native framework edits and Destiny receipt delivery. */
const queues = new WeakMap<object, Promise<void>>();

export async function queueExtraordinaryPowerActor<T>(
  actor: object,
  work: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(actor) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  queues.set(actor, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (queues.get(actor) === tail) queues.delete(actor);
  }
}

export interface ExtraordinaryPowerStoredFields {
  readonly consequenceValues: Record<string, number>;
  readonly skillBindings: Record<string, string>;
  readonly powerBindings: Record<string, string>;
  readonly maintainedPowerIds: readonly string[];
}
let router:
  | ((
      actor: FoundryActorDocument,
      frameworkId: string,
      before: ExtraordinaryPowerStoredFields,
      after: ExtraordinaryPowerStoredFields,
    ) => Promise<boolean>)
  | undefined;
export function registerExtraordinaryPowerMutationRouter(
  value: typeof router,
): void {
  router = value;
}
export async function routeExtraordinaryPowerMutation(
  actor: FoundryActorDocument,
  frameworkId: string,
  before: ExtraordinaryPowerStoredFields,
  after: ExtraordinaryPowerStoredFields,
): Promise<boolean> {
  return (await router?.(actor, frameworkId, before, after)) ?? false;
}
