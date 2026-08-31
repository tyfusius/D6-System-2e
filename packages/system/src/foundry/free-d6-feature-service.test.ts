import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6RollResultV1 } from "@d6-system-2e/core";
import {
  featureEconomyRegistry,
  resetFeatureEconomyRegistryForTests,
} from "../registries/feature-economy";
import {
  applyFreeD6FeatureTransaction,
  approveFreeD6FeatureRequest,
  awardFreeD6CharacterPoints,
  cancelFreeD6FeatureRequest,
  freeD6FeatureRollModifier,
  persistFreeD6FeatureRollAudit,
  previewFreeD6FeatureTransaction,
  privacySafeFreeD6FeatureRollResult,
  requestFreeD6FeatureTransaction,
  rejectFreeD6FeatureRequest,
} from "./free-d6-feature-service";

vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    strategies: { featureEconomy: "free-d6.features.merits-flaws" },
  }),
}));

function registerDefinition(role: "flaw" | "merit") {
  featureEconomyRegistry.register("world", {
    definitions: [
      {
        actorTypes: ["character"],
        conflicts: [],
        effects: [
          { id: "effect", kind: "roll-modifier", scope: "all-rolls", value: 3 },
        ],
        id: `world/${role}`,
        label: role === "merit" ? "Merit" : "Flaw",
        pointValue: { kind: "exact", value: 2 },
        prerequisites: [],
        role,
        source: { kind: "world" },
        version: 1,
      },
    ],
    id: `world.${role}`,
    label: "Test",
    version: 2,
  });
}

function actor() {
  const contents: {
    id: string;
    name?: string;
    system: Record<string, unknown>;
    type: string;
  }[] = [];
  const system = {
    creation: { active: true, freeD6: {} as unknown },
    featureEconomy: { requests: [] as unknown, transactions: [] as unknown },
    resources: {
      characterPoints: { value: 20 },
      veteranPoints: { value: 5 },
    },
  };
  const createEmbeddedDocuments = vi.fn(
    (
      _kind: string,
      sources: readonly Record<string, unknown>[],
    ): Promise<readonly Record<string, unknown>[]> => {
      const source = sources[0] ?? {};
      const created = {
        ...source,
        id: "created",
        system: (source.system ?? {}) as Record<string, unknown>,
        type: typeof source.type === "string" ? source.type : "",
      };
      contents.push(created);
      return Promise.resolve([created]);
    },
  );
  const deleteEmbeddedDocuments = vi.fn(
    (_kind: string, ids: readonly string[]): Promise<void> => {
      const index = contents.findIndex(({ id }) => ids.includes(id));
      if (index >= 0) contents.splice(index, 1);
      return Promise.resolve();
    },
  );
  const update = vi.fn((changes: Record<string, unknown>): Promise<void> => {
    if (changes["system.resources.characterPoints.value"] !== undefined) {
      system.resources.characterPoints.value = Number(
        changes["system.resources.characterPoints.value"],
      );
    }
    if (changes["system.resources.veteranPoints.value"] !== undefined) {
      system.resources.veteranPoints.value = Number(
        changes["system.resources.veteranPoints.value"],
      );
    }
    if (changes["system.featureEconomy.transactions"] !== undefined) {
      system.featureEconomy.transactions =
        changes["system.featureEconomy.transactions"];
    }
    if (changes["system.featureEconomy.requests"] !== undefined) {
      system.featureEconomy.requests =
        changes["system.featureEconomy.requests"];
    }
    if (changes["system.featureEconomy.rollAudit"] !== undefined) {
      (system.featureEconomy as Record<string, unknown>).rollAudit =
        changes["system.featureEconomy.rollAudit"];
    }
    return Promise.resolve();
  });
  const subject = {
    id: "actor",
    isOwner: true,
    type: "character",
    items: { contents },
    system,
    createEmbeddedDocuments,
    deleteEmbeddedDocuments,
    update,
  };
  return {
    contents,
    createEmbeddedDocuments,
    document: subject as unknown as FoundryActorDocument,
    system,
    update,
  };
}

describe("FreeD6 feature transactions", () => {
  beforeEach(() => vi.stubGlobal("game", { user: { isGM: true } }));
  afterEach(resetFeatureEconomyRegistryForTests);

  it("keeps preview non-mutating and applies an acquisition once", async () => {
    registerDefinition("merit");
    const { createEmbeddedDocuments, document: subject, system } = actor();
    expect(
      previewFreeD6FeatureTransaction({
        actor: subject,
        definitionId: "world/merit",
        operation: "acquire",
        phase: "advancement",
        selectedValue: 2,
        transactionId: "tx",
      }),
    ).toMatchObject({ balanceAfter: 12, status: "pending" });
    expect(createEmbeddedDocuments).not.toHaveBeenCalled();
    await applyFreeD6FeatureTransaction({
      actor: subject,
      definitionId: "world/merit",
      operation: "acquire",
      phase: "advancement",
      selectedValue: 2,
      transactionId: "tx",
    });
    await applyFreeD6FeatureTransaction({
      actor: subject,
      definitionId: "world/merit",
      operation: "acquire",
      phase: "advancement",
      selectedValue: 2,
      transactionId: "tx",
    });
    expect(createEmbeddedDocuments).toHaveBeenCalledOnce();
    expect(system.resources.characterPoints.value).toBe(12);
  });

  it("fails closed when a provider disappears", () => {
    registerDefinition("merit");
    const { document: subject } = actor();
    resetFeatureEconomyRegistryForTests();
    expect(() =>
      previewFreeD6FeatureTransaction({
        actor: subject,
        definitionId: "world/merit",
        operation: "acquire",
        phase: "creation",
        selectedValue: 2,
        transactionId: "tx",
      }),
    ).toThrow("D6E2.Features.Error.ProviderUnavailable");
  });

  it("enforces prerequisites, conflicts, duplicates, and the creation Flaw credit cap", () => {
    registerDefinition("flaw");
    const { contents, document: subject, system } = actor();
    system.creation.freeD6 = {
      budgetUnits: 60,
      strategyId: "free-d6.creation.creation-points",
      transactions: [],
      version: 1,
    };
    expect(() =>
      previewFreeD6FeatureTransaction({
        actor: subject,
        definitionId: "world/flaw",
        operation: "acquire",
        phase: "creation",
        selectedValue: 2,
        transactionId: "credit",
      }),
    ).not.toThrow();
    const definition = featureEconomyRegistry
      .current()
      .find(({ id }) => id === "world.flaw")?.definitions[0];
    expect(definition?.role).toBe("flaw");
    contents.push({
      id: "existing",
      type: "flaw",
      system: {
        featureEconomy: { definitionId: "world/other", pointValue: 9 },
      },
    });
    expect(() =>
      previewFreeD6FeatureTransaction({
        actor: subject,
        definitionId: "world/flaw",
        operation: "acquire",
        phase: "creation",
        selectedValue: 2,
        transactionId: "over-credit",
      }),
    ).toThrow("D6E2.Features.Error.FlawCreditLimit");
  });

  it("lets an owner request and only a GM approve an idempotent acquisition", async () => {
    registerDefinition("merit");
    const { createEmbeddedDocuments, document: subject, system } = actor();
    (subject as unknown as { isOwner: boolean }).isOwner = true;
    vi.stubGlobal("game", { user: { id: "player", isGM: false } });
    await requestFreeD6FeatureTransaction({
      actor: subject,
      definitionId: "world/merit",
      operation: "acquire",
      phase: "advancement",
      selectedValue: 2,
      transactionId: "requested",
    });
    expect(system.featureEconomy.requests).toHaveLength(1);
    expect(createEmbeddedDocuments).not.toHaveBeenCalled();

    vi.stubGlobal("game", { user: { id: "gm", isGM: true } });
    await approveFreeD6FeatureRequest(subject, "requested");
    expect(createEmbeddedDocuments).toHaveBeenCalledOnce();
    expect(system.featureEconomy.requests).toEqual([]);
  });

  it("deduplicates semantic owner requests and supports reject, cancel, and provider return", async () => {
    registerDefinition("merit");
    const { document: subject, system } = actor();
    vi.stubGlobal("game", { user: { id: "player", isGM: false } });
    const first = await requestFreeD6FeatureTransaction({
      actor: subject,
      definitionId: "world/merit",
      focus: " Scout ",
      operation: "acquire",
      phase: "advancement",
      private: true,
      selectedValue: 2,
      transactionId: "request-a",
    });
    const duplicate = await requestFreeD6FeatureTransaction({
      actor: subject,
      definitionId: "world/merit",
      focus: "Scout",
      operation: "acquire",
      phase: "advancement",
      private: true,
      selectedValue: 2,
      transactionId: "request-b",
    });
    expect(duplicate).toBe(first);
    expect(system.featureEconomy.requests).toHaveLength(1);

    vi.stubGlobal("game", { user: { id: "gm", isGM: true } });
    await rejectFreeD6FeatureRequest(subject, first.id);
    expect(system.featureEconomy.requests).toEqual([
      expect.objectContaining({
        id: first.id,
        private: true,
        status: "rejected",
      }),
    ]);
    await expect(
      approveFreeD6FeatureRequest(subject, first.id),
    ).rejects.toThrow("D6E2.Features.Error.TransactionRejected");

    vi.stubGlobal("game", { user: { id: "player", isGM: false } });
    await cancelFreeD6FeatureRequest(subject, first.id);
    expect(system.featureEconomy.requests).toEqual([]);

    const pending = await requestFreeD6FeatureTransaction({
      actor: subject,
      definitionId: "world/merit",
      operation: "acquire",
      phase: "advancement",
      selectedValue: 2,
      transactionId: "provider-return",
    });
    resetFeatureEconomyRegistryForTests();
    vi.stubGlobal("game", { user: { id: "gm", isGM: true } });
    await expect(
      approveFreeD6FeatureRequest(subject, pending.id),
    ).rejects.toThrow("D6E2.Features.Error.ProviderUnavailable");
    expect(system.featureEconomy.requests).toHaveLength(1);
    registerDefinition("merit");
    await approveFreeD6FeatureRequest(subject, pending.id);
    expect(system.featureEconomy.requests).toEqual([]);
    expect(system.featureEconomy.transactions).toEqual([
      expect.objectContaining({ id: pending.id, status: "approved" }),
    ]);
  });

  it("rejects reuse of a request ID for different transaction semantics", async () => {
    registerDefinition("merit");
    const { document: subject, system } = actor();
    vi.stubGlobal("game", { user: { id: "player", isGM: false } });
    const first = await requestFreeD6FeatureTransaction({
      actor: subject,
      definitionId: "world/merit",
      focus: "shooting",
      operation: "acquire",
      phase: "advancement",
      private: true,
      selectedValue: 2,
      transactionId: "stable-request",
    });

    await expect(
      requestFreeD6FeatureTransaction({
        actor: subject,
        definitionId: "world/merit",
        focus: "piloting",
        operation: "acquire",
        phase: "advancement",
        private: true,
        selectedValue: 2,
        transactionId: "stable-request",
      }),
    ).rejects.toThrow("D6E2.Features.Error.TransactionConflict");
    await expect(
      requestFreeD6FeatureTransaction({
        actor: subject,
        definitionId: "world/merit",
        focus: "shooting",
        operation: "acquire",
        phase: "advancement",
        private: true,
        selectedValue: 2,
        transactionId: "stable-request",
      }),
    ).resolves.toEqual(first);
    expect(system.featureEconomy.requests).toEqual([first]);
  });

  it("awards Character and Veteran Points atomically", async () => {
    const { document: subject, update } = actor();
    await awardFreeD6CharacterPoints(subject, 3);
    expect(update).toHaveBeenCalledWith({
      "system.resources.characterPoints.value": 23,
      "system.resources.veteranPoints.value": 8,
    });
  });

  it("persists contributed effect provenance while redacting private chat evidence", () => {
    registerDefinition("merit");
    const { contents, document: subject } = actor();
    contents.push({
      id: "private-merit",
      name: "Secret Merit",
      system: {
        featureEconomy: {
          definitionId: "world/merit",
          private: true,
        },
      },
      type: "perk",
    });
    const modifier = freeD6FeatureRollModifier(subject, {
      kind: "attribute",
      source: { attributeId: "agility" },
    });
    expect(modifier).toEqual({
      effects: [
        {
          definitionId: "world/merit",
          definitionLabel: "Merit",
          effectId: "effect",
          private: true,
          providerId: "world.merit",
          providerLabel: "Test",
          score: 3,
        },
      ],
      totalScore: 3,
    });
    const result = {
      contractVersion: 2,
      request: {
        context: {
          featureEffects: {
            effects: modifier.effects,
            privateEffectCount: 0,
            version: 1,
          },
        },
      },
    } as D6RollResultV1;
    const projected = privacySafeFreeD6FeatureRollResult(result);
    expect(projected.request.context?.featureEffects).toEqual({
      effects: [],
      privateEffectCount: 1,
      version: 1,
    });
    expect(JSON.stringify(projected)).not.toContain("world/merit");
    expect(JSON.stringify(projected)).not.toContain("Secret Merit");
    expect(JSON.stringify(projected)).not.toContain('"score":3');
  });

  it("persists full private roll evidence authoritatively exactly once", async () => {
    registerDefinition("merit");
    const { contents, document: subject, system, update } = actor();
    contents.push({
      id: "private-merit",
      name: "Secret Merit",
      system: {
        featureEconomy: { definitionId: "world/merit", private: true },
      },
      type: "perk",
    });
    const modifier = freeD6FeatureRollModifier(subject, {
      kind: "attribute",
      source: { attributeId: "agility" },
    });
    const result = {
      contractVersion: 2,
      request: {
        context: {
          featureEffects: {
            effects: modifier.effects,
            privateEffectCount: 0,
            version: 1,
          },
        },
        kind: "attribute",
        source: { actorId: "actor", attributeId: "agility" },
      },
      total: 14,
    } as D6RollResultV1;

    await persistFreeD6FeatureRollAudit(subject, "message-1", result);
    await persistFreeD6FeatureRollAudit(subject, "message-1", result);

    expect(
      (system.featureEconomy as Record<string, unknown>).rollAudit,
    ).toEqual([
      expect.objectContaining({
        effects: [
          expect.objectContaining({
            definitionId: "world/merit",
            private: true,
            providerId: "world.merit",
            score: 3,
          }),
        ],
        messageId: "message-1",
        requestKind: "attribute",
        total: 14,
      }),
    ]);
    expect(
      update.mock.calls.filter(
        ([changes]) => changes["system.featureEconomy.rollAudit"] !== undefined,
      ),
    ).toHaveLength(1);
  });

  it("does not apply a stale creation request after creation closes", () => {
    registerDefinition("merit");
    const { document: subject, system } = actor();
    system.creation.active = false;
    expect(() =>
      previewFreeD6FeatureTransaction({
        actor: subject,
        definitionId: "world/merit",
        operation: "acquire",
        phase: "creation",
        selectedValue: 2,
        transactionId: "stale",
      }),
    ).toThrow("D6E2.Features.Error.CreationClosed");
  });
});
