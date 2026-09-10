import {
  appendD6InitiatingActionResult,
  createD6InitiatingActionResultLedger,
  type D6InitiatingActionResultLedgerV1,
} from "./initiating-action-results";
import type { CombinedActionRoot } from "./combined-action-root";
import type { D6OrdinaryAttackThreadV1 } from "./ordinary-attack-thread";

/** One physical ChatMessage has one append history. The parent and ordinary
 * continuation retain their own request identities and state ledgers. Only
 * these explicitly bound contributors may enter the physical history. */
export function composeCombinedCombatResults(
  root: CombinedActionRoot,
  thread: D6OrdinaryAttackThreadV1,
  current?: D6InitiatingActionResultLedgerV1,
): D6InitiatingActionResultLedgerV1 {
  const binding = root.combatDamage;
  const attack = root.steps.find((step) => step.id === binding?.attackStepId);
  if (
    root.version !== 2 ||
    root.application !== "combat" ||
    !binding ||
    attack?.status !== "recorded" ||
    !attack.result ||
    canonical(binding.attackRequest) !== canonical(attack.result.request) ||
    thread.attackMessageId !== root.rootMessageId ||
    thread.requestId !== `ordinary:${root.rootMessageId}` ||
    thread.actorId !== attack.actorId ||
    thread.weaponId !== attack.result.request.source.itemId ||
    thread.attackTotal !== attack.result.total ||
    (attack.result.success !== true && thread.damage.stage !== "no-damage") ||
    thread.target.targetActorId !== binding.plan.scale.targetActorId ||
    canonical(thread.damage.plan) !== canonical(binding.plan) ||
    root.results.rootMessageId !== root.rootMessageId ||
    root.results.requestId !== root.groupId ||
    thread.results.rootMessageId !== root.rootMessageId ||
    thread.results.requestId !== thread.requestId ||
    (current &&
      (current.rootMessageId !== root.rootMessageId ||
        current.requestId !== root.groupId))
  ) {
    throw new Error("D6E2.ActionThread.AuthorityMismatch");
  }
  const parentDamage = root.steps.find(
    (step) => step.subject.kind === "weaponDamage",
  );
  const childDamage = thread.results.entries.find(
    (entry) => entry.appendId === parentDamage?.id,
  );
  const parentEntry = root.results.entries.find(
    (entry) => entry.appendId === parentDamage?.id,
  );
  if (
    (childDamage &&
      (!parentEntry || canonical(childDamage) !== canonical(parentEntry))) ||
    (thread.damage.stage === "rolled" &&
      (parentDamage?.status !== "recorded" ||
        canonical(thread.damage.result) !== canonical(parentDamage.result) ||
        !childDamage))
  )
    throw new Error("D6E2.ActionThread.ResultConflict");
  const contributions = [...root.results.entries, ...thread.results.entries];
  const authorized = new Map<string, (typeof contributions)[number]>();
  const damageId = root.steps.find(
    (step) => step.subject.kind === "weaponDamage",
  )?.id;
  for (const entry of contributions) {
    const previous = authorized.get(entry.appendId);
    if (
      previous &&
      (entry.appendId !== damageId || canonical(previous) !== canonical(entry))
    )
      throw new Error("D6E2.ActionThread.ResultConflict");
    authorized.set(entry.appendId, entry);
  }
  let ledger =
    current ??
    createD6InitiatingActionResultLedger(root.rootMessageId, root.groupId);
  for (const entry of ledger.entries) {
    if (canonical(authorized.get(entry.appendId)) !== canonical(entry)) {
      throw new Error("D6E2.ActionThread.ResultConflict");
    }
  }
  for (const entry of contributions)
    ledger = appendD6InitiatingActionResult(ledger, entry);
  return ledger;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
}
