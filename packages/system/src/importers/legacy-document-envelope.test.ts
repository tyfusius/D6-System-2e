import { describe, expect, it } from "vitest";
import type {
  LegacyWorldExportRecord,
  LegacyWorldSource,
} from "./legacy-world-import";
import {
  canonicalLegacyDocumentEnvelopes,
  LEGACY_DOCUMENT_ENVELOPE_FORMAT,
  serializeCanonicalLegacyDocumentEnvelopes,
} from "./legacy-document-envelope";

const SOURCE: LegacyWorldSource = {
  coreVersion: "12.343",
  system: "od6s",
  systemVersion: "1.0.7",
  worldId: "sanitized-rehearsal",
};

const ACTOR_ID = "ActorFixture0001";
const EFFECT_ID = "EffectFixture001";
const ITEM_EFFECT_ID = "ItemEffectFix001";
const TOMBSTONE_ID = "TombstoneFix001";
const ITEM_ID = "ItemFixture00001";
const SCENE_ID = "SceneFixture0001";
const TOKEN_ID = "TokenFixture0001";
const DELTA_ID = "DeltaFixture0001";
const ROOT_FOLDER_ID = "FolderRoot000001";
const CHILD_FOLDER_ID = "FolderChild00001";
const WORLD_ITEM_ID = "WorldItem0000001";

function records(): readonly LegacyWorldExportRecord[] {
  return [
    {
      collection: "actors",
      key: `!actors.items!${ACTOR_ID}.${ITEM_ID}`,
      value: {
        zUnknown: { retained: true },
        type: "weapon",
        system: {
          sourceActorId: ACTOR_ID,
          script:
            "game.od6s._private(Actor.TargetFixture01); data.damage.value",
        },
        name: "Sanitized Item",
        img: "systems/od6s/assets/item.webp",
        flags: { legacy: { custom: 7 } },
        _id: ITEM_ID,
      },
    },
    {
      collection: "actors",
      key: `!actors!${ACTOR_ID}`,
      value: {
        type: "character",
        ownership: { default: 0, userFixture0001: 3 },
        name: "Sanitized Actor",
        flags: { legacy: { unknown: "kept" } },
        effects: [EFFECT_ID],
        prototypeToken: {
          actorLink: false,
          flags: { legacy: { retained: true } },
          texture: { src: "systems/od6s/assets/prototype.webp" },
          zUnknown: true,
        },
        _id: ACTOR_ID,
      },
    },
    {
      collection: "actors",
      key: "!actors!MismatchKey0001",
      value: { _id: "MismatchValue001", type: "npc" },
    },
    {
      collection: "actors",
      key: `!actors.effects!${ACTOR_ID}.${EFFECT_ID}`,
      value: {
        _id: EFFECT_ID,
        changes: [{ key: "data.attributes.dexterity", mode: 2, value: 1 }],
        disabled: false,
        flags: { legacy: { retained: true } },
        origin: `Actor.${ACTOR_ID}.Item.${ITEM_ID}`,
        statuses: ["stunned"],
        transfer: false,
        type: "base",
      },
    },
  ];
}

function sceneRecords(): readonly LegacyWorldExportRecord[] {
  return [
    {
      collection: "scenes",
      key: `!scenes!${SCENE_ID}`,
      value: {
        _id: SCENE_ID,
        background: { src: "worlds/fixture/maps/cantina.webp" },
        flags: { legacy: { retained: true } },
        height: 2400,
        name: "Sanitized Scene",
        ownership: { default: 0 },
        tokens: [TOKEN_ID],
        width: 3200,
        zUnknown: { retained: true },
      },
    },
    {
      collection: "scenes",
      key: `!scenes.tokens!${SCENE_ID}.${TOKEN_ID}`,
      value: {
        _id: TOKEN_ID,
        actorId: ACTOR_ID,
        actorLink: false,
        delta: DELTA_ID,
        elevation: 2,
        flags: { legacy: { retained: true } },
        height: 1,
        texture: { src: "systems/od6s/assets/token.webp" },
        width: 1,
        x: 120,
        y: 240,
        zUnknown: { retained: true },
      },
    },
    {
      collection: "scenes",
      key: `!scenes.tokens.delta!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}`,
      value: {
        _id: DELTA_ID,
        effects: [EFFECT_ID],
        flags: { legacy: { retained: true } },
        items: [ITEM_ID],
        name: "Synthetic Actor Delta",
      },
    },
    {
      collection: "scenes",
      key: `!scenes.tokens.delta.items!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}.${ITEM_ID}`,
      value: {
        _id: ITEM_ID,
        effects: [ITEM_EFFECT_ID],
        flags: { legacy: { retained: true } },
        img: "systems/od6s/assets/delta-item.webp",
        ownership: { default: 0 },
        type: "weapon",
        zUnknown: true,
      },
    },
    {
      collection: "scenes",
      key: `!scenes.tokens.delta.effects!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}.${EFFECT_ID}`,
      value: {
        _id: EFFECT_ID,
        changes: [{ key: "data.attributes.dexterity" }],
        origin: `Scene.${SCENE_ID}.Token.${TOKEN_ID}.ActorDelta.${DELTA_ID}.Item.${ITEM_ID}`,
        statuses: ["stunned"],
      },
    },
    {
      collection: "scenes",
      key: `!scenes.tokens.delta.items.effects!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}.${ITEM_ID}.${ITEM_EFFECT_ID}`,
      value: {
        _id: ITEM_EFFECT_ID,
        origin: "Compendium.fixture.items.ExternalItem001",
        system: { changes: [{ key: "system.damage.mod" }] },
        transfer: true,
      },
    },
  ];
}

function topologyRecords(): readonly LegacyWorldExportRecord[] {
  return [
    {
      collection: "folders",
      key: `!folders!${ROOT_FOLDER_ID}`,
      value: {
        _id: ROOT_FOLDER_ID,
        flags: { legacy: { retained: true } },
        folder: null,
        sort: 100000,
        sorting: "a",
        type: "Item",
      },
    },
    {
      collection: "folders",
      key: `!folders!${CHILD_FOLDER_ID}`,
      value: {
        _id: CHILD_FOLDER_ID,
        flags: {},
        folder: ROOT_FOLDER_ID,
        sort: 200000,
        sorting: "m",
        type: "Item",
      },
    },
    {
      collection: "items",
      key: `!items!${WORLD_ITEM_ID}`,
      value: {
        _id: WORLD_ITEM_ID,
        flags: { legacy: { retained: true } },
        folder: CHILD_FOLDER_ID,
        ownership: { default: 0 },
        sort: 0,
        system: {
          sourceFolderUuid: `Folder.${ROOT_FOLDER_ID}`,
          unknown: "retained",
        },
        type: "equipment",
      },
    },
  ];
}

describe("canonical legacy Actor and embedded Item envelopes", () => {
  it("identifies structured world documents, children, and quarantined Macro APIs", () => {
    const result = canonicalLegacyDocumentEnvelopes(SOURCE, [
      {
        collection: "journal",
        key: "!journal!JournalFixture01",
        value: {
          _id: "JournalFixture01",
          pages: ["JournalPage00001"],
        },
      },
      {
        collection: "journal",
        key: "!journal.pages!JournalFixture01.JournalPage00001",
        value: { _id: "JournalPage00001", text: { content: "Fixture" } },
      },
      {
        collection: "macros",
        key: "!macros!MacroFixture0001",
        value: {
          _id: "MacroFixture0001",
          command: "game.od6s._private(); data.attributes.dexterity",
        },
      },
    ]);
    expect(
      result.documents.find(({ kind }) => kind === "JournalEntry")?.source.uuid,
    ).toBe("JournalEntry.JournalFixture01");
    expect(
      result.documents.find(({ kind }) => kind === "JournalEntryPage")?.source,
    ).toMatchObject({
      parentUuid: "JournalEntry.JournalFixture01",
      uuid: "JournalEntry.JournalFixture01.JournalEntryPage.JournalPage00001",
    });
    expect(
      result.documents.find(({ kind }) => kind === "Macro")?.source.uuid,
    ).toBe("Macro.MacroFixture0001");
    expect(result.documents.flatMap(({ findings }) => findings)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "legacy-data-path" }),
        expect.objectContaining({ kind: "private-api" }),
      ]),
    );
  });

  it("preserves payload, IDs, UUID aliases, ownership, flags, and unknown keys", () => {
    const result = canonicalLegacyDocumentEnvelopes(SOURCE, records());
    expect(result.skipped).toBe(0);
    expect(result.documents).toHaveLength(4);

    const actor = result.documents.find(({ kind }) => kind === "Actor");
    expect(actor).toMatchObject({
      format: LEGACY_DOCUMENT_ENVELOPE_FORMAT,
      identity: {
        aliases: [`Actor.${ACTOR_ID}`],
        documentId: ACTOR_ID,
        preserveId: true,
        proposedTargetUuid: `Actor.${ACTOR_ID}`,
        sourceId: ACTOR_ID,
      },
      preservation: {
        flags: "retained",
        ownership: "retained",
        payload: "exact",
        unknownFields: "retained",
      },
      source: {
        recordKey: `!actors!${ACTOR_ID}`,
        uuid: `Actor.${ACTOR_ID}`,
      },
      status: "exact",
    });
    expect(actor?.payload).toEqual({
      _id: ACTOR_ID,
      effects: [EFFECT_ID],
      flags: { legacy: { unknown: "kept" } },
      name: "Sanitized Actor",
      ownership: { default: 0, userFixture0001: 3 },
      prototypeToken: {
        actorLink: false,
        flags: { legacy: { retained: true } },
        texture: { src: "systems/od6s/assets/prototype.webp" },
        zUnknown: true,
      },
      type: "character",
    });

    const item = result.documents.find(({ kind }) => kind === "Item");
    expect(item).toMatchObject({
      identity: { preserveId: true, sourceId: ITEM_ID },
      source: {
        parentUuid: `Actor.${ACTOR_ID}`,
        uuid: `Actor.${ACTOR_ID}.Item.${ITEM_ID}`,
      },
      status: "exact",
    });
    expect((item?.payload as Record<string, unknown>).zUnknown).toEqual({
      retained: true,
    });

    const effect = result.documents.find(({ kind }) => kind === "ActiveEffect");
    expect(effect).toMatchObject({
      activeEffect: {
        changePaths: ["data.attributes.dexterity"],
        changeSources: ["changes"],
        disabled: false,
        index: 0,
        invalidChangePaths: 0,
        issues: [],
        origin: `Actor.${ACTOR_ID}.Item.${ITEM_ID}`,
        originStatus: "exact",
        statuses: ["stunned"],
        status: "exact",
        transfer: false,
      },
      identity: {
        preserveId: true,
        proposedTargetUuid: `Actor.${ACTOR_ID}.ActiveEffect.${EFFECT_ID}`,
      },
      kind: "ActiveEffect",
      source: {
        parentUuid: `Actor.${ACTOR_ID}`,
        uuid: `Actor.${ACTOR_ID}.ActiveEffect.${EFFECT_ID}`,
      },
    });
    expect(result.activeEffects).toMatchObject({
      documents: 1,
      exact: 1,
      unresolved: 0,
    });
  });

  it("reports references and risky legacy paths without converting them", () => {
    const result = canonicalLegacyDocumentEnvelopes(SOURCE, records());
    const findings = result.documents.flatMap(({ findings }) => findings);
    expect(findings.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        "asset-url",
        "document-id",
        "foundry-uuid",
        "legacy-data-path",
        "private-api",
      ]),
    );
    expect(findings).toContainEqual({
      kind: "legacy-data-path",
      path: "changes[0].key",
      value: "data.attributes.dexterity",
    });
    expect(findings).toContainEqual({
      kind: "foundry-uuid",
      path: "system.script",
      value: "Actor.TargetFixture01",
    });
  });

  it("quarantines mismatched identities and records an explicit alias", () => {
    const mismatch = canonicalLegacyDocumentEnvelopes(
      SOURCE,
      records(),
    ).documents.find(({ source }) => source.uuid === "Actor.MismatchKey0001");
    expect(mismatch).toMatchObject({
      identity: {
        aliases: ["Actor.MismatchKey0001", "Actor.MismatchValue001"],
        documentId: "MismatchValue001",
        preserveId: false,
        sourceId: "MismatchKey0001",
      },
      status: "unresolved",
    });
  });

  it("serializes the same source to byte-identical sorted NDJSON", () => {
    const first = canonicalLegacyDocumentEnvelopes(SOURCE, records()).documents;
    const second = canonicalLegacyDocumentEnvelopes(
      SOURCE,
      records(),
    ).documents;
    expect(serializeCanonicalLegacyDocumentEnvelopes(first)).toBe(
      serializeCanonicalLegacyDocumentEnvelopes(second),
    );
    expect(first.map(({ source }) => source.uuid)).toEqual(
      [...first.map(({ source }) => source.uuid)].sort(),
    );
  });

  it("keeps both source adapters payload- and finding-compatible", () => {
    const sourceRecords = [
      ...records(),
      ...topologyRecords(),
      ...sceneRecords(),
    ];
    const original = canonicalLegacyDocumentEnvelopes(SOURCE, sourceRecords);
    const rehearsal = canonicalLegacyDocumentEnvelopes(
      {
        ...SOURCE,
        coreVersion: "14.365",
        system: "od6s-next",
        systemVersion: "2.0.0-alpha.2",
      },
      sourceRecords,
    );
    const comparable = (result: typeof original) =>
      result.documents.map(
        ({
          findings,
          activeEffect,
          actorDelta,
          identity,
          kind,
          payload,
          preservation,
          placedToken,
          prototypeToken,
          status,
          type,
        }) => ({
          findings,
          activeEffect,
          actorDelta,
          identity,
          kind,
          payload,
          preservation,
          placedToken,
          prototypeToken,
          status,
          type,
        }),
      );
    expect(comparable(rehearsal)).toEqual(comparable(original));
  });

  it("reconciles od6s root changes and od6s-next system changes", () => {
    const original = canonicalLegacyDocumentEnvelopes(
      SOURCE,
      records(),
    ).documents.find(({ kind }) => kind === "ActiveEffect")?.activeEffect;
    const rehearsalRecords = records().map((entry) => {
      if (entry.key !== `!actors.effects!${ACTOR_ID}.${EFFECT_ID}`) {
        return entry;
      }
      const { changes, system, ...payload } = entry.value as Record<
        string,
        unknown
      >;
      return {
        ...entry,
        value: {
          ...payload,
          system: {
            ...(system as Record<string, unknown> | undefined),
            changes,
          },
        },
      };
    });
    const rehearsal = canonicalLegacyDocumentEnvelopes(
      { ...SOURCE, system: "od6s-next", systemVersion: "2.0.0-alpha.2" },
      rehearsalRecords,
    ).documents.find(({ kind }) => kind === "ActiveEffect")?.activeEffect;
    expect(original).toMatchObject({
      changePaths: ["data.attributes.dexterity"],
      changeSources: ["changes"],
      invalidChangePaths: 0,
      status: "exact",
    });
    expect(rehearsal).toMatchObject({
      changePaths: original?.changePaths,
      changeSources: ["system.changes"],
      invalidChangePaths: original?.invalidChangePaths,
      status: original?.status,
    });
  });

  it("preserves standalone Items and exact Folder topology", () => {
    const result = canonicalLegacyDocumentEnvelopes(SOURCE, topologyRecords());
    expect(result.folderTopology).toEqual({
      cycles: 0,
      exact: 2,
      missingParents: 0,
      parentLinks: 1,
      parentTypeMismatches: 0,
      roots: 1,
      selfParents: 0,
      unresolved: 0,
    });
    expect(
      result.documents.find(
        ({ source }) => source.uuid === `Item.${WORLD_ITEM_ID}`,
      )?.findings,
    ).toContainEqual({
      kind: "foundry-uuid",
      path: "system.sourceFolderUuid",
      value: `Folder.${ROOT_FOLDER_ID}`,
    });
    expect(result.folderReferences).toEqual({
      exact: 1,
      missing: 0,
      parentTypeMismatches: 0,
      unresolved: 0,
    });
    const child = result.documents.find(
      ({ source }) => source.uuid === `Folder.${CHILD_FOLDER_ID}`,
    );
    expect(child).toMatchObject({
      identity: {
        preserveId: true,
        proposedTargetUuid: `Folder.${CHILD_FOLDER_ID}`,
      },
      kind: "Folder",
      topology: {
        documentType: "Item",
        issues: [],
        parentId: ROOT_FOLDER_ID,
        parentUuid: `Folder.${ROOT_FOLDER_ID}`,
        sort: 200000,
        sorting: "m",
        status: "exact",
      },
    });
    const item = result.documents.find(
      ({ source }) => source.uuid === `Item.${WORLD_ITEM_ID}`,
    );
    expect(item).toMatchObject({
      folderReference: {
        folderId: CHILD_FOLDER_ID,
        folderUuid: `Folder.${CHILD_FOLDER_ID}`,
        status: "exact",
      },
      kind: "Item",
      preservation: {
        flags: "retained",
        ownership: "retained",
        unknownFields: "retained",
      },
      source: { collection: "items", recordKey: `!items!${WORLD_ITEM_ID}` },
    });
  });

  it("preserves Scene and placed Token payloads with exact relationship evidence", () => {
    const result = canonicalLegacyDocumentEnvelopes(SOURCE, [
      ...records(),
      ...sceneRecords(),
    ]);
    const scene = result.documents.find(({ kind }) => kind === "Scene");
    expect(scene).toMatchObject({
      identity: {
        preserveId: true,
        proposedTargetUuid: `Scene.${SCENE_ID}`,
      },
      preservation: {
        flags: "retained",
        ownership: "retained",
        payload: "exact",
        unknownFields: "retained",
      },
      source: {
        collection: "scenes",
        uuid: `Scene.${SCENE_ID}`,
      },
      status: "exact",
    });
    const token = result.documents.find(({ kind }) => kind === "Token");
    expect(token).toMatchObject({
      identity: {
        preserveId: true,
        proposedTargetUuid: `Scene.${SCENE_ID}.Token.${TOKEN_ID}`,
      },
      placedToken: {
        actorId: ACTOR_ID,
        actorLink: false,
        actorStatus: "exact",
        deltaId: DELTA_ID,
        deltaStatus: "exact",
        geometry: { elevation: 2, height: 1, width: 1, x: 120, y: 240 },
        index: 0,
        issues: [],
        status: "exact",
        textureSrc: "systems/od6s/assets/token.webp",
      },
      source: {
        collection: "scenes",
        parentUuid: `Scene.${SCENE_ID}`,
        uuid: `Scene.${SCENE_ID}.Token.${TOKEN_ID}`,
      },
      status: "exact",
    });
    expect(result.placedTokens).toEqual({
      absentActorReferences: 0,
      absentDeltaReferences: 0,
      danglingIndexes: 0,
      deltaEffectRecords: 1,
      deltaItemEffectRecords: 1,
      deltaItemRecords: 1,
      deltaRootRecords: 1,
      documents: 1,
      duplicateIndexes: 0,
      exact: 1,
      exactActorReferences: 1,
      exactDeltaReferences: 1,
      exactIndexes: 1,
      invalidDeltaReferences: 0,
      invalidIndexEntries: 0,
      missingActorReferences: 0,
      missingDeltaReferences: 0,
      missingIndexes: 0,
      missingParents: 0,
      unreferencedDeltaRoots: 0,
      unresolved: 0,
    });
    const deltaRootUuid = `Scene.${SCENE_ID}.Token.${TOKEN_ID}.ActorDelta.${DELTA_ID}`;
    const deltaRoot = result.documents.find(
      ({ kind }) => kind === "ActorDelta",
    );
    expect(deltaRoot).toMatchObject({
      actorDelta: {
        actorId: ACTOR_ID,
        actorStatus: "exact",
        deltaId: DELTA_ID,
        deltaReferenceStatus: "exact",
        indexStatus: "not-applicable",
        issues: [],
        role: "root",
        rootUuid: deltaRootUuid,
        status: "exact",
        tokenStatus: "exact",
        tokenUuid: `Scene.${SCENE_ID}.Token.${TOKEN_ID}`,
        tombstone: false,
      },
      identity: {
        preserveId: true,
        sourceId: DELTA_ID,
      },
      source: {
        parentUuid: `Scene.${SCENE_ID}.Token.${TOKEN_ID}`,
        uuid: deltaRootUuid,
      },
      status: "exact",
    });
    expect(deltaRoot?.identity).not.toHaveProperty("proposedTargetUuid");
    expect(
      result.documents.find(({ kind }) => kind === "ActorDeltaItem"),
    ).toMatchObject({
      actorDelta: { index: 0, indexStatus: "exact", role: "item" },
      identity: { preserveId: true },
      preservation: { ownership: "retained", unknownFields: "retained" },
      source: {
        parentUuid: deltaRootUuid,
        uuid: `${deltaRootUuid}.Item.${ITEM_ID}`,
      },
    });
    expect(result.actorDeltas).toEqual({
      absentActorReferences: 0,
      changePaths: 2,
      danglingEffectIndexes: 0,
      danglingItemEffectIndexes: 0,
      danglingItemIndexes: 0,
      detachedTombstones: 0,
      documents: 4,
      duplicateEffectIndexes: 0,
      duplicateItemEffectIndexes: 0,
      duplicateItemIndexes: 0,
      effects: 1,
      exactActorReferences: 1,
      exactDeltaReferences: 1,
      exactEffectIndexes: 1,
      exactEvidence: 4,
      exactItemEffectIndexes: 1,
      exactItemIndexes: 1,
      exactTokenReferences: 1,
      invalidChangePaths: 0,
      invalidEffectIndexEntries: 0,
      invalidItemEffectIndexEntries: 0,
      invalidItemIndexEntries: 0,
      itemEffects: 1,
      items: 1,
      missingActorReferences: 0,
      missingDeltaReferences: 0,
      missingEffectIndexes: 0,
      missingItemEffectIndexes: 0,
      missingItemIndexes: 0,
      missingParents: 0,
      missingTokenReferences: 0,
      originAbsent: 0,
      originExact: 1,
      originExternal: 1,
      originUnresolved: 0,
      roots: 1,
      tombstones: 0,
      unresolvedEvidence: 0,
    });
    expect(
      result.documents.find(({ kind }) => kind === "ActorDeltaEffect")
        ?.findings,
    ).toContainEqual({
      kind: "foundry-uuid",
      path: "origin",
      value: `${deltaRootUuid}.Item.${ITEM_ID}`,
    });
    expect(result.prototypeTokens).toEqual({
      documents: 2,
      exact: 1,
      linked: 0,
      missing: 1,
      unlinked: 1,
      unresolved: 1,
    });
    expect(scene?.findings).toContainEqual({
      kind: "asset-url",
      path: "background.src",
      value: "worlds/fixture/maps/cantina.webp",
    });
  });

  it("quarantines malformed Token indexes, Actor links, and delta references", () => {
    const orphanSceneId = "MissingScene0001";
    const orphanTokenId = "OrphanToken0001";
    const result = canonicalLegacyDocumentEnvelopes(SOURCE, [
      {
        collection: "actors",
        key: `!actors!${ACTOR_ID}`,
        value: { _id: ACTOR_ID, prototypeToken: null, type: "character" },
      },
      {
        collection: "scenes",
        key: `!scenes!${SCENE_ID}`,
        value: {
          _id: SCENE_ID,
          tokens: [TOKEN_ID, TOKEN_ID, 7, "DanglingToken01"],
        },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens!${SCENE_ID}.${TOKEN_ID}`,
        value: {
          _id: TOKEN_ID,
          actorId: "MissingActor001",
          delta: "MissingDelta001",
        },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens!${orphanSceneId}.${orphanTokenId}`,
        value: { _id: orphanTokenId, delta: { invalid: true } },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens.delta!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}`,
        value: {
          _id: DELTA_ID,
          effects: [EFFECT_ID, EFFECT_ID, 8, "DanglingEffect01"],
          items: [ITEM_ID, ITEM_ID, 7, "DanglingItem0001"],
        },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens.delta.items!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}.${ITEM_ID}`,
        value: {
          _id: ITEM_ID,
          effects: [ITEM_EFFECT_ID, ITEM_EFFECT_ID, 9, "DanglingEffect02"],
        },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens.delta.items!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}.${TOMBSTONE_ID}`,
        value: { _id: TOMBSTONE_ID, _tombstone: true },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens.delta.effects!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}.${EFFECT_ID}`,
        value: {
          _id: EFFECT_ID,
          changes: [{ key: "" }, {}],
          origin: "Actor.MissingActor001.Item.MissingItem00001",
        },
      },
      {
        collection: "scenes",
        key: `!scenes.tokens.delta.items.effects!${SCENE_ID}.${TOKEN_ID}.${DELTA_ID}.${ITEM_ID}.${ITEM_EFFECT_ID}`,
        value: { _id: ITEM_EFFECT_ID },
      },
    ]);
    expect(result.placedTokens).toEqual({
      absentActorReferences: 1,
      absentDeltaReferences: 0,
      danglingIndexes: 1,
      deltaEffectRecords: 1,
      deltaItemEffectRecords: 1,
      deltaItemRecords: 2,
      deltaRootRecords: 1,
      documents: 2,
      duplicateIndexes: 1,
      exact: 0,
      exactActorReferences: 0,
      exactDeltaReferences: 0,
      exactIndexes: 0,
      invalidDeltaReferences: 1,
      invalidIndexEntries: 1,
      missingActorReferences: 1,
      missingDeltaReferences: 1,
      missingIndexes: 1,
      missingParents: 1,
      unreferencedDeltaRoots: 1,
      unresolved: 2,
    });
    expect(result.prototypeTokens).toEqual({
      documents: 1,
      exact: 0,
      linked: 0,
      missing: 0,
      unlinked: 0,
      unresolved: 1,
    });
    expect(result.actorDeltas).toMatchObject({
      changePaths: 0,
      danglingEffectIndexes: 1,
      danglingItemEffectIndexes: 1,
      danglingItemIndexes: 1,
      detachedTombstones: 1,
      documents: 5,
      duplicateEffectIndexes: 1,
      duplicateItemEffectIndexes: 1,
      duplicateItemIndexes: 1,
      exactActorReferences: 0,
      exactDeltaReferences: 0,
      exactEffectIndexes: 0,
      exactEvidence: 0,
      exactItemEffectIndexes: 0,
      exactItemIndexes: 0,
      invalidChangePaths: 2,
      invalidEffectIndexEntries: 1,
      invalidItemEffectIndexEntries: 1,
      invalidItemIndexEntries: 1,
      missingActorReferences: 1,
      missingDeltaReferences: 1,
      missingParents: 0,
      originUnresolved: 1,
      tombstones: 1,
      unresolvedEvidence: 5,
    });
    expect(
      result.documents.find(({ source }) =>
        source.uuid.endsWith(`Token.${TOKEN_ID}`),
      )?.placedToken,
    ).toMatchObject({
      index: 0,
      issues: ["duplicate-index", "missing-actor", "missing-delta"],
      status: "unresolved",
    });
    expect(result.skipped).toBe(0);
  });

  it("reports missing, mismatched, self, and cyclic Folder references", () => {
    const missing = "MissingFolder001";
    const actorFolder = "ActorFolder00001";
    const cycleA = "CycleFolderA0001";
    const cycleB = "CycleFolderB0001";
    const result = canonicalLegacyDocumentEnvelopes(SOURCE, [
      {
        collection: "folders",
        key: `!folders!${actorFolder}`,
        value: {
          _id: actorFolder,
          folder: missing,
          type: "Actor",
        },
      },
      {
        collection: "folders",
        key: `!folders!${cycleA}`,
        value: { _id: cycleA, folder: cycleB, type: "Item" },
      },
      {
        collection: "folders",
        key: `!folders!${cycleB}`,
        value: { _id: cycleB, folder: cycleA, type: "Item" },
      },
      {
        collection: "folders",
        key: `!folders!${ROOT_FOLDER_ID}`,
        value: {
          _id: ROOT_FOLDER_ID,
          folder: ROOT_FOLDER_ID,
          type: "Item",
        },
      },
      {
        collection: "items",
        key: `!items!${WORLD_ITEM_ID}`,
        value: { _id: WORLD_ITEM_ID, folder: actorFolder, type: "equipment" },
      },
    ]);
    expect(result.folderTopology).toMatchObject({
      cycles: 3,
      missingParents: 1,
      parentTypeMismatches: 0,
      selfParents: 1,
      unresolved: 4,
    });
    expect(result.folderReferences).toEqual({
      exact: 0,
      missing: 0,
      parentTypeMismatches: 1,
      unresolved: 1,
    });
  });

  it("quarantines malformed Active Effect indexes, origins, and change paths", () => {
    const orphanActorId = "MissingActor0001";
    const orphanEffectId = "OrphanEffect0001";
    const result = canonicalLegacyDocumentEnvelopes(SOURCE, [
      {
        collection: "actors",
        key: `!actors!${ACTOR_ID}`,
        value: {
          _id: ACTOR_ID,
          effects: [EFFECT_ID, EFFECT_ID, 7, "DanglingEffect01"],
          type: "character",
        },
      },
      {
        collection: "actors",
        key: `!actors.effects!${ACTOR_ID}.${EFFECT_ID}`,
        value: {
          _id: EFFECT_ID,
          changes: [{ key: "" }, {}],
          origin: "Actor.MissingActor0001.Item.MissingItem00001",
        },
      },
      {
        collection: "actors",
        key: `!actors.effects!${orphanActorId}.${orphanEffectId}`,
        value: { _id: orphanEffectId },
      },
    ]);
    expect(result.activeEffects).toEqual({
      changePaths: 0,
      danglingIndexes: 1,
      documents: 2,
      duplicateIndexes: 1,
      exact: 0,
      invalidChangePaths: 2,
      invalidIndexEntries: 1,
      missingIndexes: 1,
      missingParents: 1,
      originAbsent: 1,
      originExact: 0,
      originExternal: 0,
      originUnresolved: 1,
      unresolved: 2,
    });
    expect(
      result.documents.find(({ source }) =>
        source.uuid.endsWith(`ActiveEffect.${EFFECT_ID}`),
      )?.activeEffect,
    ).toMatchObject({
      index: 0,
      invalidChangePaths: 2,
      issues: ["duplicate-index", "invalid-change-path", "missing-origin"],
      originStatus: "unresolved",
      status: "unresolved",
    });
  });
});
