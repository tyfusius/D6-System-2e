import {
  D6_BESTIARY_CONTRACT_VERSION,
  type ActorSource,
  type D6BestiaryEntryV1,
  type D6BestiaryItemKind,
  type D6ResolvedBestiaryCatalogV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { resolvedBestiaryEntry } from "../registries/bestiary";
import {
  currentTerminology,
  terminologyActorLabel,
  terminologyItemDocumentLabel,
} from "../registries/terminology";
import { currentActiveAttributeDefinitions } from "../settings/attributes";
import {
  currentConfiguredRulesProfile,
  strategyUsesOpenD6,
} from "../settings/rules-profile-library";
import { currentResolvedSettingProfile } from "../settings/setting-profile";
import { foundryRandomId } from "./foundry-random-id";

const WORLD_CATALOG_COLLECTION = "world.d6-creature-catalog";
const CATALOG_FLAG = "creatureCatalog";
const ITEM_TYPES = new Set<D6BestiaryItemKind>([
  "armor",
  "gear",
  "manifestation",
  "specialability",
  "weapon",
]);

export interface BestiaryDocumentAccess {
  readonly documentUuid: string;
  readonly editable: boolean;
  readonly listed: boolean;
  readonly packageLabel: string;
  readonly worldOwned: boolean;
}

interface BestiaryDocumentRecord extends BestiaryDocumentAccess {
  readonly document: FoundryActorDocument;
}

const documents = new Map<string, BestiaryDocumentRecord>();
let worldCatalog: D6ResolvedBestiaryCatalogV1 | null = null;

export function bestiaryCreatureLabel(
  plurality: "plural" | "singular",
): string {
  return terminologyActorLabel(
    currentTerminology(),
    "creature",
    plurality,
    game.i18n.localize(
      plurality === "singular"
        ? "TYPES.Actor.creature"
        : "D6E2.Settings.Terminology.Default.Actor.creature.Plural",
    ),
  );
}

export function worldCreatureCatalogLabel(): string {
  return game.i18n.format("D6E2.Bestiary.WorldCatalogLabel", {
    creatures: bestiaryCreatureLabel("plural"),
  });
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(...values: readonly unknown[]): string {
  return values.map(text).find((value) => value.length > 0) ?? "";
}

function integer(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function positiveInteger(value: unknown): number {
  return Math.max(1, integer(value));
}

function catalogFlag(document: FoundryActorDocument): Record<string, unknown> {
  return record(document.getFlag(SYSTEM_ID, CATALOG_FLAG));
}

function bestiaryData(document: FoundryActorDocument): Record<string, unknown> {
  return record(document.system.bestiary);
}

function worldEntryId(document: FoundryActorDocument): string {
  const configured = text(catalogFlag(document).entryId);
  return configured || `world.${document.id.toLocaleLowerCase()}`;
}

function rulesFamilyForWorldDocument(
  document: FoundryActorDocument,
): "d6-system-second-edition" | "open-d6-first-edition" {
  const configured = text(catalogFlag(document).rulesFamily);
  if (configured === "open-d6-first-edition") return configured;
  return "d6-system-second-edition";
}

function actorEntry(document: FoundryActorDocument): D6BestiaryEntryV1 | null {
  if (document.type !== "creature") return null;
  const source = document.toObject();
  const system = record(source.system);
  const attributes = record(system.attributes);
  const configuredAttributeIds = catalogFlag(document).attributeIds;
  const attributeIds = Array.isArray(configuredAttributeIds)
    ? configuredAttributeIds.filter(
        (value): value is string => typeof value === "string",
      )
    : Object.keys(attributes);
  const attributeScores = Object.fromEntries(
    attributeIds.flatMap((attributeId) => {
      const score = Math.max(0, integer(record(attributes[attributeId]).score));
      return attributeId ? [[attributeId, score]] : [];
    }),
  );
  if (Object.keys(attributeScores).length === 0) return null;
  const skills = source.items.filter((item) => item.type === "skill");
  const skillScores = Object.fromEntries(
    skills.flatMap((item) => {
      const itemSystem = record(item.system);
      const key = text(itemSystem.key);
      const attributeId = text(itemSystem.attributeId);
      if (!key || !Object.hasOwn(attributeScores, attributeId)) return [];
      return [
        [
          key,
          Math.max(
            0,
            integer(attributeScores[attributeId]) + integer(itemSystem.score),
          ),
        ],
      ];
    }),
  );
  const items = source.items.flatMap((item) => {
    if (!ITEM_TYPES.has(item.type as D6BestiaryItemKind)) return [];
    return [
      Object.freeze({
        ...(text(item.img) ? { img: text(item.img) } : {}),
        name:
          text(item.name) ||
          terminologyItemDocumentLabel(
            currentTerminology(),
            item.type,
            "singular",
            game.i18n.localize("D6E2.New.Item"),
          ),
        system: Object.freeze(
          structuredClone(item.system) as Record<string, unknown>,
        ),
        type: item.type as D6BestiaryItemKind,
      }),
    ];
  });
  const defenses = record(system.defenses);
  const magicPoints = record(record(system.resources).magicPoints);
  const bestiary = bestiaryData(document);
  const sourceBook =
    text(catalogFlag(document).sourceBook) ||
    text(bestiary.sourceBook) ||
    worldCreatureCatalogLabel();
  const sourcePage = positiveInteger(
    catalogFlag(document).sourcePage ?? bestiary.sourcePage,
  );
  return Object.freeze({
    attributeScores: Object.freeze(attributeScores),
    biography: text(system.biography),
    defenseOverrides: Object.freeze({
      dodge: Math.max(0, integer(defenses.dodgeOverride)),
      parry: Math.max(0, integer(defenses.parryOverride)),
    }),
    id: worldEntryId(document),
    ...(text(source.img) ? { img: text(source.img) } : {}),
    items: Object.freeze(items),
    label: document.name,
    magicPoints: Math.max(0, integer(magicPoints.value)),
    rulesFamily: rulesFamilyForWorldDocument(document),
    scale: Math.max(0, integer(system.scale)),
    skillScores: Object.freeze(skillScores),
    source: Object.freeze({ book: sourceBook, page: sourcePage }),
    version: D6_BESTIARY_CONTRACT_VERSION,
  });
}

function accessFor(
  pack: FoundryCompendiumCollection,
  document: FoundryActorDocument,
  listed = true,
): BestiaryDocumentRecord {
  const worldOwned = pack.metadata.packageType === "world";
  return Object.freeze({
    document,
    documentUuid:
      document.uuid ?? `Compendium.${pack.collection}.Actor.${document.id}`,
    editable: worldOwned && !pack.locked,
    listed,
    packageLabel: pack.metadata.label ?? pack.collection,
    worldOwned,
  });
}

export async function refreshBestiaryDocuments(): Promise<void> {
  documents.clear();
  const worldEntries: D6BestiaryEntryV1[] = [];
  for (const pack of game.packs?.contents ?? []) {
    if (pack.documentName !== "Actor") continue;
    const packDocuments = await pack.getDocuments();
    for (const document of packDocuments) {
      if (document.type !== "creature") continue;
      const provenanceEntryId = text(bestiaryData(document).entryId);
      if (provenanceEntryId && resolvedBestiaryEntry(provenanceEntryId)) {
        documents.set(provenanceEntryId, accessFor(pack, document));
      }
      if (pack.collection !== WORLD_CATALOG_COLLECTION) continue;
      const entry = actorEntry(document);
      if (!entry) continue;
      worldEntries.push(entry);
      documents.set(
        entry.id,
        accessFor(pack, document, catalogFlag(document).listed !== false),
      );
    }
  }
  worldCatalog = worldEntries.length
    ? Object.freeze({
        entries: Object.freeze(worldEntries),
        id: "world.creature-catalog",
        label: worldCreatureCatalogLabel(),
        ownerId: "world",
        version: D6_BESTIARY_CONTRACT_VERSION,
      })
    : null;
}

export function currentWorldBestiaryCatalog(): D6ResolvedBestiaryCatalogV1 | null {
  return worldCatalog;
}

export function resolvedWorldBestiaryEntry(entryId: string): {
  readonly catalog: D6ResolvedBestiaryCatalogV1;
  readonly entry: D6BestiaryEntryV1;
} | null {
  if (!worldCatalog) return null;
  const entry = worldCatalog.entries.find(
    (candidate) => candidate.id === entryId,
  );
  return entry ? Object.freeze({ catalog: worldCatalog, entry }) : null;
}

export function bestiaryDocumentAccess(
  entryId: string,
): BestiaryDocumentAccess | null {
  const source = documents.get(entryId);
  if (!source) return null;
  return Object.freeze({
    documentUuid: source.documentUuid,
    editable: source.editable,
    listed: source.listed,
    packageLabel: source.packageLabel,
    worldOwned: source.worldOwned,
  });
}

async function ensureWorldCatalogPack(): Promise<FoundryCompendiumCollection> {
  const existing = game.packs?.get(WORLD_CATALOG_COLLECTION);
  if (existing) return existing;
  return foundry.documents.collections.CompendiumCollection.createCompendium({
    label: worldCreatureCatalogLabel(),
    name: "d6-creature-catalog",
    package: "world",
    type: "Actor",
  });
}

function uniqueWorldEntryId(label: string): string {
  const slug =
    label
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "creature";
  return `world.${slug}.${foundryRandomId()}`;
}

function currentCatalogFlag(label: string): Record<string, unknown> {
  const rulesProfile = currentConfiguredRulesProfile();
  const settingProfile = currentResolvedSettingProfile().profile;
  return {
    attributeIds: currentActiveAttributeDefinitions().map(({ id }) => id),
    entryId: uniqueWorldEntryId(label),
    listed: true,
    rulesFamily: strategyUsesOpenD6(rulesProfile, "attributes")
      ? "open-d6-first-edition"
      : "d6-system-second-edition",
    rulesProfileId: rulesProfile.id,
    settingProfileId: settingProfile.id,
    sourceBook: worldCreatureCatalogLabel(),
    sourcePage: 1,
    version: D6_BESTIARY_CONTRACT_VERSION,
  };
}

function sourceForCatalog(
  source: ActorSource,
  label: string,
  flag: Record<string, unknown>,
): Record<string, unknown> {
  const clone = structuredClone(source) as Record<string, unknown>;
  delete clone._id;
  delete clone.folder;
  delete clone.ownership;
  delete clone._stats;
  const flags = record(clone.flags);
  clone.flags = {
    ...flags,
    [SYSTEM_ID]: {
      ...record(flags[SYSTEM_ID]),
      [CATALOG_FLAG]: flag,
    },
  };
  clone.name = label;
  return clone;
}

async function createInWorldCatalog(
  source: ActorSource,
  label: string,
  flag: Record<string, unknown>,
): Promise<FoundryActorDocument> {
  const pack = await ensureWorldCatalogPack();
  const document = await Actor.create(sourceForCatalog(source, label, flag), {
    pack: pack.collection,
  });
  if (!document) throw new Error("D6E2.Bestiary.CreationFailed");
  await refreshBestiaryDocuments();
  Hooks.callAll?.("d6e2BestiaryChanged");
  return document;
}

export async function createWorldCatalogCreature(): Promise<FoundryActorDocument> {
  const label = game.i18n.format("D6E2.Bestiary.NewDocumentName", {
    type: bestiaryCreatureLabel("singular"),
  });
  const attributes = Object.fromEntries(
    currentActiveAttributeDefinitions().map(({ id }) => [id, { score: 3 }]),
  );
  const source = {
    flags: {},
    items: [],
    name: label,
    system: { attributes },
    type: "creature",
  } as unknown as ActorSource;
  return createInWorldCatalog(source, label, currentCatalogFlag(label));
}

export async function addActorToWorldCatalog(
  actor: FoundryActorDocument,
): Promise<FoundryActorDocument> {
  if (actor.type !== "creature") throw new Error("D6E2.Bestiary.CreatureOnly");
  return createInWorldCatalog(
    actor.toObject(),
    actor.name,
    currentCatalogFlag(actor.name),
  );
}

export function actorIsInWorldBestiaryCatalog(
  actor: FoundryActorDocument,
): boolean {
  return actor.pack === WORLD_CATALOG_COLLECTION;
}

export async function duplicateBestiaryDocument(
  entryId: string,
  useCurrentProfiles: boolean,
): Promise<FoundryActorDocument> {
  const source = documents.get(entryId);
  if (!source) throw new Error("D6E2.Bestiary.SourceUnavailable");
  const label = game.i18n.format("D6E2.Bestiary.CopyName", {
    name: source.document.name,
  });
  const originalFlag = catalogFlag(source.document);
  const registered = resolvedBestiaryEntry(entryId)?.entry;
  const configuredAttributeIds = originalFlag.attributeIds;
  const sourceRulesFamily =
    text(originalFlag.rulesFamily) === "open-d6-first-edition" ||
    registered?.rulesFamily === "open-d6-first-edition"
      ? "open-d6-first-edition"
      : "d6-system-second-edition";
  const flag = useCurrentProfiles
    ? {
        ...currentCatalogFlag(label),
        sourceBook: firstText(
          originalFlag.sourceBook,
          registered?.source.book,
          bestiaryData(source.document).sourceBook,
          source.packageLabel,
        ),
        sourcePage: positiveInteger(
          originalFlag.sourcePage ??
            registered?.source.page ??
            bestiaryData(source.document).sourcePage,
        ),
      }
    : {
        ...originalFlag,
        attributeIds: Array.isArray(configuredAttributeIds)
          ? configuredAttributeIds
          : Object.keys(
              registered?.attributeScores ??
                record(source.document.system.attributes),
            ),
        entryId: uniqueWorldEntryId(label),
        listed: true,
        rulesFamily: sourceRulesFamily,
        sourceBook: firstText(
          originalFlag.sourceBook,
          bestiaryData(source.document).sourceBook,
          source.packageLabel,
        ),
        sourcePage: positiveInteger(
          originalFlag.sourcePage ?? bestiaryData(source.document).sourcePage,
        ),
        version: D6_BESTIARY_CONTRACT_VERSION,
      };
  return createInWorldCatalog(source.document.toObject(), label, flag);
}

export function openBestiaryDocument(entryId: string): void {
  const source = documents.get(entryId);
  if (!source) throw new Error("D6E2.Bestiary.SourceUnavailable");
  source.document.sheet.render(true);
}

function editableWorldDocument(entryId: string): FoundryActorDocument {
  const source = documents.get(entryId);
  if (!source?.worldOwned || !source.editable) {
    throw new Error("D6E2.Bestiary.ProtectedSource");
  }
  return source.document;
}

export async function removeBestiaryDocument(entryId: string): Promise<void> {
  const document = editableWorldDocument(entryId);
  await document.update({
    [`flags.${SYSTEM_ID}.${CATALOG_FLAG}.listed`]: false,
  });
  await refreshBestiaryDocuments();
  Hooks.callAll?.("d6e2BestiaryChanged");
}

export async function restoreBestiaryDocument(entryId: string): Promise<void> {
  const document = editableWorldDocument(entryId);
  await document.update({
    [`flags.${SYSTEM_ID}.${CATALOG_FLAG}.listed`]: true,
  });
  await refreshBestiaryDocuments();
  Hooks.callAll?.("d6e2BestiaryChanged");
}

export async function deleteBestiaryDocument(entryId: string): Promise<void> {
  const document = editableWorldDocument(entryId);
  await document.delete();
  await refreshBestiaryDocuments();
  Hooks.callAll?.("d6e2BestiaryChanged");
}

export function bestiaryDocumentSource(entryId: string): ActorSource | null {
  return documents.get(entryId)?.document.toObject() ?? null;
}
