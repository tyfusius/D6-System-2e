import type {
  D6CharacterTemplateApplicationV1,
  D6CharacterTemplatePreviewV1,
  ItemSource,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  applyCharacterTemplate,
  previewCharacterTemplate,
} from "./character-template-service";

export type D6ActorItemDropAction = "embed-equipment" | "apply-template";

export type D6ActorItemDropIssue =
  | "actor-type"
  | "drop-data"
  | "item-type"
  | "owner-required"
  | "same-actor"
  | "template-reference";

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

const EQUIPMENT_BY_ACTOR_TYPE: Readonly<Record<string, ReadonlySet<string>>> =
  Object.freeze({
    character: new Set(["armor", "gear", "weapon"]),
    creature: new Set(["armor", "gear", "weapon"]),
    npc: new Set(["armor", "gear", "weapon"]),
    starship: new Set(["armor", "starship-gear", "starship-weapon"]),
    vehicle: new Set(["armor", "vehicle-gear", "vehicle-weapon"]),
  });

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

function templateId(item: FoundryItemDocument): string {
  const stored = (
    item as FoundryItemDocument & {
      getFlag?(namespace: string, key: string): unknown;
    }
  ).getFlag?.(SYSTEM_ID, "characterTemplate") as
    { templateId?: unknown } | undefined;
  if (typeof stored?.templateId === "string") return stored.templateId;
  const source = item.toObject();
  const flags = source.flags as
    Record<string, Record<string, { templateId?: unknown }>> | undefined;
  const fallback = flags?.[SYSTEM_ID]?.characterTemplate?.templateId;
  return typeof fallback === "string" ? fallback : "";
}

function equipmentSource(item: FoundryItemDocument): ItemSource {
  const source = structuredClone(item.toObject());
  delete source._id;
  delete source.folder;
  delete source.ownership;
  delete source.sort;
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
    item?.type === "character-template" ? "apply-template" : "embed-equipment";
  const base = {
    action,
    itemLabel: item?.name ?? "",
    itemType: item?.type ?? "",
  } as const;
  if (!actor || !item)
    return Object.freeze({ ...base, canApply: false, issue: "drop-data" });
  if (actor.isOwner !== true && game.user?.isGM !== true) {
    return Object.freeze({ ...base, canApply: false, issue: "owner-required" });
  }
  if (item.parent?.id === actor.id) {
    return Object.freeze({ ...base, canApply: false, issue: "same-actor" });
  }
  if (item.type === "character-template") {
    if (actor.type !== "character") {
      return Object.freeze({ ...base, canApply: false, issue: "actor-type" });
    }
    const id = templateId(item);
    if (!id) {
      return Object.freeze({
        ...base,
        canApply: false,
        issue: "template-reference",
      });
    }
    const templatePreview = previewCharacterTemplate(actor, id);
    return Object.freeze({
      ...base,
      canApply: templatePreview.canApply,
      templateId: id,
      templatePreview,
    });
  }
  const allowed = EQUIPMENT_BY_ACTOR_TYPE[actor.type];
  if (!allowed) {
    return Object.freeze({ ...base, canApply: false, issue: "actor-type" });
  }
  if (!allowed.has(item.type)) {
    return Object.freeze({ ...base, canApply: false, issue: "item-type" });
  }
  return Object.freeze({ ...base, canApply: true });
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
  const created = await actor.createEmbeddedDocuments("Item", [
    equipmentSource(item),
  ]);
  const itemId = created[0]?.id;
  if (!itemId) throw new Error("D6E2.Drop.ItemCreationFailed");
  return Object.freeze({
    action: preview.action,
    createdItemIds: Object.freeze([itemId]),
  });
}
