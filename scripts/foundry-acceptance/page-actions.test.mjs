import { describe, expect, it, vi } from "vitest";
import {
  buildCaptureChatBoundaryAction,
  buildCleanupAction,
  buildCreateNeutralFixtureAction,
  buildIdentifyRollChatAction,
  buildMarkChatAsGmAction,
  buildObserveRollChatAction,
  buildReadNeutralFixtureAction,
  buildRuntimeProbeAction,
  buildSettingsRestoreAction,
  buildSettingsSnapshotAction,
  buildVerifyChatAction,
  PAGE_ACTION_PROTOCOL,
  parsePageActionResult,
} from "./page-actions.mjs";

const LEASE = {
  leaseNonce: "lease",
  runId: "run",
  systemId: "d6-system-2e",
  worldId: "d6e2-acceptance-run",
};

function executePublicEvalSource(source, globals = {}) {
  const names = Object.keys(globals);
  return Function(
    ...names,
    `return (async () => { ${source} })();`,
  )(...Object.values(globals));
}

function fixtureGlobals({ embeddedFailure, directFailure } = {}) {
  const marker = { leaseNonce: LEASE.leaseNonce, runId: LEASE.runId };
  const collections = {
    actors: { contents: [] },
    items: { contents: [] },
    messages: { contents: [] },
    scenes: { active: undefined, contents: [] },
    users: { contents: [] },
  };
  const markedDocument = ({ documentName, id, parent, source = {}, type }) => ({
    documentName,
    getFlag: () => marker,
    id,
    name: source.name,
    parent,
    type,
  });
  const failedResult = (stage, valid) => {
    if (directFailure?.stage === stage) return directFailure.value;
    if (embeddedFailure?.stage !== stage) return [valid];
    if (embeddedFailure.kind === "empty") return [];
    if (embeddedFailure.kind === "undefined") return undefined;
    if (embeddedFailure.kind === "wrong-cardinality") return [valid, valid];
    if (embeddedFailure.kind === "wrong-type") {
      return [{ ...valid, type: "gear" }];
    }
    throw new Error(`Unknown embedded failure ${embeddedFailure.kind}`);
  };
  const player = {
    ...markedDocument({ documentName: "User", id: "player-id" }),
    isGM: false,
    role: 1,
  };
  const actor = {
    ...markedDocument({
      documentName: "Actor",
      id: "actor-id",
      source: { name: "Synthetic Acceptance Character" },
      type: "character",
    }),
    canUserModify: () => true,
    items: { contents: [] },
    ownership: { "player-id": 3, default: 0 },
    system: { creation: { active: true }, sheetMode: { value: "normal" } },
  };
  let actorEmbeddedCall = 0;
  actor.update = vi.fn(async (changes) => {
    if (changes["system.creation.active"] === false) {
      actor.system.creation.active = false;
    }
    if (typeof changes["system.sheetMode.value"] === "string") {
      actor.system.sheetMode.value = changes["system.sheetMode.value"];
    }
    const stage =
      changes["system.sheetMode.value"] === "freeedit"
        ? "actor-authoring-open"
        : "actor-authoring-close";
    return directFailure?.stage === stage ? directFailure.value : actor;
  });
  actor.createEmbeddedDocuments = vi.fn(async (_name, [source]) => {
    actorEmbeddedCall += 1;
    const stage = actorEmbeddedCall === 1 ? "skill-create" : "weapon-create";
    const created = markedDocument({
      documentName: "Item",
      id: actorEmbeddedCall === 1 ? "skill-id" : "weapon-id",
      parent: actor,
      source,
      type: source.type,
    });
    const result = failedResult(stage, created);
    if (Array.isArray(result) && result.length === 1) {
      actor.items.contents.push(result[0]);
    }
    return result;
  });
  const scene = {
    ...markedDocument({
      documentName: "Scene",
      id: "scene-id",
      source: { name: "Synthetic Acceptance Scene" },
    }),
    tokens: { contents: [] },
  };
  scene.createEmbeddedDocuments = vi.fn(async (_name, [source]) => {
    const created = markedDocument({
      documentName: "Token",
      id: "token-id",
      parent: scene,
      source,
    });
    const result = failedResult("token-create", created);
    if (Array.isArray(result) && result.length === 1) {
      scene.tokens.contents.push(result[0]);
    }
    return result;
  });
  scene.activate = vi.fn(async () => {
    collections.scenes.active = scene;
    return directFailure?.stage === "scene-activate"
      ? directFailure.value
      : scene;
  });
  const worldItem = markedDocument({
    documentName: "Item",
    id: "world-item-id",
    type: "gear",
  });
  const game = {
    ...collections,
    ready: true,
    system: { id: LEASE.systemId },
    user: { id: "gm-id", isGM: true },
    world: { getFlag: () => marker, id: LEASE.worldId },
  };
  game.users.find = (predicate) => game.users.contents.find(predicate);
  const globals = {
    Actor: {
      create: vi.fn(async () => {
        const result =
          directFailure?.stage === "actor-create" ? directFailure.value : actor;
        if (result === actor) collections.actors.contents.push(actor);
        return result;
      }),
    },
    CONST: {
      DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OBSERVER: 2, OWNER: 3 },
      TOKEN_DISPOSITIONS: { FRIENDLY: 1 },
      USER_ROLES: { PLAYER: 1 },
    },
    Item: {
      create: vi.fn(async () => {
        const result =
          directFailure?.stage === "world-item-create"
            ? directFailure.value
            : worldItem;
        if (result === worldItem) collections.items.contents.push(worldItem);
        return result;
      }),
    },
    Scene: {
      create: vi.fn(async () => {
        const result =
          directFailure?.stage === "scene-create" ? directFailure.value : scene;
        if (result === scene) collections.scenes.contents.push(scene);
        return result;
      }),
    },
    User: {
      create: vi.fn(async () => {
        const result =
          directFailure?.stage === "player-create"
            ? directFailure.value
            : player;
        if (result === player) collections.users.contents.push(player);
        return result;
      }),
    },
    game,
  };
  return { actor, globals, scene };
}

describe("Foundry page actions", () => {
  it("probes the exact disposable world, system and role", () => {
    const source = buildRuntimeProbeAction({
      expectedRole: "player",
      expectedUserId: "player-id",
      lease: LEASE,
    });
    expect(source).toContain("game.world?.id !== expectedLease.worldId");
    expect(source).toContain("game.system?.id !== expectedLease.systemId");
    expect(source).toContain('"worldId":"d6e2-acceptance-run"');
    expect(source).toContain("renderedLease?.leaseNonce");
    expect(source).toContain("game.user?.isGM");
    expect(source).toContain("leaseNonce");
    expect(source).toContain("runId");
    expect(source).toContain("isGM");
    expect(source).toContain('game.user?.id !== "player-id"');
  });

  it.each([
    [
      "a different authenticated user",
      { user: { id: "other-user", isGM: true, role: 4 } },
      /session user identity does not match/,
    ],
    [
      "a non-GM session",
      { user: { id: "gm-id", isGM: false, role: 1 } },
      /session is not a Gamemaster/,
    ],
    [
      "a different disposable lease",
      { world: { id: "different-world" } },
      /world identity mismatch/,
    ],
  ])("rejects %s immediately after entry", async (_label, change, expected) => {
    const priorGame = globalThis.game;
    globalThis.game = {
      ready: true,
      system: { id: LEASE.systemId },
      user: { id: "gm-id", isGM: true, role: 4 },
      world: {
        flags: {
          "d6-system-2e": {
            acceptanceFoundation: {
              leaseNonce: LEASE.leaseNonce,
              runId: LEASE.runId,
            },
          },
        },
        id: LEASE.worldId,
      },
      ...change,
    };
    try {
      const source = buildRuntimeProbeAction({
        expectedRole: "gm",
        expectedUserId: "gm-id",
        lease: LEASE,
      });
      await expect(executePublicEvalSource(source)).rejects.toThrow(expected);
    } finally {
      globalThis.game = priorGame;
    }
  });

  it("creates only neutral lease-marked Actor/Item/Scene/Token fixtures", () => {
    const source = buildCreateNeutralFixtureAction({
      gmUserId: "gm-id",
      lease: LEASE,
      playerName: "Synthetic Player",
    });
    expect(source).toContain("Actor.create");
    expect(source).toContain("Item.create");
    expect(source).toContain("Scene.create");
    expect(source).toContain('createEmbeddedDocuments("Token"');
    expect(source).toContain('type: "weapon"');
    expect(source).toContain('"system.creation.active": false');
    expect(source).toContain('"system.sheetMode.value": "freeedit"');
    expect(source).toContain(
      'actor.update({ "system.sheetMode.value": "normal" })',
    );
    expect(source).toContain("validateCreatedArray");
    expect(source).toContain("acceptanceFoundation");
    expect(source).toContain("Synthetic Acceptance Character");
    expect(source).not.toMatch(/star wars|reup|echo/i);
  });

  it("returns validated IDs and a redacted stage ledger for the complete fixture", async () => {
    const { globals } = fixtureGlobals();
    const output = await executePublicEvalSource(
      buildCreateNeutralFixtureAction({
        gmUserId: "gm-id",
        lease: LEASE,
        playerName: "Synthetic Player",
      }),
      globals,
    );
    const result = parsePageActionResult(output);
    expect(result).toMatchObject({
      actorId: "actor-id",
      playerId: "player-id",
      sceneId: "scene-id",
      skillId: "skill-id",
      tokenId: "token-id",
      weaponId: "weapon-id",
      worldItemId: "world-item-id",
    });
    expect(result.stages.map(({ stage }) => stage)).toEqual([
      "player-create",
      "player-authority",
      "actor-create",
      "actor-authoring-open",
      "actor-ownership",
      "skill-create",
      "actor-authoring-close",
      "weapon-create",
      "world-item-create",
      "scene-create",
      "token-create",
      "scene-activate",
    ]);
  });

  it.each(["skill-create", "weapon-create", "token-create"])(
    "rejects empty %s embedded-document results before an ID dereference",
    async (stage) => {
      const { globals } = fixtureGlobals({
        embeddedFailure: { kind: "empty", stage },
      });
      await expect(
        executePublicEvalSource(
          buildCreateNeutralFixtureAction({
            gmUserId: "gm-id",
            lease: LEASE,
            playerName: "Synthetic Player",
          }),
          globals,
        ),
      ).rejects.toThrow(
        new RegExp(
          `${stage}.*invalid-document-array|invalid-document-array.*${stage}`,
        ),
      );
    },
  );

  it.each(["skill-create", "weapon-create", "token-create"])(
    "rejects undefined %s embedded-document results before an ID dereference",
    async (stage) => {
      const { globals } = fixtureGlobals({
        embeddedFailure: { kind: "undefined", stage },
      });
      await expect(
        executePublicEvalSource(
          buildCreateNeutralFixtureAction({
            gmUserId: "gm-id",
            lease: LEASE,
            playerName: "Synthetic Player",
          }),
          globals,
        ),
      ).rejects.toThrow(/invalid-document-array/);
    },
  );

  it.each(["skill-create", "weapon-create", "token-create"])(
    "rejects wrong-cardinality %s embedded-document results",
    async (stage) => {
      const { globals } = fixtureGlobals({
        embeddedFailure: { kind: "wrong-cardinality", stage },
      });
      await expect(
        executePublicEvalSource(
          buildCreateNeutralFixtureAction({
            gmUserId: "gm-id",
            lease: LEASE,
            playerName: "Synthetic Player",
          }),
          globals,
        ),
      ).rejects.toThrow(/invalid-document-array/);
    },
  );

  it("rejects an embedded document with the wrong validated type", async () => {
    const { globals } = fixtureGlobals({
      embeddedFailure: { kind: "wrong-type", stage: "skill-create" },
    });
    await expect(
      executePublicEvalSource(
        buildCreateNeutralFixtureAction({
          gmUserId: "gm-id",
          lease: LEASE,
          playerName: "Synthetic Player",
        }),
        globals,
      ),
    ).rejects.toThrow(/invalid-document-result/);
  });

  it.each([
    "player-create",
    "actor-create",
    "actor-authoring-open",
    "actor-authoring-close",
    "world-item-create",
    "scene-create",
    "scene-activate",
  ])("rejects an undefined %s document result", async (stage) => {
    const { globals } = fixtureGlobals({
      directFailure: { stage, value: undefined },
    });
    await expect(
      executePublicEvalSource(
        buildCreateNeutralFixtureAction({
          gmUserId: "gm-id",
          lease: LEASE,
          playerName: "Synthetic Player",
        }),
        globals,
      ),
    ).rejects.toThrow(new RegExp(stage));
  });

  it("checks owning-player update authority separately from the GM role", () => {
    const source = buildReadNeutralFixtureAction({
      actorId: "actor",
      expectedRole: "player",
      leaseNonce: "lease",
      worldItemId: "item",
    });
    expect(source).toContain('canUserModify(game.user, "update")');
    expect(source).toContain('canUserModify(game.user, "delete")');
    expect(source).toContain("!canUpdate || game.user.isGM");
    expect(source).toContain("token.sight?.enabled !== true");
    expect(source).toContain("tokenSightEnabled: token.sight.enabled");
  });

  it("creates the owned synthetic Token as a player vision source", () => {
    const source = buildCreateNeutralFixtureAction({
      gmUserId: "gm-id",
      lease: LEASE,
      playerName: "Synthetic Player",
    });
    expect(source).toContain("sight: { enabled: true }");
    expect(source.indexOf("sight: { enabled: true }")).toBeLessThan(
      source.indexOf("scene.activate()"),
    );
  });

  it("restores world settings but refuses silent module activation drift", () => {
    const source = buildSettingsRestoreAction({
      gmUserId: "gm-id",
      lease: LEASE,
      snapshot: { modules: [], settings: [] },
    });
    expect(source).toContain("game.settings.set");
    expect(source).toContain("module activation changed");
    expect(source.indexOf("Disposable world identity mismatch")).toBeLessThan(
      source.indexOf("game.settings.set"),
    );
    expect(source).toContain('"leaseNonce":"lease"');
    expect(source).toContain('"runId":"run"');
  });

  it("does not read Foundry 14 settings retired without replacement", () => {
    const source = buildSettingsSnapshotAction();
    expect(source).toContain("core.gridTemplates");
    expect(source).toContain("core.coneTemplateType");
    expect(
      source.indexOf("retiredWithoutReplacement.has(qualified)"),
    ).toBeLessThan(source.indexOf("game.settings.get(namespace, key)"));
    expect(source).toContain("excludedRetiredSettings");
  });

  it("deletes only documents with the exact lease marker", () => {
    const source = buildCleanupAction({
      gmUserId: "gm-id",
      lease: LEASE,
    });
    expect(source).toContain("filter(matches)");
    expect(source).toContain("?.leaseNonce");
    expect(source).not.toContain("deleteDocuments(game.messages");
    expect(source).not.toMatch(
      /for \(const message of game\.messages\.contents\)/,
    );
    expect(source).toContain("filter(matches)");
    expect(source).toContain("game.world?.id !== expectedLease.worldId");
    expect(source).toContain("game.system?.id !== expectedLease.systemId");
    expect(source).toContain("actor.items?.contents");
    expect(source).toContain("scene.tokens?.contents");
  });

  it("cleans exact-lease roots and embedded documents idempotently", async () => {
    const marker = { leaseNonce: LEASE.leaseNonce, runId: LEASE.runId };
    const game = {
      actors: { contents: [] },
      items: { contents: [] },
      messages: { contents: [] },
      ready: true,
      scenes: { contents: [] },
      system: { id: LEASE.systemId },
      user: { id: "gm-id", isGM: true },
      users: { contents: [] },
      world: { getFlag: () => marker, id: LEASE.worldId },
    };
    const leaseDocument = (collection, embedded = {}) => {
      const document = {
        ...embedded,
        delete: vi.fn(async () => {
          collection.contents = collection.contents.filter(
            (entry) => entry !== document,
          );
        }),
        getFlag: () => marker,
      };
      collection.contents.push(document);
      return document;
    };
    const actor = leaseDocument(game.actors, { items: { contents: [] } });
    leaseDocument(actor.items);
    const scene = leaseDocument(game.scenes, { tokens: { contents: [] } });
    leaseDocument(scene.tokens);
    const source = buildCleanupAction({ gmUserId: "gm-id", lease: LEASE });

    await expect(executePublicEvalSource(source, { game })).resolves.toEqual(
      expect.any(String),
    );
    expect(
      parsePageActionResult(await executePublicEvalSource(source, { game })),
    ).toEqual({ leftovers: 0 });
    expect(game.actors.contents).toEqual([]);
    expect(game.scenes.contents).toEqual([]);
  });

  it("performs no settings or deletion mutation when lease identity fails", async () => {
    const set = vi.fn();
    const deleteDocument = vi.fn();
    const collections = {
      actors: { contents: [{ delete: deleteDocument, getFlag: () => null }] },
      items: { contents: [] },
      messages: { contents: [] },
      scenes: { contents: [] },
      users: { contents: [] },
    };
    const game = {
      ...collections,
      ready: true,
      modules: new Map(),
      settings: { get: vi.fn(), set },
      system: { id: "d6-system-2e" },
      user: { isGM: true },
      world: { id: "different-world" },
    };
    const lease = LEASE;
    const restore = buildSettingsRestoreAction({
      gmUserId: "gm-id",
      lease,
      snapshot: { modules: [], settings: [{ key: "x", namespace: "y" }] },
    });
    const cleanup = buildCleanupAction({ gmUserId: "gm-id", lease });
    await expect(executePublicEvalSource(restore, { game })).rejects.toThrow(
      /world identity mismatch/,
    );
    await expect(executePublicEvalSource(cleanup, { game })).rejects.toThrow(
      /world identity mismatch/,
    );
    expect(set).not.toHaveBeenCalled();
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("performs no fixture or GM chat mutation when the rendered lease is wrong", async () => {
    const setFlag = vi.fn();
    const message = {
      author: { id: "player-id" },
      blind: false,
      getFlag: (_scope, key) => (key === "roll" ? {} : undefined),
      id: "message",
      isOwner: true,
      setFlag,
      timestamp: 2,
      whisper: [],
    };
    const game = {
      actors: { contents: [] },
      items: { contents: [] },
      messages: { contents: [message] },
      ready: true,
      scenes: { contents: [] },
      system: { id: "d6-system-2e" },
      user: { id: "gm-id", isGM: true },
      users: { contents: [], find: vi.fn() },
      world: {
        flags: {
          "d6-system-2e": {
            acceptanceFoundation: {
              leaseNonce: "different",
              runId: LEASE.runId,
            },
          },
        },
        id: LEASE.worldId,
      },
    };
    const fixture = buildCreateNeutralFixtureAction({
      gmUserId: "gm-id",
      lease: LEASE,
      playerName: "Synthetic Player",
    });
    const chat = buildMarkChatAsGmAction({
      boundary: { latestTimestamp: 1, messageCount: 0, messageIds: [] },
      expectedPlayerId: "player-id",
      gmUserId: "gm-id",
      lease: LEASE,
      messageId: "message",
    });
    await expect(executePublicEvalSource(fixture, { game })).rejects.toThrow(
      /Rendered disposable lease identity mismatch/,
    );
    await expect(executePublicEvalSource(chat, { game })).rejects.toThrow(
      /Rendered disposable lease identity mismatch/,
    );
    expect(game.users.find).not.toHaveBeenCalled();
    expect(setFlag).not.toHaveBeenCalled();
  });

  function chatGame({ messages, role = "player", userId } = {}) {
    const contents = messages ?? [];
    return {
      ready: true,
      messages: {
        contents,
        get(id) {
          return contents.find((message) => message.id === id);
        },
      },
      system: { id: LEASE.systemId },
      user: {
        id: userId ?? (role === "gm" ? "gm-id" : "player-id"),
        isGM: role === "gm",
      },
      world: {
        getFlag: () => ({ leaseNonce: LEASE.leaseNonce, runId: LEASE.runId }),
        id: LEASE.worldId,
      },
    };
  }

  function chatMessage({
    authorId = "player-id",
    blind = false,
    id = "message",
    isOwner = true,
    marker,
    timestamp = 2,
    whisper = [],
  } = {}) {
    let acceptanceMarker = marker;
    const message = {
      author: { id: authorId },
      blind,
      canUserModify: vi.fn(() => true),
      getFlag: vi.fn((_scope, key) =>
        key === "roll"
          ? { request: { rollMode: "publicroll" } }
          : acceptanceMarker,
      ),
      id,
      isOwner,
      setFlag: vi.fn(async (_scope, _key, value) => {
        acceptanceMarker = value;
        return message;
      }),
      timestamp,
      whisper,
    };
    return message;
  }

  const EMPTY_CHAT_BOUNDARY = Object.freeze({
    latestTimestamp: 1,
    messageCount: 0,
    messageIds: [],
  });

  it("keeps player roll discovery read-only and returns the exact public message", async () => {
    const message = chatMessage();
    const game = chatGame({ messages: [message] });
    const source = buildIdentifyRollChatAction({
      boundary: EMPTY_CHAT_BOUNDARY,
      expectedUserId: "player-id",
      lease: LEASE,
    });
    expect(source).not.toMatch(/^\s*\(async/);
    expect(source).toContain("const __d6e2PageActionPayload = await");
    expect(source).not.toContain(".setFlag(");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".delete(");
    const output = await executePublicEvalSource(source, { game });
    expect(message.setFlag).not.toHaveBeenCalled();
    expect(parsePageActionResult(output)).toEqual({
      authorMatches: true,
      blind: false,
      messageId: "message",
      public: true,
      timestamp: 2,
      whisperCount: 0,
    });
  });

  it("captures only structural pre-roll ChatMessage boundary facts", async () => {
    const existing = chatMessage({ id: "before", timestamp: 7 });
    const source = buildCaptureChatBoundaryAction({
      expectedUserId: "player-id",
      lease: LEASE,
    });
    const output = await executePublicEvalSource(source, {
      game: chatGame({ messages: [existing] }),
    });
    expect(source).not.toContain(".setFlag(");
    expect(parsePageActionResult(output)).toEqual({
      latestTimestamp: 7,
      messageCount: 1,
      messageIds: ["before"],
    });
  });

  it("observes exact roll cardinality using only structural ChatMessage facts", async () => {
    const before = chatMessage({ id: "before", timestamp: 1 });
    const created = chatMessage({ id: "created", timestamp: 2 });
    const source = buildObserveRollChatAction({
      boundary: {
        latestTimestamp: 1,
        messageCount: 1,
        messageIds: ["before"],
      },
      expectedUserId: "player-id",
      lease: LEASE,
    });
    const output = await executePublicEvalSource(source, {
      game: chatGame({ messages: [before, created] }),
    });
    expect(source).not.toContain(".setFlag(");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".delete(");
    expect(source).not.toMatch(/\bmessage(?:\?\.)?\.content/);
    expect(parsePageActionResult(output)).toEqual({
      boundaryCount: 1,
      boundaryIds: ["before"],
      boundaryMissingIds: [],
      candidateCount: 1,
      candidates: [
        {
          acceptanceMarkerState: "absent",
          authorMatches: true,
          blind: false,
          hasRollFlag: true,
          id: "created",
          isLatest: true,
          timestamp: 2,
          whisperCount: 0,
        },
      ],
      currentCount: 2,
      currentIds: ["before", "created"],
      exactCardinality: true,
    });
  });

  it.each([
    ["zero", []],
    ["multiple", [chatMessage({ id: "one" }), chatMessage({ id: "two" })]],
  ])(
    "classifies %s new roll messages without mutating them",
    async (_label, messages) => {
      const output = await executePublicEvalSource(
        buildObserveRollChatAction({
          boundary: EMPTY_CHAT_BOUNDARY,
          expectedUserId: "player-id",
          lease: LEASE,
        }),
        { game: chatGame({ messages }) },
      );
      const result = parsePageActionResult(output);
      expect(result.candidateCount).toBe(messages.length);
      expect(result.exactCardinality).toBe(false);
      for (const message of messages) {
        expect(message.setFlag).not.toHaveBeenCalled();
      }
    },
  );

  it("reduces a concurrent persistent author to a boolean without persisting its ID", async () => {
    const persistentAuthorId = "persistent-user-id";
    const output = await executePublicEvalSource(
      buildObserveRollChatAction({
        boundary: EMPTY_CHAT_BOUNDARY,
        expectedUserId: "player-id",
        lease: LEASE,
      }),
      {
        game: chatGame({
          messages: [chatMessage({ authorId: persistentAuthorId })],
        }),
      },
    );
    const result = parsePageActionResult(output);
    expect(result.candidates).toEqual([
      expect.objectContaining({ authorMatches: false }),
    ]);
    expect(JSON.stringify(result)).not.toContain(persistentAuthorId);
    expect(result.candidates[0]).not.toHaveProperty("authorId");
  });

  it("records a stale boundary structurally without accepting exact cardinality", async () => {
    const output = await executePublicEvalSource(
      buildObserveRollChatAction({
        boundary: {
          latestTimestamp: 1,
          messageCount: 1,
          messageIds: ["missing"],
        },
        expectedUserId: "player-id",
        lease: LEASE,
      }),
      { game: chatGame({ messages: [chatMessage({ id: "created" })] }) },
    );
    expect(parsePageActionResult(output)).toMatchObject({
      boundaryMissingIds: ["missing"],
      candidateCount: 1,
      exactCardinality: false,
    });
  });

  it.each([
    ["wrong author", { authorId: "other-player" }, /author mismatch/],
    ["whisper", { whisper: ["gm-id"] }, /not public/],
    ["blind", { blind: true }, /not public/],
    ["stale timestamp", { timestamp: 0 }, /outside the captured roll boundary/],
  ])("rejects a %s before GM mutation", async (_label, overrides, error) => {
    const message = chatMessage(overrides);
    await expect(
      executePublicEvalSource(
        buildMarkChatAsGmAction({
          boundary: EMPTY_CHAT_BOUNDARY,
          expectedPlayerId: "player-id",
          gmUserId: "gm-id",
          lease: LEASE,
          messageId: message.id,
        }),
        { game: chatGame({ messages: [message], role: "gm" }) },
      ),
    ).rejects.toThrow(error);
    expect(message.setFlag).not.toHaveBeenCalled();
  });

  it("rejects a preexisting message outside the captured ID boundary", async () => {
    const message = chatMessage({ id: "before" });
    await expect(
      executePublicEvalSource(
        buildMarkChatAsGmAction({
          boundary: {
            latestTimestamp: 1,
            messageCount: 1,
            messageIds: ["before"],
          },
          expectedPlayerId: "player-id",
          gmUserId: "gm-id",
          lease: LEASE,
          messageId: "before",
        }),
        { game: chatGame({ messages: [message], role: "gm" }) },
      ),
    ).rejects.toThrow(/outside the captured roll order boundary/);
    expect(message.setFlag).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", []],
    ["duplicated", [chatMessage(), chatMessage()]],
  ])("rejects an exact message ID that is %s", async (_label, messages) => {
    await expect(
      executePublicEvalSource(
        buildMarkChatAsGmAction({
          boundary: EMPTY_CHAT_BOUNDARY,
          expectedPlayerId: "player-id",
          gmUserId: "gm-id",
          lease: LEASE,
          messageId: "message",
        }),
        { game: chatGame({ messages, role: "gm" }) },
      ),
    ).rejects.toThrow(/missing or duplicated/);
    for (const message of messages) {
      expect(message.setFlag).not.toHaveBeenCalled();
    }
  });

  it("blocks a non-GM confused deputy before marking", async () => {
    const message = chatMessage();
    await expect(
      executePublicEvalSource(
        buildMarkChatAsGmAction({
          boundary: EMPTY_CHAT_BOUNDARY,
          expectedPlayerId: "player-id",
          gmUserId: "gm-id",
          lease: LEASE,
          messageId: message.id,
        }),
        { game: chatGame({ messages: [message], userId: "gm-id" }) },
      ),
    ).rejects.toThrow(/not a Gamemaster/);
    expect(message.setFlag).not.toHaveBeenCalled();
  });

  it("fails when the GM marker write does not persist", async () => {
    const message = chatMessage();
    message.setFlag.mockImplementation(async () => message);
    await expect(
      executePublicEvalSource(
        buildMarkChatAsGmAction({
          boundary: EMPTY_CHAT_BOUNDARY,
          expectedPlayerId: "player-id",
          gmUserId: "gm-id",
          lease: LEASE,
          messageId: message.id,
        }),
        { game: chatGame({ messages: [message], role: "gm" }) },
      ),
    ).rejects.toThrow(/did not persist/);
    expect(message.setFlag).toHaveBeenCalledOnce();
  });

  it("marks through the exact GM and lets the player verify without mutation", async () => {
    const message = chatMessage();
    const gmOutput = await executePublicEvalSource(
      buildMarkChatAsGmAction({
        boundary: EMPTY_CHAT_BOUNDARY,
        expectedPlayerId: "player-id",
        gmUserId: "gm-id",
        lease: LEASE,
        messageId: message.id,
      }),
      { game: chatGame({ messages: [message], role: "gm" }) },
    );
    expect(message.setFlag).toHaveBeenCalledOnce();
    expect(parsePageActionResult(gmOutput)).toMatchObject({
      alreadyMarked: false,
      messageId: "message",
      public: true,
    });

    const verifySource = buildVerifyChatAction({
      expectedUserId: "player-id",
      lease: LEASE,
      messageId: message.id,
    });
    const playerOutput = await executePublicEvalSource(verifySource, {
      game: chatGame({ messages: [message] }),
    });
    expect(verifySource).not.toContain(".setFlag(");
    expect(parsePageActionResult(playerOutput)).toMatchObject({
      messageId: "message",
      public: true,
    });
  });

  it("cleans only the exact marked message and remains idempotent", async () => {
    const marked = chatMessage({
      id: "marked",
      marker: { leaseNonce: LEASE.leaseNonce, runId: LEASE.runId },
    });
    const unrelated = chatMessage({ id: "unrelated" });
    const game = chatGame({ messages: [marked, unrelated], role: "gm" });
    marked.delete = vi.fn(async () => {
      game.messages.contents = game.messages.contents.filter(
        (message) => message !== marked,
      );
    });
    unrelated.delete = vi.fn();
    game.actors = { contents: [] };
    game.items = { contents: [] };
    game.scenes = { contents: [] };
    game.users = { contents: [] };
    const source = buildCleanupAction({ gmUserId: "gm-id", lease: LEASE });
    await executePublicEvalSource(source, { game });
    await executePublicEvalSource(source, { game });
    expect(marked.delete).toHaveBeenCalledOnce();
    expect(unrelated.delete).not.toHaveBeenCalled();
    expect(game.messages.contents).toEqual([unrelated]);
  });

  it.each([
    ["empty", ""],
    ["malformed", "not-json"],
    ["wrong protocol", JSON.stringify({ protocol: "other", payload: {} })],
    [
      "unexpected envelope data",
      JSON.stringify({
        extra: true,
        payload: {},
        protocol: PAGE_ACTION_PROTOCOL,
      }),
    ],
  ])("rejects %s public page-action output", (_label, output) => {
    expect(() => parsePageActionResult(output)).toThrow(/Page action returned/);
  });
});
