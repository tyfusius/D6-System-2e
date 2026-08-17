import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AcceptanceError } from "./core.mjs";

const FLAG_SCOPE = "d6-system-2e";
const FLAG_KEY = "acceptanceFoundation";
export const PAGE_ACTION_PROTOCOL = "d6e2-foundry-acceptance-page-action-v1";

function json(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function expression(body) {
  return `const __d6e2PageActionPayload = await (async () => {\n${body}\n})();\nreturn JSON.stringify({ protocol: ${json(PAGE_ACTION_PROTOCOL)}, payload: JSON.parse(__d6e2PageActionPayload) });`;
}

function runtimeLeaseAssertion(lease) {
  return `
  const expectedLease = ${json({
    leaseNonce: lease.leaseNonce,
    runId: lease.runId,
    systemId: lease.systemId,
    worldId: lease.worldId,
  })};
  if (game.world?.id !== expectedLease.worldId) throw new Error("Disposable world identity mismatch; mutation blocked.");
  if (game.system?.id !== expectedLease.systemId) throw new Error("Disposable system identity mismatch; mutation blocked.");
  const renderedLease = game.world?.getFlag?.(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)})
    ?? game.world?.flags?.[${json(FLAG_SCOPE)}]?.[${json(FLAG_KEY)}];
  if (renderedLease?.runId !== expectedLease.runId || renderedLease?.leaseNonce !== expectedLease.leaseNonce) {
    throw new Error("Rendered disposable lease identity mismatch; mutation blocked.");
  }`;
}

function runtimeAuthorityAssertion({ expectedRole, expectedUserId, lease }) {
  return `
  if (!game?.ready) throw new Error("Foundry game is not ready.");
  ${runtimeLeaseAssertion(lease)}
  if (game.user?.id !== ${json(expectedUserId)}) throw new Error("Foundry session user identity does not match the authenticated user.");
  if (${json(expectedRole)} === "gm" && !game.user?.isGM) throw new Error("GM session is not a Gamemaster.");
  if (${json(expectedRole)} === "player" && game.user?.isGM) throw new Error("Player session has Gamemaster authority.");`;
}

function leaseMatcher() {
  return `
  const leaseMatches = (document) => {
    const marker = document?.getFlag?.(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)});
    return marker?.leaseNonce === expectedLease.leaseNonce && marker?.runId === expectedLease.runId;
  };`;
}

export function parsePageActionResult(output) {
  if (typeof output !== "string" || output.trim().length === 0) {
    throw new AcceptanceError(
      "PAGE_ACTION_RESULT",
      "Page action returned an empty result.",
    );
  }
  let envelope;
  try {
    envelope = JSON.parse(output);
  } catch {
    throw new AcceptanceError(
      "PAGE_ACTION_RESULT",
      "Page action returned malformed JSON.",
      { output },
    );
  }
  if (
    !envelope ||
    typeof envelope !== "object" ||
    Array.isArray(envelope) ||
    envelope.protocol !== PAGE_ACTION_PROTOCOL ||
    !envelope.payload ||
    typeof envelope.payload !== "object" ||
    Array.isArray(envelope.payload) ||
    Object.keys(envelope).some((key) => !["payload", "protocol"].includes(key))
  ) {
    throw new AcceptanceError(
      "PAGE_ACTION_RESULT",
      "Page action returned an invalid protocol envelope.",
    );
  }
  return envelope.payload;
}

export async function writePageAction(runRoot, name, source) {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new AcceptanceError(
      "INVALID_PAGE_ACTION",
      `Invalid page-action name ${name}.`,
    );
  }
  const directory = path.join(runRoot, "page-actions");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, `${name}.js`);
  await writeFile(file, source, { encoding: "utf8", mode: 0o600 });
  return file;
}

export function buildRuntimeProbeAction({
  expectedRole,
  expectedUserId,
  lease,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole, expectedUserId, lease })}
  return JSON.stringify({
    foundryVersion: game.version ?? game.release?.version,
    isGM: game.user?.isGM === true,
    leaseNonce: renderedLease?.leaseNonce,
    role: game.user?.role,
    runId: renderedLease?.runId,
    systemId: game.system?.id,
    systemVersion: game.system?.version,
    userId: game.user?.id,
    webglAvailable: Boolean(document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl")),
    worldId: game.world?.id,
  });`);
}

export function buildSettingsSnapshotAction() {
  return expression(`
  if (!game.user?.isGM) throw new Error("Only a GM may snapshot world settings.");
  // Foundry 14 retains these retired settings only to warn callers. They have
  // no replacement and this acceptance scenario never mutates them.
  const retiredWithoutReplacement = new Set(["core.coneTemplateType", "core.gridTemplates"]);
  const settings = [];
  for (const [qualified, definition] of game.settings.settings.entries()) {
    if (definition.scope !== "world") continue;
    if (retiredWithoutReplacement.has(qualified)) continue;
    const separator = qualified.indexOf(".");
    const namespace = qualified.slice(0, separator);
    const key = qualified.slice(separator + 1);
    settings.push({ key, namespace, value: structuredClone(game.settings.get(namespace, key)) });
  }
  settings.sort((left, right) => (left.namespace + "." + left.key).localeCompare(right.namespace + "." + right.key));
  const modules = [...game.modules.values()]
    .map((entry) => ({ active: Boolean(entry.active), id: entry.id, version: entry.version }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify({
    excludedRetiredSettings: [...retiredWithoutReplacement].sort(),
    modules,
    settings,
  });`);
}

export function buildSettingsRestoreAction({ gmUserId, lease, snapshot }) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "gm", expectedUserId: gmUserId, lease })}
  const snapshot = ${json(snapshot)};
  const activeModules = [...game.modules.values()].filter((entry) => entry.active).map((entry) => entry.id).sort();
  const expectedModules = snapshot.modules.filter((entry) => entry.active).map((entry) => entry.id).sort();
  if (JSON.stringify(activeModules) !== JSON.stringify(expectedModules)) {
    throw new Error("Foundry module activation changed; restore it through Setup before cleanup can pass.");
  }
  const changed = [];
  for (const entry of snapshot.settings) {
    const current = game.settings.get(entry.namespace, entry.key);
    if (JSON.stringify(current) === JSON.stringify(entry.value)) continue;
    await game.settings.set(entry.namespace, entry.key, structuredClone(entry.value));
    changed.push(entry.namespace + "." + entry.key);
  }
  return JSON.stringify({ changed });`);
}

export function buildCreateNeutralFixtureAction({
  gmUserId,
  lease,
  playerName,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "gm", expectedUserId: gmUserId, lease })}
  const marker = { leaseNonce: expectedLease.leaseNonce, runId: expectedLease.runId };
  const stages = [];
  const failStage = (stage, reason, observed = {}) => {
    throw new Error("D6E2_ACCEPTANCE_FIXTURE_STAGE " + JSON.stringify({ observed, reason, stage }));
  };
  const runStage = async (stage, operation) => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("D6E2_ACCEPTANCE_FIXTURE_STAGE ")) throw error;
      failStage(stage, "operation-threw", { errorKind: error instanceof Error ? "Error" : typeof error });
    }
  };
  const validateDocument = (stage, document, expected) => {
    const observed = {
      documentName: document?.documentName ?? null,
      hasId: typeof document?.id === "string" && document.id.length > 0,
      markerMatches: document ? document.getFlag?.(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)})?.leaseNonce === marker.leaseNonce
        && document.getFlag?.(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)})?.runId === marker.runId : false,
      parentMatches: expected.parentId === undefined ? true : document?.parent?.id === expected.parentId,
      type: document?.type ?? null,
    };
    if (!document || !observed.hasId || observed.documentName !== expected.documentName
      || (expected.type !== undefined && observed.type !== expected.type)
      || !observed.markerMatches || !observed.parentMatches) {
      failStage(stage, "invalid-document-result", observed);
    }
    stages.push({ count: 1, documentName: observed.documentName, stage, type: observed.type });
    return document;
  };
  const validateCreatedArray = (stage, result, expected) => {
    if (!Array.isArray(result) || result.length !== 1) {
      failStage(stage, "invalid-document-array", {
        array: Array.isArray(result),
        count: Array.isArray(result) ? result.length : null,
      });
    }
    return validateDocument(stage, result[0], expected);
  };
  let player = game.users.find((user) => user.name === ${json(playerName)});
  if (!player) {
    player = validateDocument("player-create", await runStage("player-create", () => User.create({
      flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
      name: ${json(playerName)},
      password: "",
      role: CONST.USER_ROLES.PLAYER,
    })), { documentName: "User" });
  } else {
    player = validateDocument("player-existing", player, { documentName: "User" });
  }
  if (player.isGM || player.role !== CONST.USER_ROLES.PLAYER) {
    failStage("player-authority", "unexpected-player-authority", { gm: player.isGM === true, roleMatches: player.role === CONST.USER_ROLES.PLAYER });
  }
  stages.push({ count: 1, documentName: "User", stage: "player-authority", type: null });
  let actor = validateDocument("actor-create", await runStage("actor-create", () => Actor.create({
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    name: "Synthetic Acceptance Character",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    system: {
      attributes: {
        agility: { score: 9 },
        brawn: { score: 9 },
        knowledge: { score: 9 },
        perception: { score: 9 },
      },
    },
    type: "character",
  })), { documentName: "Actor", type: "character" });
  actor = validateDocument("actor-authoring-open", await runStage("actor-authoring-open", () => actor.update({
    "system.creation.active": false,
    "system.sheetMode.value": "freeedit",
  })), {
    documentName: "Actor",
    type: "character",
  });
  if (actor.system?.creation?.active !== false || actor.system?.sheetMode?.value !== "freeedit") {
    failStage("actor-authoring-open", "authoring-mode-not-established", {
      creationClosed: actor.system?.creation?.active === false,
      freeEdit: actor.system?.sheetMode?.value === "freeedit",
    });
  }
  if (actor.ownership?.[player.id] !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER || !actor.canUserModify(player, "update")) {
    failStage("actor-ownership", "owning-player-authority-missing", { ownerLevelMatches: false });
  }
  stages.push({ count: 1, documentName: "Actor", stage: "actor-ownership", type: "character" });
  const skill = validateCreatedArray("skill-create", await runStage("skill-create", () => actor.createEmbeddedDocuments("Item", [{
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    name: "Synthetic Athletics",
    system: {
      attributeId: "agility",
      description: "",
      key: "synthetic-athletics",
      score: 0,
      source: { book: "D6 System: Second Edition", module: "core", page: 0 },
      training: "standard",
    },
    type: "skill",
  }])), { documentName: "Item", parentId: actor.id, type: "skill" });
  actor = validateDocument("actor-authoring-close", await runStage("actor-authoring-close", () => actor.update({ "system.sheetMode.value": "normal" })), {
    documentName: "Actor",
    type: "character",
  });
  if (actor.system?.sheetMode?.value !== "normal") {
    failStage("actor-authoring-close", "authoring-mode-remained-active", { normalMode: false });
  }
  const weapon = validateCreatedArray("weapon-create", await runStage("weapon-create", () => actor.createEmbeddedDocuments("Item", [{
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    name: "Synthetic Training Weapon",
    system: {
      attackAttributeId: "agility",
      attackBonus: 0,
      attackSkillKey: "synthetic-athletics",
      damage: 9,
      damageBasis: "fixed",
      damageType: "",
      description: "",
      equipped: true,
      key: "synthetic-training-weapon",
      quantity: 1,
      range: { shortMinimum: 0, short: 10, medium: 20, long: 30 },
      weaponKind: "standard",
    },
    type: "weapon",
  }])), { documentName: "Item", parentId: actor.id, type: "weapon" });
  const worldItem = validateDocument("world-item-create", await runStage("world-item-create", () => Item.create({
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    name: "Synthetic Standalone Item",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    system: { description: "Synthetic acceptance fixture", equipped: false, quantity: 1 },
    type: "gear",
  })), { documentName: "Item", type: "gear" });
  const scene = validateDocument("scene-create", await runStage("scene-create", () => Scene.create({
    active: false,
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    grid: { distance: 1, size: 100, units: "m" },
    height: 1800,
    name: "Synthetic Acceptance Scene",
    navigation: true,
    width: 2400,
  })), { documentName: "Scene" });
  const token = validateCreatedArray("token-create", await runStage("token-create", () => scene.createEmbeddedDocuments("Token", [{
    actorId: actor.id,
    actorLink: true,
    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    name: actor.name,
    sight: { enabled: true },
    x: 400,
    y: 400,
  }])), { documentName: "Token", parentId: scene.id });
  const activatedScene = validateDocument("scene-activate", await runStage("scene-activate", () => scene.activate()), { documentName: "Scene" });
  if (activatedScene.id !== scene.id || game.scenes.active?.id !== scene.id) {
    failStage("scene-activate", "scene-did-not-become-active", { activeSceneMatches: game.scenes.active?.id === scene.id });
  }
  return JSON.stringify({ actorId: actor.id, playerId: player.id, sceneId: scene.id, skillId: skill.id, stages, tokenId: token.id, weaponId: weapon.id, worldItemId: worldItem.id });`);
}

export function buildReadNeutralFixtureAction({
  actorId,
  leaseNonce,
  expectedRole,
  worldItemId,
}) {
  return expression(`
  const actor = game.actors.get(${json(actorId)});
  if (!actor) throw new Error("Synthetic Actor is missing after load/reload.");
  const marker = actor.getFlag(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)});
  if (marker?.leaseNonce !== ${json(leaseNonce)}) throw new Error("Synthetic Actor lease marker mismatch.");
  const skill = actor.items.find((item) => item.system.key === "synthetic-athletics");
  const weapon = actor.items.find((item) => item.system.key === "synthetic-training-weapon");
  const token = game.scenes.contents.flatMap((scene) => scene.tokens.contents).find((entry) => entry.actorId === actor.id);
  const worldItem = game.items.get(${json(worldItemId)});
  if (!skill || !weapon || !token || !worldItem) throw new Error("Synthetic Actor/Item/Token fixture is incomplete.");
  if (token.sight?.enabled !== true) throw new Error("Synthetic owned Token vision is disabled.");
  const canUpdate = actor.canUserModify(game.user, "update");
  const canDelete = actor.canUserModify(game.user, "delete");
  if (${json(expectedRole)} === "player" && (!canUpdate || game.user.isGM)) {
    throw new Error("Owning-player authority or role separation failed.");
  }
  if (${json(expectedRole)} === "gm" && (!canUpdate || !canDelete)) {
    throw new Error("GM document authority is incomplete.");
  }
  return JSON.stringify({ actorId: actor.id, canDelete, canUpdate, isGM: game.user.isGM, itemCount: actor.items.size, skillId: skill.id, tokenId: token.id, tokenSightEnabled: token.sight.enabled, weaponId: weapon.id, worldItemId: worldItem.id });`);
}

export function buildOpenActorSheetAction(actorId) {
  return expression(`
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Current user does not own the synthetic Actor.");
  await actor.sheet.render(true);
  return JSON.stringify({ actorId: actor.id, rendered: actor.sheet.rendered });`);
}

export function buildCaptureChatBoundaryAction({ expectedUserId, lease }) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  const messageIds = game.messages.contents.map((message) => message.id);
  if (messageIds.some((id) => typeof id !== "string" || id.length === 0) || new Set(messageIds).size !== messageIds.length) {
    throw new Error("Existing ChatMessage identity boundary is invalid.");
  }
  const timestamps = game.messages.contents.map((message) => message.timestamp).filter(Number.isFinite);
  return JSON.stringify({ latestTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : 0, messageCount: messageIds.length, messageIds });`);
}

function chatBoundaryAssertion(boundary) {
  return `
  const chatBoundary = ${json(boundary)};
  if (!chatBoundary || !Array.isArray(chatBoundary.messageIds) || !Number.isInteger(chatBoundary.messageCount) || chatBoundary.messageCount < 0 || chatBoundary.messageCount !== chatBoundary.messageIds.length || !Number.isFinite(chatBoundary.latestTimestamp) || chatBoundary.latestTimestamp < 0 || chatBoundary.messageIds.some((id) => typeof id !== "string" || id.length === 0) || new Set(chatBoundary.messageIds).size !== chatBoundary.messageIds.length) {
    throw new Error("Synthetic roll ChatMessage boundary is invalid.");
  }
  const chatAuthorId = (message) => typeof message?.author === "string"
    ? message.author
    : message?.author?.id ?? (typeof message?.user === "string" ? message.user : message?.user?.id);
  const assertPublicPlayerRoll = (message, expectedAuthorId) => {
    if (!message || typeof message.id !== "string" || message.id.length === 0) throw new Error("Synthetic roll ChatMessage identity is missing.");
    if (chatAuthorId(message) !== expectedAuthorId) throw new Error("Synthetic roll ChatMessage author mismatch.");
    if (!Array.isArray(message.whisper) || message.whisper.length > 0 || message.blind === true) throw new Error("Synthetic roll ChatMessage is not public.");
    if (!Number.isFinite(message.timestamp) || message.timestamp < chatBoundary.latestTimestamp) throw new Error("Synthetic roll ChatMessage is outside the captured roll boundary.");
    if (message.getFlag?.(${json(FLAG_SCOPE)}, "roll") == null) throw new Error("Synthetic ChatMessage is not a D6 roll result.");
  };`;
}

export function buildIdentifyRollChatAction({
  boundary,
  expectedUserId,
  lease,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  ${chatBoundaryAssertion(boundary)}
  const priorIds = new Set(chatBoundary.messageIds);
  const current = game.messages.contents;
  if (chatBoundary.messageIds.some((id) => !current.some((message) => message.id === id))) throw new Error("Pre-roll ChatMessage boundary changed before roll identification.");
  const candidates = current.filter((message) => !priorIds.has(message.id));
  if (current.length !== chatBoundary.messageCount + 1 || candidates.length !== 1 || current.at(-1)?.id !== candidates[0]?.id) {
    throw new Error("Synthetic roll ChatMessage result is missing or ambiguous.");
  }
  const message = candidates[0];
  assertPublicPlayerRoll(message, ${json(expectedUserId)});
  return JSON.stringify({ authorMatches: true, blind: false, messageId: message.id, public: true, timestamp: message.timestamp, whisperCount: 0 });`);
}

export function buildObserveRollChatAction({
  boundary,
  expectedUserId,
  lease,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  ${chatBoundaryAssertion(boundary)}
  const priorIds = new Set(chatBoundary.messageIds);
  const current = game.messages.contents;
  const candidates = current.filter((message) => !priorIds.has(message.id));
  const observed = (message) => {
    const acceptanceMarker = message.getFlag?.(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)});
    return {
      acceptanceMarkerState: acceptanceMarker == null
        ? "absent"
        : acceptanceMarker.runId === expectedLease.runId && acceptanceMarker.leaseNonce === expectedLease.leaseNonce
          ? "matching"
          : "other",
      authorMatches: chatAuthorId(message) === ${json(expectedUserId)},
      blind: message.blind === true,
      hasRollFlag: message.getFlag?.(${json(FLAG_SCOPE)}, "roll") != null,
      id: message.id,
      isLatest: current.at(-1)?.id === message.id,
      timestamp: Number.isFinite(message.timestamp) ? message.timestamp : null,
      whisperCount: Array.isArray(message.whisper) ? message.whisper.length : null,
    };
  };
  return JSON.stringify({
    boundaryCount: chatBoundary.messageCount,
    boundaryIds: chatBoundary.messageIds,
    boundaryMissingIds: chatBoundary.messageIds.filter((id) => !current.some((message) => message.id === id)),
    candidateCount: candidates.length,
    candidates: candidates.map(observed),
    currentCount: current.length,
    currentIds: current.map((message) => message.id),
    exactCardinality: current.length === chatBoundary.messageCount + 1 && candidates.length === 1 && current.at(-1)?.id === candidates[0]?.id,
  });`);
}

export function buildMarkChatAsGmAction({
  boundary,
  expectedPlayerId,
  gmUserId,
  lease,
  messageId,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "gm", expectedUserId: gmUserId, lease })}
  ${chatBoundaryAssertion(boundary)}
  const exact = game.messages.contents.filter((message) => message.id === ${json(messageId)});
  if (exact.length !== 1) throw new Error("Exact synthetic roll ChatMessage is missing or duplicated.");
  const message = exact[0];
  const priorIds = new Set(chatBoundary.messageIds);
  if (priorIds.has(message.id) || chatBoundary.messageIds.some((id) => !game.messages.contents.some((entry) => entry.id === id)) || game.messages.contents.length !== chatBoundary.messageCount + 1 || game.messages.contents.at(-1)?.id !== message.id) {
    throw new Error("Exact synthetic roll ChatMessage is outside the captured roll order boundary.");
  }
  assertPublicPlayerRoll(message, ${json(expectedPlayerId)});
  if (message.isOwner !== true || (typeof message.canUserModify === "function" && !message.canUserModify(game.user, "update"))) {
    throw new Error("GM session cannot lawfully mark the exact synthetic roll ChatMessage.");
  }
  const existingMarker = message.getFlag(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)});
  if (existingMarker?.runId === expectedLease.runId && existingMarker?.leaseNonce === expectedLease.leaseNonce) {
    return JSON.stringify({ alreadyMarked: true, authorMatches: true, blind: false, messageId: message.id, public: true, timestamp: message.timestamp, whisperCount: 0 });
  }
  if (existingMarker != null) throw new Error("Synthetic roll ChatMessage already carries a different acceptance marker.");
  await message.setFlag(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)}, { leaseNonce: expectedLease.leaseNonce, runId: expectedLease.runId });
  const appliedMarker = message.getFlag(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)});
  if (appliedMarker?.runId !== expectedLease.runId || appliedMarker?.leaseNonce !== expectedLease.leaseNonce) {
    throw new Error("Synthetic roll ChatMessage marker application did not persist.");
  }
  return JSON.stringify({ alreadyMarked: false, authorMatches: true, blind: false, messageId: message.id, public: true, timestamp: message.timestamp, whisperCount: 0 });`);
}

export function buildVerifyChatAction({ expectedUserId, lease, messageId }) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  const exact = game.messages.contents.filter((message) => message.id === ${json(messageId)});
  if (exact.length !== 1) throw new Error("Exact synthetic roll ChatMessage is missing or duplicated after marking.");
  const message = exact[0];
  const authorId = typeof message.author === "string" ? message.author : message.author?.id ?? (typeof message.user === "string" ? message.user : message.user?.id);
  const marker = message.getFlag(${json(FLAG_SCOPE)}, ${json(FLAG_KEY)});
  if (authorId !== ${json(expectedUserId)}) throw new Error("Synthetic roll ChatMessage author mismatch after marking.");
  if (!Array.isArray(message.whisper) || message.whisper.length > 0 || message.blind === true) throw new Error("Synthetic roll ChatMessage is not public after marking.");
  if (marker?.runId !== expectedLease.runId || marker?.leaseNonce !== expectedLease.leaseNonce) throw new Error("Synthetic roll ChatMessage marker mismatch.");
  return JSON.stringify({ authorMatches: true, blind: false, messageId: message.id, public: true, whisperCount: 0 });`);
}

export function buildCleanupAction({ gmUserId, lease }) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "gm", expectedUserId: gmUserId, lease })}
  ${leaseMatcher()}
  const matches = leaseMatches;
  for (const message of game.messages.contents.filter(matches)) await message.delete();
  for (const scene of game.scenes.contents.filter(matches)) await scene.delete();
  for (const actor of game.actors.contents.filter(matches)) await actor.delete();
  for (const item of game.items.contents.filter(matches)) await item.delete();
  for (const player of game.users.contents.filter(matches)) await player.delete();
  const leftovers = [
    ...game.actors.contents.filter(matches),
    ...game.actors.contents.flatMap((actor) => actor.items?.contents ?? []).filter(matches),
    ...game.items.contents.filter(matches),
    ...game.messages.contents.filter(matches),
    ...game.scenes.contents.filter(matches),
    ...game.scenes.contents.flatMap((scene) => scene.tokens?.contents ?? []).filter(matches),
    ...game.users.contents.filter(matches),
  ];
  if (leftovers.length > 0) throw new Error("Acceptance fixture cleanup left marked documents behind.");
  return JSON.stringify({ leftovers: 0 });`);
}
