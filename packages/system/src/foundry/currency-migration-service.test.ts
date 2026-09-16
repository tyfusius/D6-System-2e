/* eslint-disable @typescript-eslint/unbound-method -- Foundry methods are behavioral spies. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import {
  createCurrencyWallet,
  exactLegacyCurrencyValue,
  type D6CurrencyDefinitionV1,
  type D6CurrencyValueV1,
  type D6CurrencyWalletV1,
} from "@d6-system-2e/core";
import {
  applyCurrentCurrencyMigrations,
  openCurrencyMigrationDialog,
  previewCurrentCurrencyMigrations,
} from "./currency-migration-service";
import {
  actorCurrencyWalletState,
  currentDefinitionWalletReplacementChanges,
  currencyValueChanges,
  currencyWalletChanges,
  currencyWalletEditFingerprint,
  denominationCountChanges,
  directCurrencyDenominationId,
  previewCurrencyValueMigration,
  previewWalletMigration,
  unresolvedCurrencyValueChanges,
} from "./currency-state";
import { LEGACY_CURRENCY_DEFINITION } from "../migrations/058-add-currency-denominations";

const definitions = vi.hoisted<{ current: D6CurrencyDefinitionV1 }>(() => ({
  current: {
    denominations: [
      {
        displayPrecision: 2,
        id: "dollar",
        pluralName: "Dollars",
        ratioToParent: "1",
        singularName: "Dollar",
        symbol: "$",
      },
      {
        displayPrecision: 0,
        id: "cent",
        pluralName: "Cents",
        ratioToParent: "100",
        singularName: "Cent",
        symbol: "¢",
      },
      {
        displayPrecision: 0,
        id: "mill",
        pluralName: "Mills",
        ratioToParent: "10",
        singularName: "Mill",
        symbol: "",
      },
    ],
    id: "table-currency",
    revision: 2,
    version: 1,
  },
}));
const holderMigrationWrite = vi.hoisted(() =>
  vi.fn<
    (
      reference: unknown,
      fingerprint: string,
      wallet: D6CurrencyWalletV1,
    ) => Promise<void>
  >(() => Promise.resolve()),
);

vi.mock("../settings/setting-profile", () => ({
  currentSettingProfile: () => ({ currency: definitions.current }),
}));
vi.mock("./currency-holder-service.js", () => ({
  containerCurrencyHolderRef: (id: string) => ({
    id,
    kind: "container",
    version: 1,
  }),
  rootCurrencyHolderRef: (actor: { uuid: string }) => ({
    id: actor.uuid,
    kind: "root",
    version: 1,
  }),
  writeCurrencyHolderWalletMigration: (
    reference: unknown,
    fingerprint: string,
    wallet: D6CurrencyWalletV1,
  ) => holderMigrationWrite(reference, fingerprint, wallet),
}));

const defaultCurrentDefinition = definitions.current;
const oldDefinition: D6CurrencyDefinitionV1 = {
  ...defaultCurrentDefinition,
  denominations: defaultCurrentDefinition.denominations.slice(0, 2),
  revision: 1,
};

const legacyMain = LEGACY_CURRENCY_DEFINITION.denominations[0];
if (!legacyMain) throw new Error("legacy main denomination required");
const legacyWithCents: D6CurrencyDefinitionV1 = {
  ...LEGACY_CURRENCY_DEFINITION,
  denominations: [
    legacyMain,
    {
      displayPrecision: 0,
      id: "cent",
      pluralName: "Cents",
      ratioToParent: "100",
      singularName: "Cent",
      symbol: "",
    },
  ],
  revision: 2,
};

describe("Foundry currency revision migration", () => {
  let actor: FoundryActorDocument;
  let item: FoundryItemDocument;

  beforeEach(() => {
    holderMigrationWrite.mockClear();
    definitions.current = defaultCurrentDefinition;
    const actorSystem = {
      profile: {
        currency: 1,
        currencyWallet: createCurrencyWallet(oldDefinition, {
          cent: "50",
          dollar: "1",
        }),
      },
    };
    actor = {
      id: "hero",
      items: { contents: [] },
      name: "Hero",
      system: actorSystem,
      type: "character",
      update: vi.fn((changes: Record<string, unknown>) => {
        const wallet = changes["system.profile.currencyWallet"];
        if (wallet) {
          const foundrySource = wallet as {
            counts: Record<string, string>;
          };
          foundrySource.counts = { ...foundrySource.counts };
          actorSystem.profile.currencyWallet = wallet as D6CurrencyWalletV1;
        }
        return Promise.resolve();
      }),
    } as unknown as FoundryActorDocument;

    const itemSystem = {
      currencyValue: exactLegacyCurrencyValue(oldDefinition, "0.25"),
      value: 0.25,
    };
    item = {
      id: "gear",
      name: "Gear",
      system: itemSystem,
      type: "gear",
      uuid: "Item.gear",
      update: vi.fn((changes: Record<string, unknown>) => {
        const value = changes["system.currencyValue"];
        if (value) {
          const foundrySource = value as {
            definition: D6CurrencyDefinitionV1;
          };
          foundrySource.definition = { ...foundrySource.definition };
          itemSystem.currencyValue = value as D6CurrencyValueV1;
        }
        return Promise.resolve();
      }),
    } as unknown as FoundryItemDocument;
    vi.stubGlobal("game", {
      actors: {
        contents: [actor],
        get: (id: string) => (id === actor.id ? actor : undefined),
      },
      i18n: {
        format: (key: string, data: Record<string, string | number>): string =>
          `${key}:${data.shown}/${data.total}/${data.selected}`,
        localize: (key: string) => key,
      },
      items: { contents: [item] },
      user: { isGM: true },
    });
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve(uuid === item.uuid ? item : null),
      ),
    );
    vi.stubGlobal("foundry", {
      applications: {
        api: { DialogV2: { wait: vi.fn().mockResolvedValue(null) } },
        handlebars: { renderTemplate: vi.fn().mockResolvedValue("preview") },
      },
    });
  });

  it("previews user-readable values and applies only after the exact snapshot is rechecked", async () => {
    const preview = previewCurrentCurrencyMigrations();
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]?.documentName).toBe("Hero");
    expect(preview.rows[0]?.ownerLabel).toBe("Hero");
    expect(preview.rows[0]?.exact).toBe(true);
    expect(preview.rows[0]?.sourceValue).toContain("1 Dollar");
    expect(preview.rows[0]?.targetValue).toContain("50 Cents");
    expect(preview.rows[1]?.documentName).toBe("Gear");
    expect(preview.rows[1]?.ownerLabel).toBe(
      "D6E2.CurrencyMigration.WorldItems",
    );
    expect(preview.rows[1]?.searchText).toContain("Gear");
    expect(preview.rows[1]?.exact).toBe(true);
    expect(preview.rows[1]?.sourceValue).toContain("25 Cents");
    expect(preview.rows[1]?.targetValue).toContain("250 Mills");
    await applyCurrentCurrencyMigrations(
      preview,
      preview.rows.map((row) => row.selectionKey),
    );
    expect(actor.update).toHaveBeenCalledOnce();
    expect(item.update).toHaveBeenCalledOnce();
    expect(
      (actor.system.profile as { currencyWallet: D6CurrencyWalletV1 })
        .currencyWallet.totalSmallestUnit,
    ).toBe("1500");
    expect(
      (item.system.currencyValue as D6CurrencyValueV1).amountSmallestUnit,
    ).toBe("250");
  });

  it("previews and migrates configured root and container wallets", async () => {
    const rootContents: FoundryItemDocument[] = [];
    const rootSystem = {
      currencyWallet: createCurrencyWallet(oldDefinition, {
        cent: "50",
        dollar: "2",
      }),
      storage: { configured: true },
    };
    const root = {
      id: "wagon",
      uuid: "Actor.wagon",
      items: { contents: rootContents },
      name: "Wagon",
      system: rootSystem,
      type: "vehicle",
      update: vi.fn((changes: Record<string, unknown>) => {
        if (changes["system.currencyWallet"])
          rootSystem.currencyWallet = changes[
            "system.currencyWallet"
          ] as D6CurrencyWalletV1;
        return Promise.resolve();
      }),
    } as unknown as FoundryActorDocument;
    const containerSystem = {
      currencyWallet: createCurrencyWallet(oldDefinition, { dollar: "1" }),
      storageInterior: { configured: true },
    };
    const container = {
      id: "pouch",
      uuid: "Actor.wagon.Item.pouch",
      name: "Pouch",
      parent: root,
      system: containerSystem,
      type: "gear",
      update: vi.fn((changes: Record<string, unknown>) => {
        if (changes["system.currencyWallet"])
          containerSystem.currencyWallet = changes[
            "system.currencyWallet"
          ] as D6CurrencyWalletV1;
        return Promise.resolve();
      }),
    } as unknown as FoundryItemDocument;
    rootContents.push(container);
    Object.assign(game.actors ?? {}, {
      contents: [actor, root],
      get: (id: string) =>
        id === actor.id ? actor : id === root.id ? root : undefined,
    });
    vi.mocked(fromUuid).mockImplementation((uuid: string) =>
      Promise.resolve(
        uuid === item.uuid
          ? item
          : uuid === root.uuid
            ? root
            : uuid === container.uuid
              ? container
              : null,
      ),
    );

    const preview = previewCurrentCurrencyMigrations();
    const rows = preview.rows.filter(
      ({ documentType }) => documentType === "storage-wallet",
    );
    expect(rows).toMatchObject([
      { documentName: "Wagon", ownerLabel: "Wagon", exact: true },
      { documentName: "Pouch", ownerLabel: "Wagon", exact: true },
    ]);
    await applyCurrentCurrencyMigrations(
      preview,
      rows.map(({ selectionKey }) => selectionKey),
    );

    expect(holderMigrationWrite).toHaveBeenCalledTimes(2);
    expect(
      holderMigrationWrite.mock.calls.map((call) => call[2]),
    ).toMatchObject([
      { definitionRevision: 2, totalSmallestUnit: "2500" },
      { definitionRevision: 2, totalSmallestUnit: "1000" },
    ]);
  });

  it("blocks denomination migration while an exact transfer awaits recovery", async () => {
    const profile = actor.system.profile as {
      currencyWallet: D6CurrencyWalletV1;
    };
    profile.currencyWallet = createCurrencyWallet(
      oldDefinition,
      { dollar: "1" },
      [],
      {
        pending: {
          createdAt: 1,
          intent: "pending-intent",
          recoveryRequest: "{}",
          requesterUserId: "player",
          status: "pending-transfer",
        },
      },
    );
    const preview = previewCurrentCurrencyMigrations();
    expect(preview.rows[0]).toMatchObject({
      documentType: "actor-wallet",
      exact: false,
      reason: "pending-transfer",
    });
    await expect(applyCurrentCurrencyMigrations(preview, [])).rejects.toThrow(
      "D6E2.Economy.Error.StaleBalance",
    );
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("identifies an embedded item's actor owner without changing its UUID selection key", () => {
    Object.assign(item, { parent: actor });
    Object.assign(actor.items, { contents: [item] });
    Object.assign(game.items ?? {}, { contents: [] });

    const row = previewCurrentCurrencyMigrations().rows.find(
      ({ documentType }) => documentType === "item-price",
    );
    expect(row).toMatchObject({
      documentId: "Item.gear",
      ownerLabel: "Hero",
      searchText: "Gear Hero",
      selectionKey: "item-price:Item.gear",
    });
  });

  it("filters migration rows by record or owner while retaining hidden selections", async () => {
    interface DialogOptions {
      readonly render?: (
        event: Event,
        dialog: { readonly element: HTMLElement },
      ) => void;
    }
    let dialogOptions: DialogOptions | undefined;
    vi.mocked(foundry.applications.api.DialogV2.wait).mockImplementationOnce(
      (options: unknown) => {
        dialogOptions = options as DialogOptions;
        return Promise.resolve(null);
      },
    );
    await openCurrencyMigrationDialog();

    const { document } = parseHTML(`
      <div id="dialog">
        <input data-currency-migration-filter>
        <p data-currency-migration-status></p>
        <p data-currency-migration-empty hidden></p>
        <div data-currency-migration-search="Hero Hero">
          <input type="checkbox" name="selectedMigration" checked>
        </div>
        <div data-currency-migration-search="Gear World items">
          <input type="checkbox" name="selectedMigration">
        </div>
      </div>
    `);
    const documentWindow = document.defaultView;
    if (!documentWindow) throw new Error("document window required");
    const root = document.querySelector("#dialog") as unknown as HTMLElement;
    const selectedMigration = root.querySelector<HTMLInputElement>(
      'input[name="selectedMigration"]',
    );
    if (!selectedMigration) throw new Error("selected migration required");
    selectedMigration.checked = true;
    dialogOptions?.render?.(new Event("render"), { element: root });
    const filter = root.querySelector<HTMLInputElement>(
      "[data-currency-migration-filter]",
    );
    if (!filter) throw new Error("filter required");
    filter.value = "world";
    filter.dispatchEvent(new documentWindow.Event("input"));

    const rows = root.querySelectorAll<HTMLElement>(
      "[data-currency-migration-search]",
    );
    expect(rows[0]?.hidden).toBe(true);
    expect(rows[1]?.hidden).toBe(false);
    expect(selectedMigration.checked).toBe(true);
    expect(
      root.querySelector("[data-currency-migration-status]")?.textContent,
    ).toBe("D6E2.CurrencyMigration.FilterStatus:1/2/1");

    filter.value = "missing";
    filter.dispatchEvent(new documentWindow.Event("input"));
    expect(
      root.querySelector<HTMLElement>("[data-currency-migration-empty]")
        ?.hidden,
    ).toBe(false);

    const enter = new documentWindow.Event("keydown", {
      cancelable: true,
    });
    Object.defineProperty(enter, "key", { value: "Enter" });
    filter.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
  });

  it("serializes wallet and price edits as mutable Foundry update sources", () => {
    const wallet = createCurrencyWallet(oldDefinition, {
      cent: "50",
      dollar: "1",
    });
    const walletSource = currencyWalletChanges(wallet)[
      "system.profile.currencyWallet"
    ] as { counts: Record<string, string> };
    const valueSource = currencyValueChanges(oldDefinition, "cent", "25")[
      "system.currencyValue"
    ] as { definition: D6CurrencyDefinitionV1 };
    const unresolvedSource = unresolvedCurrencyValueChanges(
      {
        system: {
          currencyValue: exactLegacyCurrencyValue(
            LEGACY_CURRENCY_DEFINITION,
            0.25,
          ),
          value: 0.25,
        },
        type: "gear",
      } as unknown as FoundryItemDocument,
      0.5,
    )["system.currencyValue"] as { definition: D6CurrencyDefinitionV1 };

    expect(Object.isFrozen(walletSource)).toBe(false);
    expect(Object.isFrozen(walletSource.counts)).toBe(false);
    expect(Object.isFrozen(valueSource)).toBe(false);
    expect(Object.isFrozen(valueSource.definition)).toBe(false);
    expect(Object.isFrozen(unresolvedSource)).toBe(false);
    expect(Object.isFrozen(unresolvedSource.definition)).toBe(false);
    expect(() => {
      walletSource.counts = { ...walletSource.counts };
      valueSource.definition = { ...valueSource.definition };
    }).not.toThrow();
  });

  it("applies only explicitly selected exact records", async () => {
    const preview = previewCurrentCurrencyMigrations();
    const actorRow = preview.rows.find(
      (row) => row.documentType === "actor-wallet",
    );
    expect(actorRow).toBeDefined();
    await applyCurrentCurrencyMigrations(
      preview,
      actorRow ? [actorRow.selectionKey] : [],
    );
    expect(actor.update).toHaveBeenCalledOnce();
    expect(item.update).not.toHaveBeenCalled();
  });

  it("does not apply any record when the GM selects none", async () => {
    const preview = previewCurrentCurrencyMigrations();
    await applyCurrentCurrencyMigrations(preview, []);
    expect(actor.update).not.toHaveBeenCalled();
    expect(item.update).not.toHaveBeenCalled();
  });

  it("lets a GM correct stale stored denominations without adopting current rates", async () => {
    const state = actorCurrencyWalletState(actor);
    expect(state.stale).toBe(true);
    const changes = denominationCountChanges(state, "cent", "75", "gm-edit-1");
    await actor.update(changes);

    const reloaded = actorCurrencyWalletState(actor);
    expect(reloaded.stale).toBe(true);
    expect(reloaded.wallet).toMatchObject({
      counts: { cent: "75", dollar: "1" },
      definitionId: oldDefinition.id,
      definitionRevision: oldDefinition.revision,
      status: "active",
    });
    expect(reloaded.wallet.definition.denominations).toHaveLength(2);
  });

  it("keeps stale direct correction unavailable to players", () => {
    Object.assign(game, { user: { isGM: false } });
    expect(() =>
      denominationCountChanges(
        actorCurrencyWalletState(actor),
        "cent",
        "75",
        "player-edit-1",
      ),
    ).toThrow("D6E2.Economy.Error.StaleDefinition");
  });

  it("lets a GM replace an unresolved scalar explicitly on its stored basis", async () => {
    const unresolvedWallet: D6CurrencyWalletV1 = {
      ...createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
      legacyDecimal: "0.25",
      status: "unresolved-legacy",
    };
    Object.assign(
      (actor.system as { profile: Record<string, unknown> }).profile,
      {
        currency: 0.25,
        currencyWallet: unresolvedWallet,
      },
    );
    const state = actorCurrencyWalletState(actor);
    expect(state.unresolvedLegacy).toBe(true);
    const changes = denominationCountChanges(
      state,
      "currency",
      "2",
      "gm-resolve-1",
    );
    await actor.update(changes);

    const reloaded = actorCurrencyWalletState(actor);
    expect(reloaded.unresolvedLegacy).toBe(false);
    expect(reloaded.stale).toBe(true);
    expect(reloaded.wallet).toMatchObject({
      counts: { currency: "2" },
      definitionId: LEGACY_CURRENCY_DEFINITION.id,
      status: "active",
    });
  });

  it("maps direct sheet inputs to the wallet's stored denomination identity", () => {
    const stale = actorCurrencyWalletState(actor);
    expect(
      directCurrencyDenominationId(
        stale,
        "system.profile.currencyWallet.counts.cent",
      ),
    ).toBe("cent");

    Object.assign(
      (actor.system as { profile: Record<string, unknown> }).profile,
      {
        currency: 0,
        currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
      },
    );
    expect(
      directCurrencyDenominationId(
        actorCurrencyWalletState(actor),
        "system.profile.currency",
      ),
    ).toBe("currency");
  });

  it("lets a GM explicitly replace a stale wallet with reviewed current counts", async () => {
    const priorReceipt = {
      intent: "prior-spend",
      status: "complete" as const,
    };
    Object.assign(
      (actor.system as { profile: Record<string, unknown> }).profile,
      {
        currencyWallet: createCurrencyWallet(
          oldDefinition,
          { cent: "50", dollar: "7" },
          ["prior-operation"],
          { "prior-operation": priorReceipt },
        ),
      },
    );
    const changes = currentDefinitionWalletReplacementChanges(
      actorCurrencyWalletState(actor),
      { cent: "0", dollar: "0", mill: "0" },
      "assign-current-1",
    );
    await actor.update(changes);

    const reloaded = actorCurrencyWalletState(actor);
    expect(reloaded.stale).toBe(false);
    expect(reloaded.unresolvedLegacy).toBe(false);
    expect(reloaded.wallet).toMatchObject({
      counts: { cent: "0", dollar: "0", mill: "0" },
      definitionId: defaultCurrentDefinition.id,
      definitionRevision: defaultCurrentDefinition.revision,
      operationReceipts: {
        "assign-current-1": { status: "complete" },
        "prior-operation": priorReceipt,
      },
    });
    expect(reloaded.wallet.recentOperationIds).toEqual(
      expect.arrayContaining(["prior-operation", "assign-current-1"]),
    );
    expect(
      reloaded.wallet.operationReceipts["assign-current-1"]?.intent,
    ).toContain(oldDefinition.id);
  });

  it("rejects player attempts to replace a stale wallet", () => {
    Object.assign(game, { user: { isGM: false } });
    expect(() =>
      currentDefinitionWalletReplacementChanges(
        actorCurrencyWalletState(actor),
        { cent: "0", dollar: "0", mill: "0" },
        "player-assign-1",
      ),
    ).toThrow("D6E2.Economy.Error.NotAuthorized");
  });

  it("detects an unresolved legacy amount change while replacement is open", () => {
    const unresolved = (legacyDecimal: string): D6CurrencyWalletV1 => ({
      ...createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
      legacyDecimal,
      status: "unresolved-legacy",
    });
    expect(currencyWalletEditFingerprint(unresolved("0.25"))).not.toBe(
      currencyWalletEditFingerprint(unresolved("0.50")),
    );
  });

  it("resolves legitimate fractional legacy wallets into exact subunits", () => {
    definitions.current = legacyWithCents;
    const unresolvedWallet: D6CurrencyWalletV1 = {
      ...createCurrencyWallet(LEGACY_CURRENCY_DEFINITION),
      legacyDecimal: "0.25",
      status: "unresolved-legacy",
    };
    const storedActor = {
      system: {
        profile: { currency: 0.25, currencyWallet: unresolvedWallet },
      },
      type: "character",
    } as unknown as FoundryActorDocument;
    const state = actorCurrencyWalletState(storedActor);
    expect(state.invalidStoredWallet).toBe(false);
    expect(previewWalletMigration(storedActor)).toMatchObject({
      exact: true,
      target: { counts: { cent: "25", currency: "0" } },
    });

    const unmigratedActor = {
      system: { profile: { currency: 0.25 } },
      type: "character",
    } as unknown as FoundryActorDocument;
    expect(previewWalletMigration(unmigratedActor)).toMatchObject({
      exact: true,
      target: { counts: { cent: "25", currency: "0" } },
    });
  });

  it("refuses unresolved price migration into a foreign value identity", () => {
    definitions.current = { ...legacyWithCents, id: "foreign-currency" };
    const unresolvedItem = {
      system: {
        currencyValue: exactLegacyCurrencyValue(
          LEGACY_CURRENCY_DEFINITION,
          0.25,
        ),
        value: 0.25,
      },
      type: "gear",
    } as unknown as FoundryItemDocument;
    expect(previewCurrencyValueMigration(unresolvedItem)).toMatchObject({
      exact: false,
      reason: "different-value-system",
    });
  });

  it("uses the latest authored unresolved price while retaining provenance", () => {
    definitions.current = legacyWithCents;
    const unresolvedItem = {
      system: {
        currencyValue: exactLegacyCurrencyValue(
          LEGACY_CURRENCY_DEFINITION,
          0.25,
        ),
        value: 0.5,
      },
      type: "gear",
    } as unknown as FoundryItemDocument;
    expect(previewCurrencyValueMigration(unresolvedItem)).toMatchObject({
      exact: true,
      target: { amountSmallestUnit: "50" },
    });
    expect(unresolvedCurrencyValueChanges(unresolvedItem, 0.75)).toMatchObject({
      "system.currencyValue": {
        authoredDecimal: "0.75",
        legacyDecimal: "0.25",
      },
      "system.value": 0.75,
    });
  });
});
