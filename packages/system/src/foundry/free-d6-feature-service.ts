import {
  approveFeatureTransaction,
  planFreeD6FeatureTransaction,
  type D6FeatureEconomyPhase,
  type D6FeatureEconomyRequestV1,
  type D6FeatureEconomyTransactionV1,
  type D6RollResultV1,
  freeD6FlawCreditLimit,
  freeD6CreationLedger,
  freeD6CreationTransaction,
  replaceFreeD6CreationTransaction,
} from "@d6-system-2e/core";
import { currentConfiguredRulesProfile } from "../settings/rules-profile-library";
import {
  featureEconomyRegistry,
  resolvedFeatureBenefitDefinition,
} from "../registries/feature-economy";
import { integer, record, stringValue } from "./sheets/values";
import { readFreeD6CreationDraft } from "./free-d6-creation-service";

export const FREE_D6_FEATURE_ECONOMY_ID = "free-d6.features.merits-flaws";

export function freeD6FeatureEconomyActive(): boolean {
  return (
    currentConfiguredRulesProfile().strategies.featureEconomy ===
    FREE_D6_FEATURE_ECONOMY_ID
  );
}

export interface FreeD6FeatureRollModifierV1 {
  readonly effects: readonly Readonly<{
    readonly definitionId: string;
    readonly definitionLabel: string;
    readonly effectId: string;
    readonly private: boolean;
    readonly providerId: string;
    readonly providerLabel: string;
    readonly score: number;
  }>[];
  readonly totalScore: number;
}

export function freeD6FeatureRollModifier(
  actor: FoundryActorDocument,
  source: Readonly<{
    readonly kind: string;
    readonly source?: Readonly<{
      readonly attributeId?: string;
      readonly itemId?: string;
    }>;
  }>,
): FreeD6FeatureRollModifierV1 {
  if (!freeD6FeatureEconomyActive()) {
    return Object.freeze({ effects: Object.freeze([]), totalScore: 0 });
  }
  const effects = actor.items.contents.flatMap((item) => {
    if (!["perk", "flaw"].includes(item.type)) return [];
    const snapshot = record(item.system.featureEconomy);
    const definitionId = stringValue(snapshot.definitionId);
    const definition = resolvedFeatureBenefitDefinition(definitionId);
    if (!definition) return [];
    const provider = featureEconomyRegistry
      .current()
      .find(({ definitions }) =>
        definitions.some(({ id }) => id === definitionId),
      );
    return definition.effects.flatMap((effect) => {
      if (effect.kind !== "roll-modifier") return [];
      const sourceId = stringValue(
        source.source?.itemId ?? source.source?.attributeId,
      );
      const applies =
        effect.scope === "all-rolls" ||
        effect.scope === source.kind ||
        effect.scope === `${source.kind}:${sourceId}`;
      if (!applies) return [];
      return [
        Object.freeze({
          definitionId,
          definitionLabel: definition.label,
          effectId: effect.id,
          private: snapshot.private === true,
          providerId:
            provider?.id ?? definition.source.ownerId ?? definition.source.kind,
          providerLabel: provider?.label ?? definition.source.kind,
          score: effect.value,
        }),
      ];
    });
  });
  return Object.freeze({
    effects: Object.freeze(effects),
    totalScore: effects.reduce((total, effect) => total + effect.score, 0),
  });
}

export function privacySafeFreeD6FeatureRollResult(
  result: D6RollResultV1,
): D6RollResultV1 {
  const evidence = result.request.context?.featureEffects;
  if (!evidence || evidence.effects.every(({ private: hidden }) => !hidden)) {
    return result;
  }
  const publicEffects = evidence.effects.filter(
    ({ private: hidden }) => !hidden,
  );
  return Object.freeze({
    ...result,
    request: Object.freeze({
      ...result.request,
      context: Object.freeze({
        ...result.request.context,
        featureEffects: Object.freeze({
          effects: Object.freeze(publicEffects),
          privateEffectCount:
            evidence.privateEffectCount +
            evidence.effects.length -
            publicEffects.length,
          version: 1 as const,
        }),
      }),
    }),
  });
}

export async function persistFreeD6FeatureRollAudit(
  actor: FoundryActorDocument,
  messageId: string,
  result: D6RollResultV1,
): Promise<void> {
  const evidence = result.request.context?.featureEffects;
  if (!evidence || evidence.effects.length === 0) return;
  const featureEconomy = record(actor.system.featureEconomy);
  const current = Array.isArray(featureEconomy.rollAudit)
    ? (featureEconomy.rollAudit as readonly Readonly<{
        messageId?: unknown;
      }>[])
    : [];
  if (current.some((entry) => entry.messageId === messageId)) return;
  const entry = Object.freeze({
    effects: Object.freeze(
      evidence.effects.map((effect) => Object.freeze({ ...effect })),
    ),
    messageId,
    requestKind: result.request.kind,
    source: Object.freeze({ ...result.request.source }),
    total: result.total,
    version: 1 as const,
  });
  await actor.update({
    "system.featureEconomy.rollAudit": Object.freeze(
      [...current, entry].slice(-50),
    ),
  });
}

function requireGm(): void {
  if (game.user?.isGM !== true)
    throw new Error("D6E2.Features.Error.GMRequired");
}

function characterPoints(actor: FoundryActorDocument): number {
  return integer(record(record(actor.system.resources).characterPoints).value);
}

function transactionAudit(
  actor: FoundryActorDocument,
): readonly D6FeatureEconomyTransactionV1[] {
  const entries = record(actor.system.featureEconomy).transactions;
  return Array.isArray(entries)
    ? (entries as readonly D6FeatureEconomyTransactionV1[])
    : [];
}

function validateFeatureAcquisition(
  input: Readonly<{
    actor: FoundryActorDocument;
    definitionId: string;
    operation: "acquire" | "payoff" | "remove";
    phase: D6FeatureEconomyPhase;
    selectedValue: number;
  }>,
): void {
  const definition = resolvedFeatureBenefitDefinition(input.definitionId);
  if (!definition) throw new Error("D6E2.Features.Error.ProviderUnavailable");
  if (!definition.actorTypes.includes(input.actor.type)) {
    throw new Error("D6E2.Features.Error.ActorType");
  }
  const ownedDefinitionIds = new Set(
    input.actor.items.contents.flatMap((item) => {
      if (!["perk", "flaw"].includes(item.type)) return [];
      const definitionId = stringValue(
        record(item.system.featureEconomy).definitionId,
      );
      return definitionId ? [definitionId] : [];
    }),
  );
  if (input.operation === "acquire" && ownedDefinitionIds.has(definition.id)) {
    throw new Error("D6E2.Features.Error.AlreadyOwned");
  }
  if (
    input.operation === "acquire" &&
    definition.prerequisites.some((id) => !ownedDefinitionIds.has(id))
  ) {
    throw new Error("D6E2.Features.Error.Prerequisite");
  }
  if (
    input.operation === "acquire" &&
    definition.conflicts.some((id) => ownedDefinitionIds.has(id))
  ) {
    throw new Error("D6E2.Features.Error.Conflict");
  }
  if (
    input.phase === "creation" &&
    input.operation === "acquire" &&
    definition.role === "flaw"
  ) {
    const draft = readFreeD6CreationDraft(input.actor);
    if (
      record(input.actor.system.creation).active !== true ||
      draft.finalized
    ) {
      throw new Error("D6E2.Features.Error.CreationClosed");
    }
    const existingCredit = input.actor.items.contents
      .filter((item) => item.type === "flaw")
      .reduce(
        (total, item) =>
          total + integer(record(item.system.featureEconomy).pointValue),
        0,
      );
    if (
      existingCredit + input.selectedValue >
      freeD6FlawCreditLimit(draft.budgetUnits / 2)
    ) {
      throw new Error("D6E2.Features.Error.FlawCreditLimit");
    }
  }
  if (input.phase === "creation" && definition.role !== "flaw") {
    const draft = readFreeD6CreationDraft(input.actor);
    if (
      record(input.actor.system.creation).active !== true ||
      draft.finalized
    ) {
      throw new Error("D6E2.Features.Error.CreationClosed");
    }
  }
}

export function freeD6FeatureRequests(
  actor: FoundryActorDocument,
): readonly D6FeatureEconomyRequestV1[] {
  const entries = record(actor.system.featureEconomy).requests;
  return Array.isArray(entries)
    ? (entries as readonly D6FeatureEconomyRequestV1[])
    : [];
}

export async function requestFreeD6FeatureTransaction(
  input: Readonly<{
    actor: FoundryActorDocument;
    definitionId: string;
    focus?: string;
    operation: "acquire" | "payoff" | "remove";
    phase: D6FeatureEconomyPhase;
    private?: boolean;
    selectedValue: number;
    transactionId: string;
  }>,
): Promise<D6FeatureEconomyRequestV1> {
  if (input.actor.isOwner !== true) {
    throw new Error("D6E2.Features.Error.OwnerRequired");
  }
  previewFreeD6FeatureTransaction({
    ...input,
    transactionId: input.transactionId,
  });
  const definition = resolvedFeatureBenefitDefinition(input.definitionId);
  if (!definition) throw new Error("D6E2.Features.Error.ProviderUnavailable");
  const providerLabel =
    featureEconomyRegistry
      .current()
      .find(({ definitions }) =>
        definitions.some(({ id }) => id === input.definitionId),
      )?.label ?? "";
  const requesterId = game.user?.id ?? "";
  const normalizedFocus = input.focus?.trim() ?? "";
  const sameSemantics = (request: D6FeatureEconomyRequestV1) =>
    request.requesterId === requesterId &&
    request.definitionId === input.definitionId &&
    request.operation === input.operation &&
    request.phase === input.phase &&
    request.selectedValue === input.selectedValue &&
    request.focus === normalizedFocus &&
    request.private === (input.private ?? false);
  const requests = freeD6FeatureRequests(input.actor);
  const sameId = requests.find(({ id }) => id === input.transactionId);
  if (sameId) {
    if (sameSemantics(sameId)) return sameId;
    throw new Error("D6E2.Features.Error.TransactionConflict");
  }
  const existing = requests.find(
    (request) => request.status === "pending" && sameSemantics(request),
  );
  if (existing) return existing;
  const request = Object.freeze({
    actorId: input.actor.id,
    definitionId: input.definitionId,
    definitionLabel: definition.label,
    focus: normalizedFocus,
    id: input.transactionId,
    operation: input.operation,
    phase: input.phase,
    private: input.private === true,
    ...(providerLabel ? { providerLabel } : {}),
    requesterId,
    selectedValue: input.selectedValue,
    status: "pending" as const,
    version: 1 as const,
  });
  await input.actor.update({
    "system.featureEconomy.requests": Object.freeze([
      ...freeD6FeatureRequests(input.actor),
      request,
    ]),
  });
  return request;
}

export async function approveFreeD6FeatureRequest(
  actor: FoundryActorDocument,
  requestId: string,
): Promise<D6FeatureEconomyTransactionV1> {
  requireGm();
  const request = freeD6FeatureRequests(actor).find(
    ({ id }) => id === requestId,
  );
  if (!request) throw new Error("D6E2.Features.Error.RequestMissing");
  if (request.status === "rejected") {
    throw new Error("D6E2.Features.Error.TransactionRejected");
  }
  const result = await applyFreeD6FeatureTransaction({
    actor,
    definitionId: request.definitionId,
    focus: request.focus,
    operation: request.operation,
    phase: request.phase,
    private: request.private,
    selectedValue: request.selectedValue,
    transactionId: request.id,
  });
  await actor.update({
    "system.featureEconomy.requests": Object.freeze(
      freeD6FeatureRequests(actor).filter(({ id }) => id !== requestId),
    ),
  });
  return result;
}

export async function rejectFreeD6FeatureRequest(
  actor: FoundryActorDocument,
  requestId: string,
): Promise<D6FeatureEconomyRequestV1> {
  requireGm();
  const requests = freeD6FeatureRequests(actor);
  const request = requests.find(({ id }) => id === requestId);
  if (!request) throw new Error("D6E2.Features.Error.RequestMissing");
  if (request.status === "rejected") return request;
  const rejected = Object.freeze({ ...request, status: "rejected" as const });
  await actor.update({
    "system.featureEconomy.requests": Object.freeze(
      requests.map((entry) => (entry.id === requestId ? rejected : entry)),
    ),
  });
  return rejected;
}

export async function cancelFreeD6FeatureRequest(
  actor: FoundryActorDocument,
  requestId: string,
): Promise<void> {
  const requests = freeD6FeatureRequests(actor);
  const request = requests.find(({ id }) => id === requestId);
  if (!request) return;
  if (game.user?.isGM !== true && request.requesterId !== game.user?.id) {
    throw new Error("D6E2.Features.Error.OwnerRequired");
  }
  await actor.update({
    "system.featureEconomy.requests": Object.freeze(
      requests.filter(({ id }) => id !== requestId),
    ),
  });
}

function existingTransaction(
  actor: FoundryActorDocument,
  transactionId: string,
): D6FeatureEconomyTransactionV1 | undefined {
  return transactionAudit(actor).find(({ id }) => id === transactionId);
}

export function previewFreeD6FeatureTransaction(
  input: Readonly<{
    actor: FoundryActorDocument;
    definitionId: string;
    operation: "acquire" | "payoff" | "remove";
    phase: D6FeatureEconomyPhase;
    private?: boolean;
    selectedValue: number;
    transactionId: string;
  }>,
): D6FeatureEconomyTransactionV1 {
  if (!freeD6FeatureEconomyActive()) {
    throw new Error("D6E2.Features.Error.StrategyInactive");
  }
  const definition = resolvedFeatureBenefitDefinition(input.definitionId);
  if (!definition) throw new Error("D6E2.Features.Error.ProviderUnavailable");
  validateFeatureAcquisition(input);
  return planFreeD6FeatureTransaction({
    actorId: input.actor.id,
    balance:
      input.phase === "creation"
        ? Math.floor(
            freeD6CreationLedger(readFreeD6CreationDraft(input.actor))
              .remainingUnits / 2,
          )
        : characterPoints(input.actor),
    definition,
    id: input.transactionId,
    operation: input.operation,
    phase: input.phase,
    selectedValue: input.selectedValue,
  });
}

export async function applyFreeD6FeatureTransaction(
  input: Readonly<{
    actor: FoundryActorDocument;
    definitionId: string;
    focus?: string;
    operation: "acquire" | "payoff" | "remove";
    phase: D6FeatureEconomyPhase;
    private?: boolean;
    selectedValue: number;
    transactionId: string;
  }>,
): Promise<D6FeatureEconomyTransactionV1> {
  requireGm();
  const previous = existingTransaction(input.actor, input.transactionId);
  if (previous?.status === "approved") return previous;
  const definition = resolvedFeatureBenefitDefinition(input.definitionId);
  if (!definition) throw new Error("D6E2.Features.Error.ProviderUnavailable");
  const pending = previewFreeD6FeatureTransaction(input);
  const approved = approveFeatureTransaction(pending);
  const previousAudit = transactionAudit(input.actor);
  const audit = Object.freeze([...previousAudit, approved]);
  const resourcePath = "system.resources.characterPoints.value";
  if (input.operation === "acquire") {
    const created = await input.actor.createEmbeddedDocuments("Item", [
      {
        name: definition.label,
        type: definition.role === "merit" ? "perk" : "flaw",
        system: {
          featureEconomy: {
            definition: structuredClone(definition),
            definitionId: definition.id,
            focus: input.focus?.trim() ?? "",
            pointValue: input.selectedValue,
            private: input.private === true,
            providerAvailable: true,
            transactionId: approved.id,
            version: 1,
          },
          focus: input.focus?.trim() ?? "",
          rank: 1,
          source: {
            book: "FreeD6 Player Book and GM Guide",
            module: "free-d6",
            page: 21,
          },
        },
      },
    ]);
    try {
      if (input.phase === "creation") {
        const draft = readFreeD6CreationDraft(input.actor);
        const creationTransaction = freeD6CreationTransaction({
          id: `feature:${approved.id}`,
          kind: definition.role,
          label: definition.label,
          points: approved.cost,
          sourceId: definition.id,
        });
        const nextDraft = replaceFreeD6CreationTransaction(
          draft,
          creationTransaction,
          creationTransaction.id,
          draft.revision,
        );
        await input.actor.update({
          "system.creation.freeD6": nextDraft,
          "system.featureEconomy.transactions": audit,
        });
      } else {
        await input.actor.update({
          [resourcePath]: approved.balanceAfter,
          "system.featureEconomy.transactions": audit,
        });
      }
    } catch (error) {
      if (created[0])
        await input.actor.deleteEmbeddedDocuments("Item", [created[0].id]);
      throw error;
    }
    return approved;
  }
  const item = input.actor.items.contents.find(
    (candidate) =>
      ["perk", "flaw"].includes(candidate.type) &&
      stringValue(record(candidate.system.featureEconomy).definitionId) ===
        definition.id,
  );
  if (!item) throw new Error("D6E2.Features.Error.OwnedFeatureRequired");
  await input.actor.update({
    [resourcePath]: approved.balanceAfter,
    "system.featureEconomy.transactions": audit,
  });
  try {
    await input.actor.deleteEmbeddedDocuments("Item", [item.id]);
  } catch (error) {
    await input.actor.update({
      [resourcePath]: approved.balanceBefore,
      "system.featureEconomy.transactions": previousAudit,
    });
    throw error;
  }
  return approved;
}

export async function awardFreeD6CharacterPoints(
  actor: FoundryActorDocument,
  amount: number,
): Promise<Readonly<{ characterPoints: number; veteranPoints: number }>> {
  requireGm();
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(
      "Character Point award must be a non-negative integer.",
    );
  }
  const resources = record(actor.system.resources);
  const characterPointValue =
    integer(record(resources.characterPoints).value) + amount;
  const veteranPointValue =
    integer(record(resources.veteranPoints).value) + amount;
  await actor.update({
    "system.resources.characterPoints.value": characterPointValue,
    "system.resources.veteranPoints.value": veteranPointValue,
  });
  return Object.freeze({
    characterPoints: characterPointValue,
    veteranPoints: veteranPointValue,
  });
}
