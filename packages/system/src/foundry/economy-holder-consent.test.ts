import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCurrencyWallet,
  currencyDefinitionFingerprint,
  currencyWalletFingerprint,
  type D6CurrencyDefinitionV1,
} from "@d6-system-2e/core";

const definition: D6CurrencyDefinitionV1 = {
  denominations: [
    {
      displayPrecision: 0,
      id: "credit",
      pluralName: "Credits",
      ratioToParent: "1",
      singularName: "Credit",
      symbol: "₡",
    },
  ],
  id: "credits",
  revision: 1,
  version: 1,
};

const holderMocks = vi.hoisted(() => ({
  execute: vi.fn<
    (
      request: unknown,
      requester: unknown,
      operationId: string,
      targetControllerUserId: string | null,
    ) => Promise<{
      amount: string;
      denominationId: string;
      sourceLabel: string;
      targetLabel: string;
      valueSmallestUnit: string;
    }>
  >(() =>
    Promise.resolve({
      amount: "2",
      denominationId: "credit",
      sourceLabel: "Rook's pack",
      targetLabel: "Vale",
      valueSmallestUnit: "2",
    }),
  ),
  source: undefined as Record<string, unknown> | undefined,
  target: undefined as Record<string, unknown> | undefined,
  targetOwner: undefined as FoundryUser | undefined,
}));

vi.mock("./currency-holder-service", () => ({
  activeCurrencyHolderControllers: () => [holderMocks.targetOwner],
  executeCurrencyHolderTransfer: (
    request: unknown,
    requester: unknown,
    operationId: string,
    targetControllerUserId: string | null,
  ) =>
    holderMocks.execute(
      request,
      requester,
      operationId,
      targetControllerUserId,
    ),
  resolveCurrencyHolder: (reference: { id: string }) =>
    Promise.resolve(
      reference.id === "Actor.source" ? holderMocks.source : holderMocks.target,
    ),
  resetCurrencyHolderServiceForTests: () => undefined,
  synchronizePendingCurrencyHolderTransfers: () => Promise.resolve(),
  userMayControlCurrencyHolder: (
    holder: unknown,
    user: { id: string; isGM: boolean },
  ) =>
    user.isGM ||
    (holder === holderMocks.source && user.id === "player") ||
    (holder === holderMocks.target && user.id === "recipient"),
}));

import {
  __testing,
  type EconomyCurrencyHolderTransferRequest,
} from "./economy-service";

describe("storage holder recipient consent", () => {
  beforeEach(() => {
    holderMocks.execute.mockClear();
    __testing.resetQueue();
  });

  it("binds the accepted target controller into execution after materializing its private snapshot", async () => {
    const player = {
      active: true,
      id: "player",
      isGM: false,
      name: "Sending Player",
    } as FoundryUser;
    const recipient = {
      active: true,
      id: "recipient",
      isGM: false,
      name: "Recipient",
    } as FoundryUser;
    const gm = {
      active: true,
      id: "gm",
      isGM: true,
      name: "GM",
    } as FoundryUser;
    const sourceWallet = createCurrencyWallet(definition, { credit: "5" });
    const targetWallet = createCurrencyWallet(definition, { credit: "1" });
    const sourceActor = {
      id: "source",
      items: { contents: [] },
      name: "Rook",
      system: { profile: { currency: 5, currencyWallet: sourceWallet } },
      testUserPermission: (user: FoundryUser) => user.id === player.id,
      type: "character",
      uuid: "Actor.source",
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    const targetActor = {
      id: "target",
      items: { contents: [] },
      name: "Vale",
      system: { profile: { currency: 1, currencyWallet: targetWallet } },
      testUserPermission: (user: FoundryUser) => user.id === recipient.id,
      type: "character",
      uuid: "Actor.target",
    } as unknown as FoundryActorDocument & { readonly uuid: string };
    holderMocks.source = {
      custodyRoot: sourceActor,
      document: sourceActor,
      label: "Rook's pack",
      ownerRoot: sourceActor,
      reachable: true,
      reference: { id: sourceActor.uuid, kind: "root", version: 1 },
      state: {
        currentDefinition: definition,
        invalidStoredWallet: false,
        stale: false,
        unresolvedLegacy: false,
        wallet: sourceWallet,
      },
    };
    holderMocks.target = {
      custodyRoot: targetActor,
      document: targetActor,
      label: "Vale",
      ownerRoot: targetActor,
      reachable: true,
      reference: { id: targetActor.uuid, kind: "root", version: 1 },
      state: {
        currentDefinition: definition,
        invalidStoredWallet: false,
        stale: false,
        unresolvedLegacy: false,
        wallet: targetWallet,
      },
    };
    holderMocks.targetOwner = recipient;
    const emit = vi.fn();
    vi.stubGlobal("game", {
      actors: {
        contents: [sourceActor, targetActor],
        get: (id: string) =>
          id === sourceActor.id ? sourceActor : targetActor,
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => true, set: vi.fn().mockResolvedValue(undefined) },
      socket: { emit },
      user: gm,
      users: {
        contents: [gm, player, recipient],
        get: (id: string) =>
          [gm, player, recipient].find((user) => user.id === id),
      },
    });
    vi.stubGlobal("window", { setTimeout: vi.fn() });
    vi.stubGlobal("foundry", {
      applications: {
        handlebars: { renderTemplate: vi.fn().mockResolvedValue("receipt") },
      },
    });
    vi.stubGlobal("ChatMessage", {
      create: vi.fn().mockResolvedValue({}),
      getSpeaker: vi.fn().mockReturnValue({}),
    });
    const request: EconomyCurrencyHolderTransferRequest = {
      holderTransfer: {
        amount: "2",
        definitionFingerprint: currencyDefinitionFingerprint(definition),
        definitionRevision: definition.revision,
        denominationId: "credit",
        expectedSourceTotalSmallestUnit: sourceWallet.totalSmallestUnit,
        expectedSourceWalletFingerprint:
          currencyWalletFingerprint(sourceWallet),
        expectedTargetTotalSmallestUnit: "",
        expectedTargetWalletFingerprint: "",
        source: { id: sourceActor.uuid, kind: "root", version: 1 },
        target: { id: targetActor.uuid, kind: "root", version: 1 },
        version: 1,
      },
      sourceActorId: sourceActor.id,
      targetActorId: targetActor.id,
      type: "currency-holder-transfer",
    };

    const completion = __testing.approveAndExecute(
      request,
      player,
      "holder-consent-1",
    );
    await vi.waitFor(() =>
      expect(emit).toHaveBeenCalledWith(
        "system.d6-system-2e",
        expect.objectContaining({
          requestId: "holder-consent-1",
          sourceName: "Rook's pack",
          targetName: "Vale",
          targetUserId: recipient.id,
          type: "economy-approval-request",
        }),
      ),
    );
    const approvalPayload = emit.mock.calls.find(
      ([, value]) =>
        (value as { type?: string }).type === "economy-approval-request",
    )?.[1] as Record<string, unknown>;
    expect(approvalPayload).not.toHaveProperty("request");
    expect(approvalPayload).toMatchObject({
      amount: "2",
      approvalType: "currency-holder-transfer",
      sourceActorId: sourceActor.id,
      targetActorId: targetActor.id,
      targetHolder: { id: targetActor.uuid, kind: "root", version: 1 },
    });
    expect(approvalPayload).not.toHaveProperty(
      "expectedTargetTotalSmallestUnit",
    );
    expect(approvalPayload).not.toHaveProperty(
      "expectedTargetWalletFingerprint",
    );
    expect(JSON.stringify(approvalPayload)).not.toContain(
      currencyWalletFingerprint(targetWallet),
    );
    await __testing.receive({
      accepted: true,
      requestId: "holder-consent-1",
      requesterUserId: player.id,
      targetUserId: recipient.id,
      type: "economy-approval-response",
    });
    await completion;

    expect(holderMocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedTargetTotalSmallestUnit: targetWallet.totalSmallestUnit,
        expectedTargetWalletFingerprint:
          currencyWalletFingerprint(targetWallet),
      }),
      player,
      "holder-consent-1",
      recipient.id,
    );
  });
});
