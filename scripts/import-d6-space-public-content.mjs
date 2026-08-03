import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyRoot = process.env.D6_SPACE_LEGACY_PACKS;
const extractedPages = process.env.D6_SPACE_EXTRACTED_PAGES;
if (!legacyRoot || !extractedPages) {
  throw new Error("Set D6_SPACE_LEGACY_PACKS and D6_SPACE_EXTRACTED_PAGES.");
}

const sourceText = await readFile(extractedPages, "utf8");
const pages = [
  ...sourceText.matchAll(
    /<<< PDF_PAGE=\d+ PRINTED_PAGE=(\d+) >>>\n([\s\S]*?)(?=<<< PDF_PAGE=|$)/gu,
  ),
].map((match) => ({
  page: Number(match[1]),
  text: match[2].normalize("NFKD").replace(/\s+/gu, " ").toLowerCase(),
}));

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function pageFor(name, minimum, maximum, fallback) {
  const needle = name
    .replace(/\s*\((?:r)?\d+\)\s*$/iu, "")
    .normalize("NFKD")
    .replace(/\s+/gu, " ")
    .toLowerCase();
  return (
    pages.find(
      (page) =>
        page.page >= minimum &&
        page.page <= maximum &&
        page.text.includes(needle),
    )?.page ?? fallback
  );
}

async function legacy(name) {
  return (await readFile(path.join(legacyRoot, `${name}.db`), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function rank(name) {
  return Number(name.match(/\((?:R)?(\d+)\)\s*$/iu)?.[1] ?? 1);
}

function concise(page) {
  return `Mechanical reference. See Open D6 Space, printed p. ${page}.`;
}

function trait(entry, type, minimum, maximum) {
  const sourcePage = pageFor(entry.name, minimum, maximum, minimum);
  const entryRank = rank(entry.name);
  return {
    name: entry.name,
    sourcePage,
    system: {
      activation: "",
      cost: Number(entry.system.cost ?? entry.system.SCORE ?? entryRank * 3),
      description: concise(sourcePage),
      frequency: "always",
      key: slug(entry.name),
      rank: entryRank,
    },
    type,
  };
}

function provenance(id, page) {
  return {
    catalogId: "open-d6-space-equipment",
    catalogVersion: 1,
    entryId: id,
    era: "science-fiction",
    ownerId: "open-d6-space-d6-system-2e",
    sourceBook: "Open D6 Space",
    sourcePage: page,
  };
}

const advantages = (await legacy("advantages")).map((entry) =>
  trait(entry, "advantage", 27, 30),
);
const disadvantages = (await legacy("disadvantages")).map((entry) =>
  trait(entry, "disadvantage", 17, 26),
);
const specialAbilities = (await legacy("special-abilities")).map((entry) =>
  trait(entry, "specialability", 31, 40),
);

const equipment = [];
for (const [pack, kind, minimum, maximum] of [
  ["gear", "gear", 104, 105],
  ["armor", "armor", 106, 106],
  ["weapons", "weapon", 107, 113],
]) {
  for (const entry of await legacy(pack)) {
    const id = slug(entry.name);
    const sourcePage = pageFor(entry.name, minimum, maximum, minimum);
    const common = {
      context: "personal",
      description: concise(sourcePage),
      equipped: false,
      equipmentProvenance: provenance(id, sourcePage),
      key: id,
      mass: 0,
      quantity: 1,
      value: 0,
    };
    const system =
      kind === "gear"
        ? {
            ...common,
            availability: String(entry.system.price ?? ""),
            legality: "",
          }
        : kind === "armor"
          ? {
              ...common,
              context: "personal",
              coverage: "",
              energyResistance: Number(entry.system.er ?? 0),
              physicalResistance: Number(entry.system.pr ?? 0),
              stackingTag: "body",
            }
          : {
              ...common,
              ammunition: {
                current: Number(entry.system.ammo ?? 0),
                maximum: Number(entry.system.ammo ?? 0),
              },
              attackAttributeId: "agility",
              attackBonus: 0,
              attackSkillKey: slug(
                entry.system.stats?.skill ??
                  (entry.system.subtype === "Melee"
                    ? "Melee Combat"
                    : "Firearms"),
              ),
              autofireRating: Number(entry.system.rof ?? 0),
              damage: Number(entry.system.damage?.score ?? 0),
              damageType: String(entry.system.damage?.type ?? ""),
              range: {
                long: Number(entry.system.range?.long ?? 0),
                medium: Number(entry.system.range?.medium ?? 0),
                short: Number(entry.system.range?.short ?? 0),
                shortMinimum: 0,
              },
              scale: 0,
              weaponKind: entry.name.toLowerCase().includes("grenade")
                ? "thrown-explosive"
                : "standard",
            };
    equipment.push({
      era: "science-fiction",
      id,
      kind,
      name: entry.name,
      source: { book: "Open D6 Space", page: sourcePage },
      system,
    });
  }
}

const cybernetics = (await legacy("cybernetics")).map((entry) => {
  const sourcePage = pageFor(entry.name, 45, 51, 45);
  return {
    name: entry.name,
    sourcePage,
    system: {
      augmentationKind: "cyberware",
      context: "personal",
      description: concise(sourcePage),
      disabled: { combatId: "", untilRound: 0, untilTurn: 0 },
      equipped: false,
      installed: false,
      installation: {
        difficulty: 0,
        installerName: "",
        minutes: 0,
        previousCount: 0,
      },
      key: slug(entry.name),
      linkedTalentId: "",
      mass: 0,
      quantity: 1,
      rank: 1,
      value: 0,
    },
    type: "cybernetic",
  };
});

const metaphysics = (await legacy("metaphysics-skills")).map((entry) => {
  const sourcePage = pageFor(entry.name, 95, 102, 95);
  return {
    name: entry.name,
    sourcePage,
    system: {
      attributeId: "mysticism",
      description: concise(sourcePage),
      key: slug(entry.name),
      score: 0,
      source: {
        book: "Open D6 Space",
        module: "open-d6-space",
        page: sourcePage,
      },
      training: "standard",
    },
    type: "skill",
  };
});

const vehicles = (await legacy("vehicles")).map((entry) => ({
  name: entry.name,
  sourcePage: 113,
  system: {
    armor: 0,
    attributes: {
      hull: { score: Number(entry.system.toughness?.score ?? 3) },
      maneuverability: {
        score: Number(entry.system.maneuverability?.score ?? 3),
      },
    },
    biography: concise(113),
    crew: { members: [] },
    health: { condition: "healthy" },
    passengers: Number(entry.system.passengers?.value ?? 0),
    scale: Number(entry.system.scale?.score ?? 0),
  },
  type: "vehicle",
}));

const templateRows = [
  [
    "communications-cultures-expert",
    "Communications/Cultures Expert",
    128,
    [8, 7, 9, 9, 11, 7],
    ["communications", "cultures", "languages", "aliens"],
    3,
  ],
  [
    "con-artist",
    "Con Artist",
    129,
    [10, 6, 9, 9, 11, 6],
    ["con", "bargain", "persuasion", "sleight-of-hand"],
    3,
  ],
  [
    "cyberchopper",
    "Cyberchopper",
    130,
    [11, 9, 8, 10, 7, 9],
    ["medicine", "computer-interface-repair", "security", "firearms"],
    0,
  ],
  [
    "demolitions-expert",
    "Demolitions Expert",
    131,
    [9, 9, 8, 6, 11, 11],
    ["demolitions", "security", "throwing", "dodge"],
    0,
  ],
  [
    "hard-warrior",
    "Hard Warrior",
    132,
    [12, 12, 7, 8, 8, 7],
    ["brawling", "dodge", "firearms", "melee-combat"],
    0,
  ],
  [
    "medic",
    "Medic",
    133,
    [8, 7, 11, 7, 9, 12],
    ["medicine", "scholar", "search", "personal-equipment-repair"],
    0,
  ],
  [
    "megacorp-contract-negotiator",
    "Megacorp Contract Negotiator",
    134,
    [11, 6, 10, 9, 9, 9],
    ["bargain", "business", "con", "persuasion"],
    0,
  ],
  [
    "old-scout",
    "Old Scout",
    135,
    [8, 7, 11, 11, 8, 9],
    ["navigation", "survival", "vehicle-operation", "sensors"],
    0,
  ],
  [
    "security-expert",
    "Security Expert",
    136,
    [9, 9, 11, 6, 9, 10],
    ["security", "demolitions", "computer-interface-repair", "investigation"],
    0,
  ],
  [
    "technical-wiz",
    "Technical Wiz",
    137,
    [8, 6, 9, 9, 10, 12],
    [
      "computer-interface-repair",
      "firearms-repair",
      "robot-interface-repair",
      "vehicle-repair",
    ],
    0,
  ],
];
const characterTemplates = templateRows.map(
  ([id, label, page, scores, skills, metaphysicsScore]) => ({
    attributeScores: Object.fromEntries(
      [
        "agility",
        "brawn",
        "knowledge",
        "mechanical",
        "perception",
        "technical",
      ].map((key, index) => [key, scores[index]]),
    ),
    firstEdition: { characterPoints: 5, fatePoints: 1, move: 10 },
    id: `space-${id}`,
    label,
    rulesFamily: "open-d6-first-edition",
    source: { book: "Open D6 Space", page },
    suggestedSkillKeys: skills,
    ...(metaphysicsScore > 0
      ? { unassignedAttributeScore: metaphysicsScore }
      : {}),
    version: 2,
  }),
);

const genericRows = [
  [
    "bounty-hunter",
    "Bounty Hunter",
    [9, 9, 9, 9, 9, 9],
    0,
    { brawling: 11, dodge: 10, firearms: 11, "melee-combat": 10, survival: 10 },
    ["Knife (survival)", "Blaster Pistol", "Bulletproof vest"],
  ],
  [
    "law-enforcement-officer",
    "Law Enforcement Officer",
    [11, 9, 9, 8, 9, 8],
    0,
    {
      firearms: 14,
      dodge: 13,
      "melee-combat": 12,
      bureaucracy: 10,
      "security-regulations": 12,
      investigation: 10,
      search: 10,
      security: 9,
    },
    ["Blaster Pistol", "Plastovar"],
  ],
  [
    "merchant",
    "Merchant",
    [9, 8, 10, 8, 10, 9],
    0,
    {
      bureaucracy: 11,
      business: 11,
      cultures: 11,
      languages: 11,
      bargain: 12,
      con: 11,
      "vehicle-operation": 9,
    },
    ["Hand Computer"],
  ],
  [
    "soldier",
    "Soldier",
    [11, 10, 8, 8, 9, 8],
    0,
    {
      brawling: 12,
      dodge: 12,
      firearms: 17,
      "security-regulations": 9,
      search: 10,
      demolitions: 11,
    },
    ["Blaster Pistol", "Fragmentation Grenade", "Bulletproof vest"],
  ],
  [
    "thug",
    "Thug",
    [9, 9, 9, 3, 9, 3],
    0,
    {
      brawling: 12,
      firearms: 10,
      dodge: 11,
      "melee-combat": 9,
      lift: 12,
      stamina: 11,
      intimidation: 11,
      streetwise: 11,
    },
    ["Knife (survival)", "Bulletproof vest"],
  ],
  [
    "domestic-cat",
    "Domestic Cat",
    [9, 3, 3, 3, 6, 0],
    6,
    {
      brawling: 12,
      dodge: 12,
      running: 9,
      "climb-jump": 12,
      willpower: 9,
      search: 9,
      sneak: 12,
    },
    [],
  ],
  [
    "large-cat",
    "Large Cat",
    [12, 12, 3, 3, 6, 0],
    2,
    {
      brawling: 15,
      dodge: 15,
      running: 15,
      "climb-jump": 15,
      intimidation: 15,
      willpower: 9,
      search: 9,
      sneak: 15,
    },
    [],
  ],
  [
    "domestic-dog",
    "Domestic Dog",
    [9, 9, 3, 3, 6, 0],
    5,
    {
      brawling: 12,
      dodge: 12,
      running: 12,
      intimidation: 9,
      willpower: 7,
      search: 12,
    },
    [],
  ],
  [
    "guard-dog",
    "Guard Dog",
    [9, 12, 3, 3, 6, 0],
    4,
    {
      brawling: 15,
      dodge: 18,
      running: 12,
      intimidation: 15,
      willpower: 12,
      search: 12,
    },
    [],
  ],
  [
    "rats",
    "Rats",
    [9, 3, 3, 3, 6, 0],
    9,
    {
      acrobatics: 10,
      brawling: 12,
      dodge: 9,
      running: 11,
      "climb-jump": 9,
      swim: 5,
      willpower: 6,
      hide: 12,
      search: 9,
    },
    [],
  ],
];
const bestiaryEntries = genericRows.map(
  ([id, label, scores, scale, skillScores, equipmentNames]) => ({
    attributeScores: Object.fromEntries(
      [
        "agility",
        "brawn",
        "knowledge",
        "mechanical",
        "perception",
        "technical",
      ].map((key, index) => [key, scores[index]]),
    ),
    defenseOverrides: { dodge: skillScores.dodge ?? 0, parry: 0 },
    id: `space-${id}`,
    items: equipmentNames.map((name) => {
      const item = equipment.find((candidate) => candidate.name === name);
      if (!item)
        throw new Error(`Missing generic-character equipment ${name}.`);
      return { name: item.name, system: item.system, type: item.kind };
    }),
    label,
    rulesFamily: "open-d6-first-edition",
    scale,
    skillScores,
    source: { book: "Open D6 Space", page: 127 },
    version: 1,
  }),
);

const shipDesign = [
  ["Airlock", 4, 2, 300],
  ["Bridge/Duty Station", 4, 2, 100],
  ["Communal Bunks", 20, 10, 900],
  ["Coldsleep Module", 1, 0.5, 200],
  ["Infirmary", 18, 9, 1500],
  ["Basic Lounge", 30, 15, 1500],
  ["Deluxe Lounge", 36, 18, 3000],
  ["Passenger Seating", 6, 3, 300],
  ["One-Person Room", 10, 5, 500],
  ["Two-Person Room", 14, 7, 700],
  ["Workroom", 10, 5, 3000],
  ["Bulk Cargo Space", 1, 0.5, 25],
  ["Fighter Hangar", 20, 24, 6000],
  ["Launch Bay", 85, 103, 25000],
  ["Livestock Bay", 30, 39, 9100],
  ["Pod Bay", 4, 5, 1200],
  ["Vehicle Bay", 8, 5, 600],
].map(([name, area, mass, value], index) => ({
  name,
  sourcePage: index < 11 ? 115 : 116,
  system: {
    context: "starship",
    description: `Ship-design component: ${area} area units. See Open D6 Space, printed p. ${index < 11 ? 115 : 116}.`,
    equipped: false,
    key: slug(name),
    mass,
    quantity: 1,
    value,
  },
  type: "starship-gear",
}));

const packageManifest = {
  apiCompatibility: { maximum: 1, minimum: 1 },
  contractVersion: 1,
  genreId: "space",
  id: "open-d6-space-d6-system-2e",
  kind: "genre",
  label: "Open D6 Space",
  rulesFamily: "open-d6-first-edition",
  sources: [{ book: "Open D6 Space", pages: "15–120, 126–137" }],
  version: "1.0.0",
};

const catalog = {
  bestiaryCatalog: {
    entries: bestiaryEntries,
    id: "open-d6-space-generic-characters",
    label: "Open D6 Space Generic Characters and Animals",
    version: 1,
  },
  characterTemplateCatalog: {
    id: "open-d6-space-character-templates",
    label: "Open D6 Space Character Templates",
    templates: characterTemplates,
    version: 2,
  },
  equipmentCatalog: {
    entries: equipment,
    id: "open-d6-space-equipment",
    label: "Open D6 Space Equipment",
    version: 1,
  },
  packageManifest,
  packs: {
    advantages,
    cybernetics,
    disadvantages,
    equipment,
    genericCharacters: bestiaryEntries,
    metaphysics,
    shipDesign,
    specialAbilities,
    templates: characterTemplates,
    vehicles,
  },
};

const output = path.join(
  root,
  "packages/open-d6-space-d6-system-2e/content/catalog.json",
);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`);
console.info(
  `Imported ${advantages.length + disadvantages.length + specialAbilities.length + cybernetics.length + equipment.length + vehicles.length + metaphysics.length + shipDesign.length + bestiaryEntries.length + characterTemplates.length} public mechanical records.`,
);
