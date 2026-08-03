import type {
  D6CharacterTemplateApplicationV1,
  D6CharacterTemplatePreviewV1,
  ItemSource,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import { currentRulesProfile } from "../settings/rules-compatibility";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { acquireSpecialization } from "./advancement-service";
import { createCreationSpecialization } from "./character-creation-service";
import {
  applyCharacterTemplate,
  previewCharacterTemplate,
} from "./character-template-service";
import {
  withAuthorizedDropUpdate,
  withAuthorizedTemplateUpdate,
} from "./mechanical-edit-guard";

export type D6ActorItemDropAction =
  "apply-group" | "apply-species" | "apply-template" | "embed-item";

export type D6ActorItemDropIssue =
  | "actor-type"
  | "drop-data"
  | "duplicate"
  | "item-type"
  | "member-reference"
  | "module-inactive"
  | "owner-required"
  | "rules-family"
  | "same-actor"
  | "species-bounds"
  | "template-reference"
  | "workflow-required";

export interface D6ActorItemDropPlan {
  readonly action: D6ActorItemDropAction;
  readonly canApply: boolean;
  readonly issue?: D6ActorItemDropIssue;
  readonly itemLabel: string;
  readonly itemType: string;
  readonly templateId?: string;
  readonly templatePreview?: D6CharacterTemplatePreviewV1;
}

export interface D6ActorItemDropApplication {
  readonly action: D6ActorItemDropAction;
  readonly createdItemIds: readonly string[];
  readonly template?: D6CharacterTemplateApplicationV1;
}

const NON_TRANSFERABLE_TYPES = new Set([
  "character-template",
  "flaw",
  "item-group",
  "perk",
  "skill",
  "specialization",
  "species-template",
  "talent",
]);

const PERSONAL_TYPES = new Set([
  "advantage",
  "armor",
  "asset",
  "cybernetic",
  "disadvantage",
  "flaw",
  "gear",
  "manifestation",
  "perk",
  "skill",
  "specialability",
  "specialization",
  "talent",
  "trouble",
  "weapon",
]);

const MACHINE_TYPES: Readonly<Record<string, ReadonlySet<string>>> =
  Object.freeze({
    starship: new Set(["armor", "starship-gear", "starship-weapon"]),
    vehicle: new Set(["armor", "vehicle-gear", "vehicle-weapon"]),
  });

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function actorDocument(value: unknown): FoundryActorDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const actor = value as Partial<FoundryActorDocument>;
  return typeof actor.type === "string" && actor.items && actor.system
    ? (value as FoundryActorDocument)
    : null;
}

function itemDocument(value: unknown): FoundryItemDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Partial<FoundryItemDocument>;
  return typeof item.type === "string" && typeof item.name === "string"
    ? (value as FoundryItemDocument)
    : null;
}

function itemFlag(
  item: FoundryItemDocument,
  key: string,
): Record<string, unknown> {
  const direct = item.getFlag?.(SYSTEM_ID, key);
  if (Object.keys(record(direct)).length > 0) return record(direct);
  return record(record(record(item.toObject().flags)[SYSTEM_ID])[key]);
}

function templateId(item: FoundryItemDocument): string {
  const value = itemFlag(item, "characterTemplate").templateId;
  return typeof value === "string" ? value : "";
}

function currentRulesFamily():
  "d6-system-second-edition" | "open-d6-first-edition" {
  return currentRulesProfile().compatibility.firstEditionAttributes
    ? "open-d6-first-edition"
    : "d6-system-second-edition";
}

function rulesFamily(item: FoundryItemDocument): string {
  const value = item.system.rulesFamily;
  return typeof value === "string" ? value : "both";
}

function supportsCurrentRules(item: FoundryItemDocument): boolean {
  const family = rulesFamily(item);
  return family === "both" || family === currentRulesFamily();
}

function duplicateKey(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
): boolean {
  if (!["skill", "specialization"].includes(item.type)) return false;
  const key = typeof item.system.key === "string" ? item.system.key.trim() : "";
  return (
    key.length > 0 &&
    actor.items.contents.some(
      (candidate) =>
        candidate.type === item.type &&
        typeof candidate.system.key === "string" &&
        candidate.system.key === key,
    )
  );
}

function moduleIssue(
  item: FoundryItemDocument,
): D6ActorItemDropIssue | undefined {
  const capabilities = currentEditionCapabilityProfile();
  if (
    ["flaw", "perk", "talent"].includes(item.type) &&
    capabilities.rankedFeatures.state !== "active"
  ) {
    return "module-inactive";
  }
  if (
    ["asset", "trouble"].includes(item.type) &&
    capabilities.narrativeFeatures.state !== "active"
  ) {
    return "module-inactive";
  }
  if (
    item.type === "skill" &&
    item.system.training === "advanced" &&
    capabilities.advancedSkills.state !== "active"
  ) {
    return "module-inactive";
  }
  const firstEdition =
    currentRulesProfile().compatibility.firstEditionAttributes;
  const campaign = currentSecondEditionCampaignProfile();
  if (
    !firstEdition &&
    item.type === "skill" &&
    item.system.training === "psionic" &&
    !campaign.psionics
  ) {
    return "module-inactive";
  }
  if (
    !firstEdition &&
    item.type === "manifestation" &&
    !campaign.freeformSkillBasedMagic
  ) {
    return "module-inactive";
  }
  if (!firstEdition && item.type === "cybernetic" && !campaign.cyberpunk) {
    return "module-inactive";
  }
  return undefined;
}

function sourceForActor(
  item: FoundryItemDocument,
  actor: FoundryActorDocument,
): ItemSource {
  const source = structuredClone(item.toObject());
  delete source._id;
  delete source.folder;
  delete source.ownership;
  delete source.sort;
  const system = record(source.system);
  if (item.type === "skill") system.score = 0;
  if (item.type === "specialization") {
    const parentKey =
      typeof system.parentSkillKey === "string" ? system.parentSkillKey : "";
    const parent = actor.items.contents.find(
      (candidate) =>
        candidate.type === "skill" && candidate.system.key === parentKey,
    );
    system.parentSkillId = parent?.id ?? "";
    system.score = 0;
  }
  if (item.type === "cybernetic") {
    system.installed = false;
    system.linkedTalentId = "";
    system.installation = {
      ...record(system.installation),
      installerName: "",
      previousCount: 0,
    };
    system.disabled = { combatId: "", untilRound: 0, untilTurn: 0 };
  }
  source.system = system;
  return source;
}

export function actorItemDropData(
  event: DragEvent,
): Record<string, unknown> | null {
  const json = event.dataTransfer?.getData("application/json") ?? "";
  const plain = event.dataTransfer?.getData("text/plain") ?? "";
  const serialized = json.length > 0 ? json : plain;
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function itemFromDropData(
  data: Record<string, unknown>,
): Promise<FoundryItemDocument | null> {
  if (data.type !== "Item") return null;
  try {
    return itemDocument(await Item.implementation.fromDropData(data));
  } catch {
    return null;
  }
}

export function previewActorItemDrop(
  actorValue: unknown,
  itemValue: unknown,
): D6ActorItemDropPlan {
  const actor = actorDocument(actorValue);
  const item = itemDocument(itemValue);
  const action: D6ActorItemDropAction =
    item?.type === "character-template"
      ? "apply-template"
      : item?.type === "species-template"
        ? "apply-species"
        : item?.type === "item-group"
          ? "apply-group"
          : "embed-item";
  const base = {
    action,
    itemLabel: item?.name ?? "",
    itemType: item?.type ?? "",
  } as const;
  if (!actor || !item)
    return Object.freeze({ ...base, canApply: false, issue: "drop-data" });
  if (actor.isOwner !== true && game.user?.isGM !== true)
    return Object.freeze({ ...base, canApply: false, issue: "owner-required" });
  if (item.parent?.id === actor.id)
    return Object.freeze({ ...base, canApply: false, issue: "same-actor" });
  if (!supportsCurrentRules(item))
    return Object.freeze({ ...base, canApply: false, issue: "rules-family" });
  if (item.type === "character-template") {
    if (actor.type !== "character")
      return Object.freeze({ ...base, canApply: false, issue: "actor-type" });
    const id = templateId(item);
    if (!id)
      return Object.freeze({
        ...base,
        canApply: false,
        issue: "template-reference",
      });
    const templatePreview = previewCharacterTemplate(actor, id);
    return Object.freeze({
      ...base,
      canApply: templatePreview.canApply,
      templateId: id,
      templatePreview,
    });
  }
  if (item.type === "species-template") {
    if (!["character", "npc"].includes(actor.type))
      return Object.freeze({ ...base, canApply: false, issue: "actor-type" });
    if (
      actor.items.contents.some(
        (candidate) => candidate.type === "species-template",
      )
    ) {
      return Object.freeze({ ...base, canApply: false, issue: "duplicate" });
    }
    return Object.freeze({ ...base, canApply: true });
  }
  if (item.type === "item-group") {
    const actorTypes = Array.isArray(item.system.actorTypes)
      ? item.system.actorTypes
      : [];
    if (actorTypes.length > 0 && !actorTypes.includes(actor.type)) {
      return Object.freeze({ ...base, canApply: false, issue: "actor-type" });
    }
    return Object.freeze({ ...base, canApply: true });
  }
  const machineTypes = MACHINE_TYPES[actor.type];
  if (machineTypes)
    return Object.freeze({
      ...base,
      canApply: machineTypes.has(item.type),
      ...(machineTypes.has(item.type) ? {} : { issue: "item-type" as const }),
    });
  if (!["character", "creature", "npc"].includes(actor.type))
    return Object.freeze({ ...base, canApply: false, issue: "actor-type" });
  if (!PERSONAL_TYPES.has(item.type))
    return Object.freeze({ ...base, canApply: false, issue: "item-type" });
  if (duplicateKey(actor, item))
    return Object.freeze({ ...base, canApply: false, issue: "duplicate" });
  if (
    ["flaw", "perk", "talent"].includes(item.type) &&
    record(actor.system.creation).active !== true &&
    !(
      game.user?.isGM === true &&
      record(actor.system.sheetMode).value === "freeedit"
    )
  ) {
    return Object.freeze({
      ...base,
      canApply: false,
      issue: "workflow-required",
    });
  }
  if (item.type === "specialization") {
    const parentKey =
      typeof item.system.parentSkillKey === "string"
        ? item.system.parentSkillKey
        : "";
    if (
      !actor.items.contents.some(
        (candidate) =>
          candidate.type === "skill" && candidate.system.key === parentKey,
      )
    ) {
      return Object.freeze({
        ...base,
        canApply: false,
        issue: "member-reference",
      });
    }
    if (
      !currentRulesProfile().compatibility.firstEditionAttributes &&
      record(actor.system.creation).active !== true &&
      record(actor.system.sheetMode).value !== "advance"
    ) {
      return Object.freeze({
        ...base,
        canApply: false,
        issue: "workflow-required",
      });
    }
  }
  const issue = moduleIssue(item);
  return Object.freeze({
    ...base,
    canApply: issue === undefined,
    ...(issue ? { issue } : {}),
  });
}

async function members(
  item: FoundryItemDocument,
): Promise<readonly FoundryItemDocument[]> {
  const entries = Array.isArray(item.system.members) ? item.system.members : [];
  const resolved: FoundryItemDocument[] = [];
  for (const raw of entries) {
    const entry = record(raw);
    const uuid = typeof entry.uuid === "string" ? entry.uuid.trim() : "";
    if (!uuid) {
      if (entry.required !== false)
        throw new Error("D6E2.Drop.Issue.member-reference");
      continue;
    }
    const document = itemDocument(await fromUuid(uuid));
    if (!document) {
      if (entry.required !== false)
        throw new Error("D6E2.Drop.Issue.member-reference");
      continue;
    }
    if (
      ["character-template", "item-group", "species-template"].includes(
        document.type,
      )
    ) {
      throw new Error("D6E2.Drop.Issue.item-type");
    }
    resolved.push(document);
  }
  return Object.freeze(resolved);
}

async function createSources(
  actor: FoundryActorDocument,
  sources: readonly ItemSource[],
): Promise<readonly string[]> {
  const created = await withAuthorizedDropUpdate(actor, () =>
    actor.createEmbeddedDocuments("Item", sources),
  );
  const ids = created.map((document) => document.id).filter(Boolean);
  if (ids.length !== sources.length) {
    if (ids.length > 0) await actor.deleteEmbeddedDocuments("Item", ids);
    throw new Error("D6E2.Drop.ItemCreationFailed");
  }
  return Object.freeze(ids);
}

async function applyComposite(
  actor: FoundryActorDocument,
  container: FoundryItemDocument,
  includeContainer: boolean,
): Promise<readonly string[]> {
  const resolved = await members(container);
  const uniqueMembers = new Set<string>();
  for (const member of resolved) {
    if (["flaw", "perk", "specialization", "talent"].includes(member.type)) {
      throw new Error("D6E2.Drop.Issue.item-type");
    }
    const uniqueKey = `${member.type}:${typeof member.system.key === "string" ? member.system.key : (member.uuid ?? member.id)}`;
    if (uniqueMembers.has(uniqueKey)) {
      throw new Error("D6E2.Drop.Issue.member-reference");
    }
    uniqueMembers.add(uniqueKey);
    const preview = previewActorItemDrop(actor, member);
    if (!preview.canApply)
      throw new Error(`D6E2.Drop.Issue.${preview.issue ?? "drop-data"}`);
  }
  const sources: ItemSource[] = resolved.map((member) =>
    sourceForActor(member, actor),
  );
  if (includeContainer) sources.unshift(sourceForActor(container, actor));
  return createSources(actor, sources);
}

async function applySpecies(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
): Promise<readonly string[]> {
  const bounds = Array.isArray(item.system.attributeBounds)
    ? item.system.attributeBounds
    : [];
  const changes: Record<string, unknown> = {};
  for (const raw of bounds) {
    const bound = record(raw);
    const attributeId =
      typeof bound.attributeId === "string" ? bound.attributeId : "";
    const minimum = Number(bound.minimum);
    const maximum = Number(bound.maximum);
    const attribute = record(record(actor.system.attributes)[attributeId]);
    if (
      !attributeId ||
      !Number.isSafeInteger(minimum) ||
      !Number.isSafeInteger(maximum) ||
      minimum < 0 ||
      maximum < minimum ||
      maximum > 60 ||
      !Object.hasOwn(attribute, "score")
    ) {
      throw new Error("D6E2.Drop.Issue.species-bounds");
    }
    const current = Number(attribute.score);
    changes[`system.attributes.${attributeId}.score`] = Math.max(
      minimum,
      Math.min(maximum, Number.isFinite(current) ? current : minimum),
    );
  }
  const ids = await applyComposite(actor, item, true);
  try {
    if (Object.keys(changes).length > 0) {
      await withAuthorizedTemplateUpdate(actor, () => actor.update(changes));
    }
  } catch (error) {
    await actor.deleteEmbeddedDocuments("Item", ids);
    throw error;
  }
  return ids;
}

export async function applyActorItemDrop(
  actorValue: unknown,
  itemValue: unknown,
): Promise<D6ActorItemDropApplication> {
  const actor = actorDocument(actorValue);
  const item = itemDocument(itemValue);
  if (!actor || !item) throw new Error("D6E2.Drop.Issue.drop-data");
  const preview = previewActorItemDrop(actor, item);
  if (!preview.canApply) {
    const templateIssue = preview.templatePreview?.issues[0];
    throw new Error(
      templateIssue
        ? `D6E2.Template.Issue.${templateIssue}`
        : `D6E2.Drop.Issue.${preview.issue ?? "drop-data"}`,
    );
  }
  if (preview.action === "apply-template") {
    const template = await applyCharacterTemplate(
      actor,
      preview.templateId ?? "",
    );
    return Object.freeze({
      action: preview.action,
      createdItemIds: template.createdItemIds,
      template,
    });
  }
  if (
    preview.action === "embed-item" &&
    item.type === "specialization" &&
    !currentRulesProfile().compatibility.firstEditionAttributes
  ) {
    const parentKey =
      typeof item.system.parentSkillKey === "string"
        ? item.system.parentSkillKey
        : "";
    const parent = actor.items.contents.find(
      (candidate) =>
        candidate.type === "skill" && candidate.system.key === parentKey,
    );
    if (!parent) throw new Error("D6E2.Drop.Issue.member-reference");
    let created: FoundryItemDocument | undefined;
    if (record(actor.system.creation).active === true) {
      created = await createCreationSpecialization(actor, parent.id, item.name);
    } else {
      const before = new Set(
        actor.items.contents.map((candidate) => candidate.id),
      );
      await acquireSpecialization(actor, parent.id, item.name);
      created = actor.items.contents.find(
        (candidate) =>
          candidate.type === "specialization" && !before.has(candidate.id),
      );
    }
    if (!created) throw new Error("D6E2.Drop.ItemCreationFailed");
    return Object.freeze({
      action: preview.action,
      createdItemIds: Object.freeze([created.id]),
    });
  }
  const createdItemIds =
    preview.action === "apply-group"
      ? await applyComposite(actor, item, false)
      : preview.action === "apply-species"
        ? await applySpecies(actor, item)
        : await createSources(actor, [sourceForActor(item, actor)]);
  return Object.freeze({ action: preview.action, createdItemIds });
}

export function canTransferActorItem(
  actorValue: unknown,
  itemValue: unknown,
): D6ActorItemDropPlan {
  const actor = actorDocument(actorValue);
  const item = itemDocument(itemValue);
  const preview = previewActorItemDrop(actor, item);
  const sourceActor = actorDocument(item?.parent);
  if (!actor || !item || !sourceActor || sourceActor.id === actor.id)
    return preview;
  if (sourceActor.isOwner !== true && game.user?.isGM !== true) {
    return Object.freeze({
      ...preview,
      canApply: false,
      issue: "owner-required",
    });
  }
  if (
    NON_TRANSFERABLE_TYPES.has(item.type) ||
    (item.type === "cybernetic" && item.system.installed === true)
  ) {
    return Object.freeze({ ...preview, canApply: false, issue: "item-type" });
  }
  return preview;
}

export async function transferActorItem(
  actorValue: unknown,
  itemValue: unknown,
): Promise<D6ActorItemDropApplication> {
  const actor = actorDocument(actorValue);
  const item = itemDocument(itemValue);
  const sourceActor = actorDocument(item?.parent);
  if (!actor || !item || !sourceActor)
    throw new Error("D6E2.Drop.Issue.drop-data");
  const preview = canTransferActorItem(actor, item);
  if (!preview.canApply)
    throw new Error(`D6E2.Drop.Issue.${preview.issue ?? "drop-data"}`);
  const applied = await applyActorItemDrop(actor, item);
  try {
    await sourceActor.deleteEmbeddedDocuments("Item", [item.id]);
  } catch (error) {
    if (applied.createdItemIds.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", applied.createdItemIds);
    }
    throw error;
  }
  return applied;
}

function escaped(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

export async function confirmActorItemTransfer(
  item: FoundryItemDocument,
  target: FoundryActorDocument,
): Promise<boolean> {
  const sourceActor = actorDocument(item.parent);
  const result = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "cancel",
        callback: () => false,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "transfer",
        callback: () => true,
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-arrow-right-arrow-left",
        label: game.i18n.localize("D6E2.Drop.Transfer"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<div class="od6-dialog-shell"><p>${escaped(
      game.i18n.format("D6E2.Drop.TransferConfirm", {
        item: item.name,
        source: sourceActor?.name ?? "",
        target: target.name,
      }),
    )}</p></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-arrow-right-arrow-left",
      title: game.i18n.localize("D6E2.Drop.Transfer"),
    },
  });
  return result === true;
}

export async function sortActorItem(
  actorValue: unknown,
  sourceItemValue: unknown,
  targetItemValue: unknown,
  siblingItemValues: readonly unknown[],
): Promise<boolean> {
  const actor = actorDocument(actorValue);
  const source = itemDocument(sourceItemValue);
  const target = itemDocument(targetItemValue);
  const siblings = siblingItemValues.flatMap((value) => {
    const item = itemDocument(value);
    return item && item.id !== source?.id ? [item] : [];
  });
  if (!actor || !source || !target || source.id === target.id) return false;
  if (
    source.parent?.id !== actor.id ||
    target.parent?.id !== actor.id ||
    source.type !== target.type
  ) {
    return false;
  }
  const updates = SortingHelpers.performIntegerSort(source, {
    siblings,
    target,
  }).map(({ target: document, update }) => ({ ...update, _id: document.id }));
  if (updates.length === 0) return false;
  await actor.updateEmbeddedDocuments("Item", updates);
  return true;
}
