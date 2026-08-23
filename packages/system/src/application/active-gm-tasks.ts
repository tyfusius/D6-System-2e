import {
  registerD6PendingInteraction,
  resetD6PendingInteractionsForTests,
  resolveD6PendingInteraction,
  setD6PendingInteractionStatus,
} from "./pending-interactions";

export type D6ActiveGmTaskKind = "combinedAction" | "requestedRoll";
export type D6ActiveGmTaskDelivery =
  "highlight-on-character-sheet" | "open-roll-window";
export type D6ActiveGmTaskSubject =
  | { readonly id: string; readonly kind: "attribute" }
  | { readonly id: string; readonly kind: "skill" };

export interface D6ActiveGmTaskView {
  readonly actorId: string;
  readonly actorImg: string;
  readonly actorName: string;
  readonly cancellable: boolean;
  readonly controllerName: string;
  readonly controllerUserId: string;
  readonly createdAt: number;
  readonly delivery: D6ActiveGmTaskDelivery;
  readonly expiresAt: number;
  readonly id: string;
  readonly kind: D6ActiveGmTaskKind;
  readonly label: string;
  readonly remoteFailed: boolean;
  readonly subject: D6ActiveGmTaskSubject;
  readonly working: boolean;
}

interface ActiveGmTaskEntry<TResult> {
  readonly cancelRemote?: () => Promise<unknown>;
  readonly cancelValue: TResult;
  readonly execute: () => Promise<TResult>;
  readonly resolve: (result: TResult) => void;
  readonly takeOver?: () => Promise<TResult>;
  settled: boolean;
  timer?: ReturnType<typeof globalThis.setTimeout>;
  view: D6ActiveGmTaskView;
}

export interface RunD6ActiveGmTaskOptions<TResult> {
  readonly actorId: string;
  readonly actorImg: string;
  readonly actorName: string;
  readonly cancelRemote?: () => Promise<unknown>;
  readonly cancelValue: TResult;
  readonly controllerName: string;
  readonly controllerUserId: string;
  readonly createdAt: number;
  readonly delivery: D6ActiveGmTaskDelivery;
  readonly execute: () => Promise<TResult>;
  readonly expiresAt: number;
  readonly id: string;
  readonly kind: D6ActiveGmTaskKind;
  readonly label: string;
  readonly subject: D6ActiveGmTaskSubject;
  readonly takeOver?: () => Promise<TResult>;
}

const tasks = new Map<string, ActiveGmTaskEntry<unknown>>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function finish<TResult>(
  entry: ActiveGmTaskEntry<TResult>,
  result: TResult,
): void {
  if (entry.settled) return;
  entry.settled = true;
  if (entry.timer) globalThis.clearTimeout(entry.timer);
  tasks.delete(entry.view.id);
  resolveD6PendingInteraction(entry.view.id);
  entry.resolve(result);
  notify();
}

function fail<TResult>(
  entry: ActiveGmTaskEntry<TResult>,
  error: unknown,
): void {
  if (entry.settled) return;
  entry.view = Object.freeze({
    ...entry.view,
    remoteFailed: true,
    working: false,
  });
  setD6PendingInteractionStatus(entry.view.id, "failed");
  console.info("D6 System 2e active GM task is waiting for takeover", error);
  notify();
}

export function runD6ActiveGmTask<TResult>(
  options: RunD6ActiveGmTaskOptions<TResult>,
): Promise<TResult> {
  if (tasks.has(options.id)) {
    throw new Error(`D6 System 2e active task ${options.id} already exists.`);
  }
  let resolveResult!: (result: TResult) => void;
  const result = new Promise<TResult>((resolve) => {
    resolveResult = resolve;
  });
  const entry: ActiveGmTaskEntry<TResult> = {
    cancelValue: options.cancelValue,
    execute: options.execute,
    resolve: resolveResult,
    settled: false,
    ...(options.cancelRemote ? { cancelRemote: options.cancelRemote } : {}),
    ...(options.takeOver ? { takeOver: options.takeOver } : {}),
    view: Object.freeze({
      actorId: options.actorId,
      actorImg: options.actorImg,
      actorName: options.actorName,
      cancellable: options.cancelRemote !== undefined,
      controllerName: options.controllerName,
      controllerUserId: options.controllerUserId,
      createdAt: options.createdAt,
      delivery: options.delivery,
      expiresAt: options.expiresAt,
      id: options.id,
      kind: options.kind,
      label: options.label,
      remoteFailed: false,
      subject: options.subject,
      working: false,
    }),
  };
  entry.timer = globalThis.setTimeout(
    () => {
      void entry.cancelRemote?.().catch(() => undefined);
      finish(entry, entry.cancelValue);
    },
    Math.max(0, options.expiresAt - Date.now()),
  );
  tasks.set(options.id, entry as ActiveGmTaskEntry<unknown>);
  registerD6PendingInteraction({
    actorId: options.actorId,
    actorImg: options.actorImg,
    actorName: options.actorName,
    ...(options.cancelRemote
      ? { cancel: () => cancelD6ActiveGmTask(options.id) }
      : {}),
    controllerName: options.controllerName,
    controllerUserId: options.controllerUserId,
    createdAt: options.createdAt,
    expiresAt: options.expiresAt,
    id: options.id,
    kind:
      options.kind === "combinedAction"
        ? "combined-action"
        : options.subject.id === "resistance"
          ? "resistance-roll"
          : "requested-roll",
    label: options.label,
    subjectLabel: options.actorName,
    ...(options.takeOver
      ? {
          takeOver: async () => {
            await takeOverD6ActiveGmTask(options.id);
            return "resolved" as const;
          },
        }
      : {}),
  });
  notify();
  void options.execute().then(
    (value) => {
      if (!entry.view.working) finish(entry, value);
    },
    (error: unknown) => {
      if (!entry.view.working) fail(entry, error);
    },
  );
  return result;
}

export function activeD6GmTasks(): readonly D6ActiveGmTaskView[] {
  return Object.freeze(
    [...tasks.values()]
      .map(({ view }) => view)
      .sort(
        (left, right) =>
          left.createdAt - right.createdAt || left.id.localeCompare(right.id),
      ),
  );
}

export async function takeOverD6ActiveGmTask(id: string): Promise<void> {
  const entry = tasks.get(id);
  if (!entry || entry.settled || entry.view.working || !entry.takeOver) return;
  entry.view = Object.freeze({
    ...entry.view,
    remoteFailed: false,
    working: true,
  });
  notify();
  try {
    await entry.cancelRemote?.().catch(() => undefined);
    finish(entry, await entry.takeOver());
  } catch (error) {
    entry.view = Object.freeze({
      ...entry.view,
      remoteFailed: true,
      working: false,
    });
    console.error("D6 System 2e active GM task takeover failed", error);
    notify();
  }
}

export async function cancelD6ActiveGmTask(id: string): Promise<void> {
  const entry = tasks.get(id);
  if (!entry || entry.settled) return;
  await entry.cancelRemote?.().catch(() => undefined);
  finish(entry, entry.cancelValue);
}

export function subscribeD6ActiveGmTasks(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetD6ActiveGmTasksForTests(): void {
  for (const entry of tasks.values()) {
    if (entry.timer) globalThis.clearTimeout(entry.timer);
  }
  tasks.clear();
  listeners.clear();
  resetD6PendingInteractionsForTests();
}
