import type { D6DestinyTemptationV1 } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { resolvedExtraordinaryPowerFramework } from "../registries/extraordinary-powers";
import { withAuthorizedExtraordinaryPowerUpdate } from "./mechanical-edit-guard";
import { queueExtraordinaryPowerActor } from "./extraordinary-power-transaction";
import { record } from "./sheets/values";

export function requireDestinyFramework(
  id: string,
  ownerId?: string,
  resourceRoleId?: string,
) {
  const f = resolvedExtraordinaryPowerFramework(id);
  const roleId = f?.destinyTemptation?.consequenceResourceRoleId;
  const role = f?.resourceRoles.find((r) => r.id === roleId);
  if (
    !f?.destinyTemptation ||
    (ownerId !== undefined && f.ownerId !== ownerId) ||
    (resourceRoleId !== undefined && roleId !== resourceRoleId) ||
    role?.kind !== "consequence-track" ||
    role.binding !== "actor-extension-number" ||
    (f.ownerId !== SYSTEM_ID &&
      (
        game as FoundryGame & {
          modules?: { get(id: string): { active?: boolean } | undefined };
        }
      ).modules?.get(f.ownerId)?.active !== true)
  ) {
    throw new Error("D6E2.Destiny.Error.ProviderMissing");
  }
  return f;
}

/** Fresh Actor read inside the same queue used by bindings, maintenance and setConsequence.
 * The resource increment and idempotency receipt are one native Actor update. */
export async function applyDestinyConsequence(
  actor: FoundryActorDocument,
  t: D6DestinyTemptationV1,
  requireAuthority: () => void,
): Promise<void> {
  await queueExtraordinaryPowerActor(actor, async () => {
    requireAuthority();
    requireDestinyFramework(t.frameworkId, t.ownerId, t.resourceRoleId);
    if (t.status !== "applying")
      throw new Error("D6E2.Destiny.Error.TemptationClaimed");
    const receipts = record(actor.getFlag(SYSTEM_ID, "destinyConsequences"));
    const receipt = record(receipts[t.id]);
    if (receipts[t.id]) {
      if (
        receipt.version !== 1 ||
        receipt.frameworkId !== t.frameworkId ||
        receipt.resourceRoleId !== t.resourceRoleId ||
        receipt.sessionId !== t.sessionId
      )
        throw new Error("D6E2.Destiny.Error.ConsequenceConflict");
      return;
    }
    const encode = (s: string) =>
      s.replaceAll("%", "%25").replaceAll(".", "%2E");
    const frameworks = record(
      record(actor.system.extraordinaryPowers).frameworks,
    );
    const key = encode(t.frameworkId);
    const current = record(frameworks[key] ?? frameworks[t.frameworkId]);
    const values = record(current.consequenceValues);
    const resourceKey = encode(t.resourceRoleId);
    const previous = Number(
      values[resourceKey] ?? values[t.resourceRoleId] ?? 0,
    );
    if (
      !Number.isSafeInteger(previous) ||
      previous < 0 ||
      !Number.isSafeInteger(previous + 1)
    )
      throw new Error("D6E2.Destiny.Error.ConsequenceConflict");
    requireAuthority();
    await withAuthorizedExtraordinaryPowerUpdate(actor, () =>
      actor.update({
        "system.extraordinaryPowers.frameworks": {
          ...frameworks,
          [key]: {
            ...current,
            consequenceValues: { ...values, [resourceKey]: previous + 1 },
          },
        },
        [`flags.${SYSTEM_ID}.destinyConsequences`]: {
          ...receipts,
          [t.id]: {
            version: 1,
            sessionId: t.sessionId,
            frameworkId: t.frameworkId,
            resourceRoleId: t.resourceRoleId,
            previous,
            next: previous + 1,
          },
        },
      }),
    );
  });
}
