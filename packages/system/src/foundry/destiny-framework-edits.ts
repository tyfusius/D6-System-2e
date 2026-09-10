import type {
  D6DestinyFrameworkEditV1,
  D6DestinyFrameworkPatchV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { resolvedExtraordinaryPowerFramework } from "../registries/extraordinary-powers";
import {
  queueExtraordinaryPowerActor,
  type ExtraordinaryPowerStoredFields,
} from "./extraordinary-power-transaction";
import { withAuthorizedExtraordinaryPowerUpdate } from "./mechanical-edit-guard";
import { record } from "./sheets/values";
const encode = (s: string) => s.replaceAll("%", "%25").replaceAll(".", "%2E");
export function destinyFrameworkPatches(
  before: ExtraordinaryPowerStoredFields,
  after: ExtraordinaryPowerStoredFields,
): readonly D6DestinyFrameworkPatchV1[] {
  const patches: D6DestinyFrameworkPatchV1[] = [];
  for (const field of [
    "skillBindings",
    "powerBindings",
    "consequenceValues",
  ] as const)
    for (const key of new Set([
      ...Object.keys(before[field]),
      ...Object.keys(after[field]),
    ])) {
      const old = before[field][key] ?? null;
      const next = after[field][key] ?? null;
      if (old !== next) patches.push({ field, key, before: old, after: next });
    }
  if (
    JSON.stringify(before.maintainedPowerIds) !==
    JSON.stringify(after.maintainedPowerIds)
  )
    patches.push({
      field: "maintainedPowerIds",
      key: "",
      before: before.maintainedPowerIds,
      after: after.maintainedPowerIds,
    });
  return patches;
}
export function validateDestinyFrameworkEdit(
  edit: Omit<D6DestinyFrameworkEditV1, "userId" | "status">,
): void {
  const actor = game.actors?.get(edit.actorId);
  const definition = resolvedExtraordinaryPowerFramework(edit.frameworkId);
  if (!actor || !definition)
    throw new Error("D6E2.Destiny.Error.ProviderMissing");
  for (const p of edit.patches) {
    if (p.field === "skillBindings") {
      if (
        !definition.skillRoles.some((r) => r.id === p.key) ||
        (p.after !== null &&
          p.after !== "" &&
          (typeof p.after !== "string" ||
            actor.items.get(p.after)?.type !== "skill"))
      )
        throw new Error("D6E2.Destiny.Error.InvalidCommand");
    } else if (p.field === "powerBindings") {
      if (
        !definition.powers.some((r) => r.id === p.key) ||
        (p.after !== null &&
          p.after !== "" &&
          (typeof p.after !== "string" ||
            actor.items.get(p.after)?.type !== "manifestation"))
      )
        throw new Error("D6E2.Destiny.Error.InvalidCommand");
    } else if (p.field === "consequenceValues") {
      if (
        !definition.resourceRoles.some(
          (r) => r.id === p.key && r.kind === "consequence-track",
        ) ||
        !Number.isSafeInteger(p.after) ||
        Number(p.after) < 0
      )
        throw new Error("D6E2.Destiny.Error.InvalidCommand");
    } else if ((p as { field: unknown }).field === "maintainedPowerIds") {
      if (
        !Array.isArray(p.after) ||
        p.after.some(
          (id) =>
            !definition.powers.some(
              (r) => r.id === id && r.maintenance === "active-toggle",
            ),
        )
      )
        throw new Error("D6E2.Destiny.Error.InvalidCommand");
    } else throw new Error("D6E2.Destiny.Error.InvalidCommand");
  }
}
/** Executed only on the elected GM. Compare touched fields, then merge with
 * fresh Actor data so a stale remote binding edit cannot restore an old point count. */
export async function applyDestinyFrameworkEdit(
  edit: D6DestinyFrameworkEditV1,
  requireAuthority: () => void,
): Promise<void> {
  const actor = game.actors?.get(edit.actorId);
  if (!actor) throw new Error("D6E2.Destiny.Error.ActorMissing");
  await queueExtraordinaryPowerActor(actor, async () => {
    requireAuthority();
    validateDestinyFrameworkEdit(edit);
    const receipts = record(actor.getFlag(SYSTEM_ID, "destinyFrameworkEdits"));
    const identity = JSON.stringify(edit);
    if (receipts[edit.id]) {
      if (receipts[edit.id] !== identity)
        throw new Error("D6E2.Destiny.Error.ReceiptConflict");
      return;
    }
    const frameworks = record(
      record(actor.system.extraordinaryPowers).frameworks,
    );
    const key = encode(edit.frameworkId);
    const current = structuredClone(
      record(frameworks[key] ?? frameworks[edit.frameworkId]),
    );
    for (const p of edit.patches) {
      const values = record(current[p.field]);
      const storedKey = encode(p.key);
      const before =
        (p as { field: unknown }).field === "maintainedPowerIds"
          ? (current[p.field] ?? [])
          : (values[storedKey] ?? values[p.key] ?? null);
      const normalizedBefore =
        (p.field === "skillBindings" || p.field === "powerBindings") &&
        before === ""
          ? null
          : before;
      if (JSON.stringify(normalizedBefore) !== JSON.stringify(p.before))
        throw new Error("D6E2.Destiny.Error.FrameworkConflict");
      if ((p as { field: unknown }).field === "maintainedPowerIds")
        current[p.field] = p.after;
      else {
        if (p.after === null) Reflect.deleteProperty(values, storedKey);
        else values[storedKey] = p.after;
        current[p.field] = values;
      }
    }
    requireAuthority();
    await withAuthorizedExtraordinaryPowerUpdate(actor, () =>
      actor.update({
        "system.extraordinaryPowers.frameworks": {
          ...frameworks,
          [key]: current,
        },
        [`flags.${SYSTEM_ID}.destinyFrameworkEdits`]: {
          ...receipts,
          [edit.id]: identity,
        },
      }),
    );
  });
}
