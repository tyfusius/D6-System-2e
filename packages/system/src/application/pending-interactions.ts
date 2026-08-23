export type D6PendingInteractionKind =
  | "chase-participation"
  | "combined-action"
  | "damage-resolution"
  | "economy-approval"
  | "requested-roll"
  | "resistance-roll";

export type D6PendingInteractionStatus = "failed" | "opening" | "pending";

export interface D6PendingInteractionView {
  readonly actorId?: string;
  readonly actorImg?: string;
  readonly actorName?: string;
  readonly cancellable: boolean;
  readonly controllerName?: string;
  readonly controllerUserId: string;
  readonly createdAt: number;
  readonly expiresAt?: number;
  readonly id: string;
  readonly kind: D6PendingInteractionKind;
  readonly label: string;
  readonly reopenable: boolean;
  readonly status: D6PendingInteractionStatus;
  readonly subjectLabel?: string;
  readonly takeover: boolean;
}

export type D6PendingInteractionDisposition = "dismissed" | "resolved";

export interface RegisterD6PendingInteractionOptions {
  readonly actorId?: string;
  readonly actorImg?: string;
  readonly actorName?: string;
  readonly cancel?: () => Promise<void>;
  readonly controllerName?: string;
  readonly controllerUserId: string;
  readonly createdAt: number;
  readonly expiresAt?: number;
  readonly id: string;
  readonly kind: D6PendingInteractionKind;
  readonly label: string;
  readonly onExpire?: () => Promise<void> | void;
  readonly reopen?: () => Promise<D6PendingInteractionDisposition>;
  readonly subjectLabel?: string;
  readonly takeOver?: () => Promise<D6PendingInteractionDisposition>;
}

interface D6PendingInteractionEntry {
  readonly cancel?: () => Promise<void>;
  readonly identity: string;
  readonly onExpire?: () => Promise<void> | void;
  readonly reopen?: () => Promise<D6PendingInteractionDisposition>;
  readonly takeOver?: () => Promise<D6PendingInteractionDisposition>;
  timer?: ReturnType<typeof globalThis.setTimeout>;
  view: D6PendingInteractionView;
}

const interactions = new Map<string, D6PendingInteractionEntry>();
const listeners = new Set<() => void>();

function identity(options: RegisterD6PendingInteractionOptions): string {
  return JSON.stringify({
    actorId: options.actorId ?? "",
    controllerUserId: options.controllerUserId,
    createdAt: options.createdAt,
    expiresAt: options.expiresAt ?? null,
    id: options.id,
    kind: options.kind,
  });
}

function notify(): void {
  for (const listener of listeners) listener();
}

function clearEntry(id: string): D6PendingInteractionEntry | undefined {
  const entry = interactions.get(id);
  if (!entry) return undefined;
  if (entry.timer) globalThis.clearTimeout(entry.timer);
  interactions.delete(id);
  notify();
  return entry;
}

export function registerD6PendingInteraction(
  options: RegisterD6PendingInteractionOptions,
): { readonly created: boolean; readonly view: D6PendingInteractionView } {
  if (
    options.id.trim().length === 0 ||
    options.controllerUserId.trim().length === 0 ||
    options.label.trim().length === 0 ||
    !Number.isFinite(options.createdAt) ||
    (options.expiresAt !== undefined &&
      (!Number.isFinite(options.expiresAt) ||
        options.expiresAt <= options.createdAt))
  ) {
    throw new Error("D6 System 2e pending interaction is invalid.");
  }
  const exactIdentity = identity(options);
  const existing = interactions.get(options.id);
  if (existing) {
    if (existing.identity !== exactIdentity) {
      throw new Error(
        `D6 System 2e pending interaction ${options.id} conflicts with an existing workflow.`,
      );
    }
    return { created: false, view: existing.view };
  }
  const view = Object.freeze({
    ...(options.actorId ? { actorId: options.actorId } : {}),
    ...(options.actorImg ? { actorImg: options.actorImg } : {}),
    ...(options.actorName ? { actorName: options.actorName } : {}),
    cancellable: options.cancel !== undefined,
    ...(options.controllerName
      ? { controllerName: options.controllerName }
      : {}),
    controllerUserId: options.controllerUserId,
    createdAt: options.createdAt,
    ...(options.expiresAt === undefined
      ? {}
      : { expiresAt: options.expiresAt }),
    id: options.id,
    kind: options.kind,
    label: options.label,
    reopenable: options.reopen !== undefined,
    status: "pending" as const,
    ...(options.subjectLabel ? { subjectLabel: options.subjectLabel } : {}),
    takeover: options.takeOver !== undefined,
  });
  const entry: D6PendingInteractionEntry = {
    ...(options.cancel ? { cancel: options.cancel } : {}),
    identity: exactIdentity,
    ...(options.onExpire ? { onExpire: options.onExpire } : {}),
    ...(options.reopen ? { reopen: options.reopen } : {}),
    ...(options.takeOver ? { takeOver: options.takeOver } : {}),
    view,
  };
  if (options.expiresAt !== undefined) {
    entry.timer = globalThis.setTimeout(
      () => {
        const expired = clearEntry(options.id);
        if (expired?.onExpire) void expired.onExpire();
      },
      Math.max(0, options.expiresAt - Date.now()),
    );
  }
  interactions.set(options.id, entry);
  notify();
  return { created: true, view };
}

export function activeD6PendingInteractions(
  controllerUserId?: string,
): readonly D6PendingInteractionView[] {
  return Object.freeze(
    [...interactions.values()]
      .map(({ view }) => view)
      .filter(
        (view) =>
          controllerUserId === undefined ||
          view.controllerUserId === controllerUserId,
      )
      .sort(
        (left, right) =>
          left.createdAt - right.createdAt || left.id.localeCompare(right.id),
      ),
  );
}

async function runInteractionAction(
  id: string,
  action: "reopen" | "takeOver",
): Promise<void> {
  const entry = interactions.get(id);
  const operation = action === "reopen" ? entry?.reopen : entry?.takeOver;
  if (!entry || !operation || entry.view.status === "opening") return;
  entry.view = Object.freeze({ ...entry.view, status: "opening" });
  notify();
  try {
    const disposition = await operation();
    if (disposition === "resolved") {
      clearEntry(id);
      return;
    }
    entry.view = Object.freeze({ ...entry.view, status: "pending" });
  } catch (error) {
    entry.view = Object.freeze({ ...entry.view, status: "failed" });
    console.error("D6 System 2e pending interaction failed", error);
  }
  notify();
}

export function reopenD6PendingInteraction(id: string): Promise<void> {
  return runInteractionAction(id, "reopen");
}

export function takeOverD6PendingInteraction(id: string): Promise<void> {
  return runInteractionAction(id, "takeOver");
}

export async function cancelD6PendingInteraction(id: string): Promise<void> {
  const entry = interactions.get(id);
  if (!entry?.cancel || entry.view.status === "opening") return;
  entry.view = Object.freeze({ ...entry.view, status: "opening" });
  notify();
  try {
    await entry.cancel();
    clearEntry(id);
  } catch (error) {
    entry.view = Object.freeze({ ...entry.view, status: "failed" });
    console.error(
      "D6 System 2e pending interaction cancellation failed",
      error,
    );
    notify();
  }
}

export function resolveD6PendingInteraction(id: string): void {
  clearEntry(id);
}

export function setD6PendingInteractionStatus(
  id: string,
  status: D6PendingInteractionStatus,
): void {
  const entry = interactions.get(id);
  if (!entry) return;
  entry.view = Object.freeze({ ...entry.view, status });
  notify();
}

export function subscribeD6PendingInteractions(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetD6PendingInteractionsForTests(): void {
  for (const entry of interactions.values()) {
    if (entry.timer) globalThis.clearTimeout(entry.timer);
  }
  interactions.clear();
  listeners.clear();
}
