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

export function buildSecureGmPasswordAction({ gmUserId, lease }) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "gm", expectedUserId: gmUserId, lease })}
  let generatedPassword = globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();
  const updated = await game.user.update({ password: generatedPassword });
  generatedPassword = "";
  if (updated?.id !== ${json(gmUserId)} || updated?.isGM !== true) {
    throw new Error("Disposable GM password update returned the wrong user.");
  }
  return JSON.stringify({ passwordAssigned: true, role: "gm", userMatches: true });`);
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
  const validateActorUpdate = async (stage, actorDocument, changes) => {
    const result = await runStage(stage, () => actorDocument.update(changes));
    if (result && result.id !== actorDocument.id) {
      failStage(stage, "wrong-update-result", { actorIdMatches: false });
    }
    const persisted = game.actors.get?.(actorDocument.id)
      ?? game.actors.contents.find((candidate) => candidate.id === actorDocument.id);
    return validateDocument(stage, persisted, {
      documentName: "Actor",
      type: "character",
    });
  };
  let player = game.users.find((user) => user.name === ${json(playerName)});
  if (!player) {
    player = validateDocument("player-create", await runStage("player-create", () => User.create({
      flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
      name: ${json(playerName)},
      password: globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID(),
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
  actor = await validateActorUpdate("actor-creation-close", actor, {
    "system.creation.active": false,
  });
  actor = await validateActorUpdate("actor-authoring-open", actor, {
    "system.sheetMode.value": "freeedit",
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
  actor = await validateActorUpdate("actor-authoring-close", actor, { "system.sheetMode.value": "normal" });
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
  const targetActor = validateDocument("target-actor-create", await runStage("target-actor-create", () => Actor.create({
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    name: "Synthetic Acceptance Target",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    system: {
      attributes: {
        agility: { score: 6 },
        brawn: { score: 6 },
        knowledge: { score: 6 },
        perception: { score: 6 },
      },
    },
    type: "npc",
  })), { documentName: "Actor", type: "npc" });
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
    width: 3200,
  })), { documentName: "Scene" });
  const token = validateCreatedArray("token-create", await runStage("token-create", () => scene.createEmbeddedDocuments("Token", [{
    actorId: actor.id,
    actorLink: true,
    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    name: actor.name,
    sight: { enabled: true, range: 60 },
    x: 400,
    y: 400,
  }])), { documentName: "Token", parentId: scene.id });
  const targetToken = validateCreatedArray("target-token-create", await runStage("target-token-create", () => scene.createEmbeddedDocuments("Token", [{
    actorId: targetActor.id,
    actorLink: true,
    disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
    flags: { ${json(FLAG_SCOPE)}: { ${json(FLAG_KEY)}: marker } },
    name: targetActor.name,
    sight: { enabled: true },
    x: 2400,
    y: 400,
  }])), { documentName: "Token", parentId: scene.id });
  const activatedScene = validateDocument("scene-activate", await runStage("scene-activate", () => scene.activate()), { documentName: "Scene" });
  if (activatedScene.id !== scene.id || game.scenes.active?.id !== scene.id) {
    failStage("scene-activate", "scene-did-not-become-active", { activeSceneMatches: game.scenes.active?.id === scene.id });
  }
  return JSON.stringify({ actorId: actor.id, playerId: player.id, sceneId: scene.id, skillId: skill.id, stages, targetActorId: targetActor.id, targetTokenId: targetToken.id, tokenId: token.id, weaponId: weapon.id, worldItemId: worldItem.id });`);
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

export function buildSeedFeatureAcceptanceAction({ actorId, gmUserId, lease }) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "gm", expectedUserId: gmUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("GM cannot seed the synthetic Actor.");
  await game.settings.set(${json("d6-system-2e")}, ${json("secondEditionAdvancementStrategy")}, ${json("experience-points")});
  await actor.update({
    "system.resources.characterPoints.value": 30,
    "system.resources.experiencePoints.value": 30,
    "system.sheetMode.value": "normal",
  });
  return JSON.stringify({
    characterPoints: Number(actor.system?.resources?.characterPoints?.value ?? 0),
    experiencePoints: Number(actor.system?.resources?.experiencePoints?.value ?? 0),
    mode: actor.system?.sheetMode?.value ?? null,
  });`);
}

export function buildSetCharacterSheetModeAction({
  actorId,
  expectedCurrentMode,
  expectedRole,
  expectedUserId,
  lease,
  mode,
}) {
  const expectedCurrentModeLiteral =
    expectedCurrentMode === undefined ? "undefined" : json(expectedCurrentMode);
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole, expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Current user does not own the synthetic Actor.");
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  await actor.sheet.render(true);
  const findSelect = () => actor.sheet.element?.querySelector?.('select[name="system.sheetMode.value"]');
  if (${expectedCurrentModeLiteral} !== undefined) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (actor.system?.sheetMode?.value === ${expectedCurrentModeLiteral}) break;
      await sleep(50);
    }
    if (actor.system?.sheetMode?.value !== ${expectedCurrentModeLiteral}) {
      throw new Error("Character sheet did not receive the expected prior mode.");
    }
  }
  let select;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    select = findSelect();
    if (actor.sheet.rendered && select instanceof HTMLSelectElement) break;
    await sleep(50);
  }
  if (!(select instanceof HTMLSelectElement)) throw new Error("Character sheet mode control is missing.");
  const allowed = [...select.options].map((option) => option.value);
  if (!allowed.includes(${json(mode)})) throw new Error("Requested character sheet mode is unavailable to this role.");
  let changeEventObserved = false;
  const changeObserver = (event) => {
    if (event.target === select) changeEventObserved = true;
  };
  actor.sheet.element.addEventListener("change", changeObserver, { capture: true });
  let updateObserved = false;
  let postUpdateObserved = false;
  const updateHook = Hooks.on("preUpdateActor", (document, changes, _options, userId) => {
    if (document?.id === actor.id && userId === game.user.id) {
      updateObserved = Object.hasOwn(changes ?? {}, "system.sheetMode.value")
        || Object.hasOwn(changes?.system?.sheetMode ?? {}, "value");
    }
  });
  const postUpdateHook = Hooks.on("updateActor", (document, changes, _options, userId) => {
    const nextMode = changes?.["system.sheetMode.value"] ?? changes?.system?.sheetMode?.value;
    if (document?.id === actor.id && userId === game.user.id && nextMode === ${json(mode)}) {
      postUpdateObserved = true;
    }
  });
  select.value = ${json(mode)};
  select.dispatchEvent(new Event("change", { bubbles: true }));
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(50);
    select = findSelect();
    if (postUpdateObserved && actor.system?.sheetMode?.value === ${json(mode)} && select?.value === ${json(mode)}) break;
  }
  Hooks.off("preUpdateActor", updateHook);
  Hooks.off("updateActor", postUpdateHook);
  actor.sheet.element.removeEventListener("change", changeObserver, true);
  if (actor.system?.sheetMode?.value !== ${json(mode)} || select?.value !== ${json(mode)}) {
    throw new Error("Character sheet mode did not persist and rerender: " + JSON.stringify({
      requested: ${json(mode)},
      selected: select?.value ?? null,
      selectDisabled: select?.disabled ?? null,
      sheetEditable: actor.sheet.isEditable === true,
      stored: actor.system?.sheetMode?.value ?? null,
      sourceMode: actor._source?.system?.sheetMode?.value ?? null,
      changeEventObserved,
      updateObserved,
      postUpdateObserved,
    }));
  }
  return JSON.stringify({
    allowed,
    mode: select.value,
    storedMode: actor.system.sheetMode.value,
  });`);
}

export function buildAwaitCharacterSheetModeAction({
  actorId,
  expectedRole,
  expectedUserId,
  lease,
  mode,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole, expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Current user does not own the synthetic Actor.");
  await actor.sheet.render(true);
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  let select;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    select = actor.sheet.element?.querySelector?.('select[name="system.sheetMode.value"]');
    if (actor.system?.sheetMode?.value === ${json(mode)} && select?.value === ${json(mode)}) break;
    await sleep(50);
  }
  if (actor.system?.sheetMode?.value !== ${json(mode)} || select?.value !== ${json(mode)}) {
    throw new Error("Character sheet user interaction did not persist and rerender: " + JSON.stringify({
      requested: ${json(mode)},
      selected: select?.value ?? null,
      stored: actor.system?.sheetMode?.value ?? null,
    }));
  }
  const elementId = actor.sheet.element?.id ?? "";
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(elementId)) throw new Error("Active character sheet has an unsafe or missing application ID.");
  return JSON.stringify({ elementId, mode: select.value, storedMode: actor.system.sheetMode.value });`);
}

export function buildAwaitCharacterResourceAction({
  actorId,
  expectedRole,
  expectedUserId,
  expectedValue,
  lease,
  resourceName,
}) {
  if (
    ![
      "system.resources.characterPoints.value",
      "system.resources.experiencePoints.value",
    ].includes(resourceName)
  ) {
    throw new Error("Unsupported character resource acceptance path.");
  }
  const resourceId = resourceName.includes("experiencePoints")
    ? "experiencePoints"
    : "characterPoints";
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole, expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Current user does not own the synthetic Actor.");
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const readValue = () => Number(actor.system?.resources?.[${json(resourceId)}]?.value ?? 0);
  for (let attempt = 0; attempt < 80 && readValue() !== ${json(expectedValue)}; attempt += 1) {
    await sleep(50);
  }
  return JSON.stringify({
    expectedValue: ${json(expectedValue)},
    received: readValue() === ${json(expectedValue)},
    resourceName: ${json(resourceName)},
    sourceValue: Number(actor._source?.system?.resources?.[${json(resourceId)}]?.value ?? 0),
    value: readValue(),
  });`);
}

export function buildAwaitRuntimeReadyAction({
  expectedRole,
  expectedUserId,
  lease,
}) {
  return expression(`
  for (let attempt = 0; attempt < 100 && !game?.ready; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  ${runtimeAuthorityAssertion({ expectedRole, expectedUserId, lease })}
  return JSON.stringify({ ready: true });`);
}

export function buildSetCharacterSheetModeDocumentAction({
  actorId,
  expectedRole,
  expectedUserId,
  lease,
  mode,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole, expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Current user does not own the synthetic Actor.");
  if (!${json(["normal", "advance"])}.includes(${json(mode)})) throw new Error("Unsafe player sheet mode requested.");
  await actor.update({ "system.sheetMode.value": ${json(mode)} });
  await actor.sheet.render(true);
  const select = actor.sheet.element?.querySelector?.('select[name="system.sheetMode.value"]');
  if (actor.system?.sheetMode?.value !== ${json(mode)} || select?.value !== ${json(mode)}) {
    throw new Error("Lease-bound character sheet mode did not persist and rerender.");
  }
  return JSON.stringify({ mode: select.value, storedMode: actor.system.sheetMode.value });`);
}

export function buildInspectCharacterAdvancementAction({
  actorId,
  expectedRole,
  expectedUserId,
  lease,
  skillId,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole, expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Current user does not own the synthetic Actor.");
  await actor.sheet.render(true);
  const root = actor.sheet.element;
  if (!(root instanceof HTMLElement)) throw new Error("Character sheet root is missing.");
  const mode = root.querySelector('select[name="system.sheetMode.value"]');
  const experience = root.querySelector('input[name="system.resources.experiencePoints.value"]');
  const character = root.querySelector('input[name="system.resources.characterPoints.value"]');
  const advanceButtons = [...root.querySelectorAll('button[data-action="advanceItem"], button[data-action="advanceAttribute"]')];
  const enabledAdvanceButtons = advanceButtons.filter((button) => !button.disabled);
  const skill = actor.items.get(${json(skillId)});
  if (!skill) throw new Error("Synthetic advancement Skill is missing.");
  const resourceInput = experience instanceof HTMLInputElement ? experience : character;
  if (!(mode instanceof HTMLSelectElement) || !(resourceInput instanceof HTMLInputElement)) {
    throw new Error("Character advancement controls are incomplete.");
  }
  if (${json(expectedRole)} === "player" && !resourceInput.disabled) {
    throw new Error("Owning player unexpectedly has direct balance-edit authority.");
  }
  return JSON.stringify({
    advanceButtonCount: advanceButtons.length,
    enabledAdvanceButtonCount: enabledAdvanceButtons.length,
    mode: mode.value,
    modeOptions: [...mode.options].map((option) => option.value),
    resourceDisabled: resourceInput.disabled,
    resourceLabel: resourceInput.closest("label")?.querySelector("span")?.textContent?.trim() ?? "",
    resourceName: resourceInput.name,
    resourceValue: Number(resourceInput.value),
    skillScore: Number(skill.system?.score ?? 0),
  });`);
}

export function buildExerciseGmResourceModePersistenceAction({
  actorId,
  gmUserId,
  lease,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "gm", expectedUserId: gmUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("GM cannot edit the synthetic Actor.");
  await actor.sheet.render(true);
  let root;
  let input;
  let mode;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    root = actor.sheet.element;
    input = root?.querySelector?.('input[name="system.resources.experiencePoints.value"]')
      ?? root?.querySelector?.('input[name="system.resources.characterPoints.value"]');
    mode = root?.querySelector?.('select[name="system.sheetMode.value"]');
    if (input instanceof HTMLInputElement && mode instanceof HTMLSelectElement) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!(input instanceof HTMLInputElement) || !(mode instanceof HTMLSelectElement) || ![...mode.options].some((option) => option.value === "freeedit")) {
    throw new Error("GM resource/mode controls are incomplete: " + JSON.stringify({
      inputNames: root ? [...root.querySelectorAll("input[name]")].map((entry) => entry.getAttribute("name")).filter(Boolean).sort() : [],
      modeFound: mode instanceof HTMLSelectElement,
      rootFound: root instanceof HTMLElement,
      selectNames: root ? [...root.querySelectorAll("select[name]")].map((entry) => entry.getAttribute("name")).filter(Boolean).sort() : [],
    }));
  }
  const path = input.name;
  let modePostUpdateObserved = false;
  let resourcePostUpdateObserved = false;
  const modePostUpdateHook = Hooks.on("updateActor", (document, changes, _options, userId) => {
    const nextMode = changes?.["system.sheetMode.value"] ?? changes?.system?.sheetMode?.value;
    const resourceId = path.includes("experiencePoints") ? "experiencePoints" : "characterPoints";
    const nextResource = changes?.[path] ?? changes?.system?.resources?.[resourceId]?.value;
    if (document?.id === actor.id && userId === game.user.id && nextMode === "freeedit") {
      modePostUpdateObserved = true;
    }
    if (document?.id === actor.id && userId === game.user.id && Number(nextResource) === 37) {
      resourcePostUpdateObserved = true;
    }
  });
  input.value = "37";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  mode.value = "freeedit";
  mode.dispatchEvent(new Event("change", { bubbles: true }));
  const readPath = () => path.includes("experiencePoints")
    ? Number(actor.system?.resources?.experiencePoints?.value ?? 0)
    : Number(actor.system?.resources?.characterPoints?.value ?? 0);
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(50);
    const currentRoot = actor.sheet.element;
    const currentInput = currentRoot?.querySelector?.('input[name="' + path + '"]');
    const currentMode = currentRoot?.querySelector?.('select[name="system.sheetMode.value"]');
    if (modePostUpdateObserved && resourcePostUpdateObserved && readPath() === 37 && actor.system?.sheetMode?.value === "freeedit"
      && currentInput?.value === "37" && currentMode?.value === "freeedit") break;
  }
  Hooks.off("updateActor", modePostUpdateHook);
  const settledRoot = actor.sheet.element;
  const settledInput = settledRoot?.querySelector?.('input[name="' + path + '"]');
  const settledMode = settledRoot?.querySelector?.('select[name="system.sheetMode.value"]');
  if (!modePostUpdateObserved || !resourcePostUpdateObserved || readPath() !== 37 || actor.system?.sheetMode?.value !== "freeedit"
    || settledInput?.value !== "37" || settledMode?.value !== "freeedit") {
    throw new Error("Rapid GM balance edit and mode transition did not persist atomically: " + JSON.stringify({ modePostUpdateObserved, resourcePostUpdateObserved }));
  }
  const resourceId = path.includes("experiencePoints") ? "experiencePoints" : "characterPoints";
  return JSON.stringify({
    mode: actor.system.sheetMode.value,
    resourceName: path,
    resourceValue: readPath(),
    sourceResourceValue: Number(actor._source?.system?.resources?.[resourceId]?.value ?? 0),
  });`);
}

export function buildExercisePlayerAdvancementAction({
  actorId,
  expectedUserId,
  lease,
  skillId,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  const skill = actor?.items.get(${json(skillId)});
  if (!actor?.isOwner || !skill) throw new Error("Owning player advancement fixture is incomplete.");
  await actor.sheet.render(true);
  const button = actor.sheet.element?.querySelector?.('[data-item-id="${skillId}"] button[data-action="advanceItem"]');
  if (!(button instanceof HTMLButtonElement) || button.disabled) {
    throw new Error("Owning player does not have an enabled Skill advancement control.");
  }
  const before = {
    characterPoints: Number(actor.system?.resources?.characterPoints?.value ?? 0),
    experiencePoints: Number(actor.system?.resources?.experiencePoints?.value ?? 0),
    skillScore: Number(skill.system?.score ?? 0),
  };
  button.click();
  let confirm;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    confirm = document.querySelector('.d6e2-advance-dialog button[data-action="advance"]');
    if (confirm) break;
  }
  if (!(confirm instanceof HTMLButtonElement)) throw new Error("Skill advancement confirmation did not open.");
  confirm.click();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (Number(skill.system?.score ?? 0) > before.skillScore) break;
  }
  const after = {
    characterPoints: Number(actor.system?.resources?.characterPoints?.value ?? 0),
    experiencePoints: Number(actor.system?.resources?.experiencePoints?.value ?? 0),
    skillScore: Number(skill.system?.score ?? 0),
  };
  const resourceSpent = after.characterPoints < before.characterPoints || after.experiencePoints < before.experiencePoints;
  if (after.skillScore <= before.skillScore || !resourceSpent) {
    throw new Error("Owning player Skill advancement did not persist its score and resource spend.");
  }
  return JSON.stringify({ after, before, resourceSpent });`);
}

export function buildInspectWeaponTargetDifficultyAction({
  actorId,
  expectedUserId,
  lease,
  targetTokenId,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Owning player cannot inspect the synthetic weapon roll.");
  const dialog = document.querySelector(".d6e2-roll-dialog");
  const select = dialog?.querySelector?.('select[name="targetId"]');
  if (!(dialog instanceof HTMLElement) || !(select instanceof HTMLSelectElement)) {
    const targetToken = canvas.tokens?.placeables?.find?.((token) => token.id === ${json(targetTokenId)});
    throw new Error("Weapon roll target selector is missing: " + JSON.stringify({
      activeSceneMatches: canvas.scene?.id === game.scenes?.active?.id,
      canvasReady: canvas.ready === true,
      dialogFound: dialog instanceof HTMLElement,
      sourceActiveTokenIds: actor.getActiveTokens?.().map((token) => token.id) ?? [],
      targetActorMatches: targetToken?.actor?.id === targetToken?.document?.actorId,
      targetCenterAvailable: Boolean(targetToken?.center),
      targetFound: Boolean(targetToken),
      targetIsPreview: targetToken?.isPreview === true,
      targetType: targetToken?.actor?.type ?? null,
      targetVisible: targetToken?.visible === true,
      tokenCount: canvas.tokens?.placeables?.length ?? 0,
    }));
  }
  const target = [...select.options].find((option) => option.value === ${json(targetTokenId)});
  if (!target) throw new Error("Synthetic target is missing from the weapon target selector.");
  select.value = target.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  const difficulty = dialog.querySelector('input[name="difficulty"]');
  const finalDifficulty = dialog.querySelector("[data-final-difficulty]");
  const range = dialog.querySelector("[data-target-range]");
  const selected = select.selectedOptions[0];
  if (!(difficulty instanceof HTMLInputElement) || !(finalDifficulty instanceof HTMLElement) || !selected) {
    throw new Error("Weapon target difficulty controls are incomplete.");
  }
  const difficultyValue = difficulty.value.trim();
  const finalValue = finalDifficulty.textContent?.trim() ?? "";
  if (!difficultyValue || difficultyValue !== finalValue || difficulty.readOnly !== true) {
    throw new Error("Measured target did not establish the automatic final difficulty.");
  }
  return JSON.stringify({
    difficulty: Number(difficultyValue),
    distance: Number(selected.dataset.distance),
    finalDifficulty: Number(finalValue),
    rangeBand: selected.dataset.rangeBand ?? null,
    rangeText: range?.textContent?.trim() ?? "",
    readOnly: difficulty.readOnly,
    selectedTargetId: select.value,
    targetOption: selected.textContent?.trim() ?? "",
  });`);
}

export function buildSetPortraitPermissionAction({ allowed, gmUserId, lease }) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "gm", expectedUserId: gmUserId, lease })}
  await game.settings.set(${json("d6-system-2e")}, ${json("allowPlayerCharacterPortraitUpdates")}, ${json(allowed)});
  const current = game.settings.get(${json("d6-system-2e")}, ${json("allowPlayerCharacterPortraitUpdates")});
  if (current !== ${json(allowed)}) throw new Error("Player portrait permission setting did not persist.");
  return JSON.stringify({ allowed: current });`);
}

export function buildInspectPortraitPermissionAction({
  actorId,
  allowed,
  expectedUserId,
  lease,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Owning-player portrait fixture is incomplete.");
  await actor.sheet.render(true);
  const edit = actor.sheet.element?.querySelector?.('button[data-action="editImage"]');
  if ((edit instanceof HTMLButtonElement) !== ${json(allowed)}) {
    throw new Error("Player portrait Edit affordance does not match the world permission.");
  }
  const original = actor.img;
  const attempted = original === "icons/svg/angel.svg" ? "icons/svg/mystery-man.svg" : "icons/svg/angel.svg";
  await actor.update({ img: attempted });
  const changed = actor.img === attempted;
  if (changed !== ${json(allowed)}) throw new Error("Player portrait update guard does not match the world permission.");
  if (changed) await actor.update({ img: original });
  return JSON.stringify({ allowed: ${json(allowed)}, changed, editVisible: edit instanceof HTMLButtonElement, restored: actor.img === original });`);
}

export function buildExerciseVisualEffectsAction({
  expectedUserId,
  lease,
  preference,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  await game.settings.set(${json("d6-system-2e")}, ${json("visualEffects")}, ${json(preference)});
  await new Promise((resolve) => setTimeout(resolve, 50));
  const stored = game.settings.get(${json("d6-system-2e")}, ${json("visualEffects")});
  const root = document.documentElement;
  const marked = root.dataset.d6e2VisualEffects;
  const resolved = root.dataset.d6e2VisualEffectsResolved;
  if (stored !== ${json(preference)} || marked !== ${json(preference)} || resolved !== ${json(preference)}) {
    throw new Error("Visual-effects preference did not apply to the client root.");
  }
  return JSON.stringify({ marked, preference: stored, resolved });`);
}

export function buildOpenWeaponRollAction({
  actorId,
  expectedUserId,
  lease,
  weaponId,
}) {
  return expression(`
  ${runtimeAuthorityAssertion({ expectedRole: "player", expectedUserId, lease })}
  const actor = game.actors.get(${json(actorId)});
  if (!actor?.isOwner) throw new Error("Owning player cannot open the synthetic weapon roll.");
  await actor.sheet.render(true);
  const button = actor.sheet.element?.querySelector?.('[data-item-id="${weaponId}"] button[data-action="rollCombatItem"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error("Synthetic weapon attack button is missing.");
  button.click();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (document.querySelector(".d6e2-roll-dialog")) break;
  }
  if (!document.querySelector(".d6e2-roll-dialog")) throw new Error("Synthetic weapon roll dialog did not open.");
  return JSON.stringify({ opened: true, weaponId: ${json(weaponId)} });`);
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
