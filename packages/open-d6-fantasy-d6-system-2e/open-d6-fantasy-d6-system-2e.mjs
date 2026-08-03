// packages/open-d6-fantasy-d6-system-2e/content/catalog.mjs
var book = "D6 Fantasy";
var source = (page) => ({ book, page });
var groups = {
  agility: [
    "Acrobatics",
    "Fighting",
    "Climbing",
    "Contortion",
    "Dodge",
    "Flying",
    "Jumping",
    "Melee Combat",
    "Riding",
    "Stealth"
  ],
  coordination: [
    "Charioteering",
    "Lockpicking",
    "Marksmanship",
    "Pilotry",
    "Sleight of Hand",
    "Throwing"
  ],
  physique: ["Lifting", "Running", "Stamina", "Swimming"],
  intellect: [
    "Cultures",
    "Devices",
    "Healing",
    "Navigation",
    "Reading/Writing",
    "Scholar",
    "Speaking",
    "Trading",
    "Traps"
  ],
  acumen: [
    "Artist",
    "Crafting",
    "Disguise",
    "Gambling",
    "Hide",
    "Investigation",
    "Know-How",
    "Search",
    "Streetwise",
    "Survival",
    "Tracking"
  ],
  charisma: [
    "Animal Handling",
    "Bluff",
    "Charm",
    "Command",
    "Intimidation",
    "Mettle",
    "Persuasion"
  ]
};
var slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
var skills = Object.entries(groups).flatMap(
  ([attributeId, names]) => names.map((name) => ({
    attributeId,
    key: slug(name),
    name,
    source: source(attributeId === "agility" ? 12 : 13)
  }))
);
skills.push(
  ...["Alteration", "Apportation", "Divination", "Conjuration"].map((name) => ({
    attributeId: "extranormal",
    key: `magic-${slug(name)}`,
    name,
    source: source(85)
  })),
  ...["Divination", "Favor", "Strife"].map((name) => ({
    attributeId: "extranormal",
    key: `miracles-${slug(name)}`,
    name,
    source: source(104)
  }))
);
var attributes = [
  "agility",
  "coordination",
  "physique",
  "intellect",
  "acumen",
  "charisma",
  "extranormal"
];
var template = (id, label, page, scores, suggestedSkillKeys) => ({
  attributeScores: Object.fromEntries(
    attributes.map((attributeId, index) => [attributeId, scores[index]])
  ),
  firstEdition: { characterPoints: 5, fatePoints: 1, move: 10 },
  id: `fantasy-${id}`,
  label,
  rulesFamily: "open-d6-first-edition",
  source: source(page),
  suggestedSkillKeys,
  version: 2
});
var templates = [
  template(
    "bard",
    "Bard",
    128,
    [6, 6, 6, 12, 12, 12, 0],
    ["artist", "speaking", "scholar", "investigation"]
  ),
  template(
    "cleric",
    "Cleric",
    129,
    [7, 6, 6, 11, 9, 9, 6],
    ["miracles-divination", "miracles-favor", "miracles-strife", "healing"]
  ),
  template(
    "gladiator",
    "Gladiator",
    130,
    [12, 9, 12, 6, 9, 6, 0],
    ["fighting", "melee-combat", "dodge", "stamina"]
  ),
  template(
    "healer",
    "Healer",
    131,
    [8, 6, 7, 12, 11, 10, 0],
    ["healing", "scholar", "investigation", "sleight-of-hand"]
  ),
  template(
    "merchant",
    "Merchant",
    132,
    [8, 6, 7, 12, 9, 12, 0],
    ["trading", "cultures", "charm", "persuasion"]
  ),
  template(
    "monster-slayer",
    "Monster Slayer",
    133,
    [11, 10, 11, 6, 10, 6, 0],
    ["fighting", "melee-combat", "survival", "tracking"]
  ),
  template(
    "ranger",
    "Ranger",
    134,
    [10, 10, 9, 8, 8, 9, 0],
    ["marksmanship", "survival", "tracking", "stealth"]
  ),
  template(
    "thief",
    "Thief",
    135,
    [9, 12, 9, 7, 8, 9, 0],
    ["lockpicking", "stealth", "hide", "sleight-of-hand"]
  ),
  template(
    "wanderer",
    "Wanderer",
    136,
    [9, 9, 9, 9, 9, 9, 0],
    ["survival", "cultures", "riding", "mettle"]
  ),
  template(
    "wizard",
    "Wizard",
    137,
    [7, 6, 6, 10, 10, 8, 7],
    [
      "magic-alteration",
      "magic-apportation",
      "magic-divination",
      "magic-conjuration"
    ]
  )
];
var common = (id, page) => ({
  context: "personal",
  description: `Mechanical reference. See D6 Fantasy, printed p. ${page}.`,
  equipped: false,
  key: id,
  mass: 0,
  quantity: 1,
  value: 0
});
var weapon = (name, damage, page = 118, range = { short: 0, medium: 0, long: 0 }, skill = "melee-combat") => ({
  era: "fantasy",
  id: slug(name),
  kind: "weapon",
  name,
  source: source(page),
  system: {
    ...common(slug(name), page),
    ammunition: { current: 0, maximum: 0 },
    attackAttributeId: skill === "marksmanship" ? "coordination" : skill === "throwing" ? "coordination" : "agility",
    attackBonus: 0,
    attackSkillKey: skill,
    autofireRating: 0,
    damage,
    damageType: "physical",
    range: { ...range, shortMinimum: 0 },
    scale: 0,
    weaponKind: "standard"
  }
});
var armor = (name, resistance) => ({
  era: "fantasy",
  id: slug(name),
  kind: "armor",
  name,
  source: source(116),
  system: {
    ...common(slug(name), 116),
    coverage: "body",
    energyResistance: 0,
    physicalResistance: resistance,
    stackingTag: name.toLowerCase().includes("shield") ? "shield" : "body"
  }
});
var equipment = [
  ...[
    ["Soft Leather", 2],
    ["Padded Leather", 3],
    ["Hard Leather", 4],
    ["Ring Mail", 5],
    ["Chain Mail", 6],
    ["Plate Mail", 9],
    ["Buckler", 2],
    ["Small Shield", 6],
    ["Medium Shield", 7],
    ["Large Shield", 8]
  ].map(([name, score]) => armor(name, score)),
  weapon(
    "Long Bow",
    8,
    117,
    { short: 10, medium: 100, long: 250 },
    "marksmanship"
  ),
  weapon(
    "Short Bow",
    5,
    117,
    { short: 10, medium: 100, long: 250 },
    "marksmanship"
  ),
  weapon(
    "Light Crossbow",
    12,
    117,
    { short: 10, medium: 100, long: 200 },
    "marksmanship"
  ),
  weapon(
    "Heavy Crossbow",
    13,
    117,
    { short: 10, medium: 100, long: 300 },
    "marksmanship"
  ),
  weapon("Sling", 3, 117, { short: 5, medium: 10, long: 15 }, "marksmanship"),
  weapon("Javelin", 6, 117, { short: 5, medium: 25, long: 40 }, "throwing"),
  weapon(
    "Throwing Dagger",
    3,
    117,
    { short: 5, medium: 10, long: 15 },
    "throwing"
  ),
  ...[
    ["Dagger", 3],
    ["Battle Axe", 9],
    ["Mace", 4],
    ["Quarterstaff", 5],
    ["Spear", 6],
    ["Long Sword", 8],
    ["Short Sword", 5],
    ["Two-Handed Sword", 10],
    ["War Hammer", 9]
  ].map(([name, score]) => weapon(name, score))
];
var bestiary = (id, label, page, scores, skillScores, scale = 0, move = 10) => ({
  attributeScores: Object.fromEntries(
    attributes.map((key, index) => [key, scores[index]])
  ),
  biography: `Generic mechanical profile. See D6 Fantasy, printed p. ${page}.`,
  defenseOverrides: { dodge: 0, parry: 0 },
  id: `fantasy-${id}`,
  label,
  move,
  rulesFamily: "open-d6-first-edition",
  scale,
  skillScores,
  source: source(page),
  version: 1
});
var bestiaryEntries = [
  bestiary("healer", "Healer", 125, [6, 6, 6, 9, 6, 6, 0], {
    healing: 12,
    "reading-writing": 7,
    scholar: 8,
    investigation: 7
  }),
  bestiary("henchman", "Henchman", 125, [6, 6, 9, 6, 6, 6, 0], {
    fighting: 12,
    "melee-combat": 9,
    stealth: 9,
    lockpicking: 9,
    marksmanship: 12,
    running: 11,
    hide: 9,
    streetwise: 9,
    tracking: 9
  }),
  bestiary("merchant", "Merchant", 125, [6, 6, 6, 6, 6, 9, 0], {
    riding: 7,
    "sleight-of-hand": 8,
    running: 7,
    cultures: 9,
    "reading-writing": 8,
    scholar: 9,
    speaking: 9,
    trading: 9,
    streetwise: 7,
    bluff: 11,
    charm: 12,
    persuasion: 9
  }),
  bestiary("ranger", "Ranger", 125, [9, 6, 6, 6, 6, 6, 0], {
    dodge: 10,
    fighting: 10,
    "melee-combat": 10,
    stealth: 11,
    running: 10,
    lifting: 11,
    hide: 8,
    investigation: 7,
    search: 7,
    survival: 8,
    tracking: 8,
    intimidation: 7,
    mettle: 7
  }),
  bestiary("ruffian", "Ruffian", 126, [6, 6, 9, 6, 6, 3, 0], {
    fighting: 9,
    "melee-combat": 9,
    stealth: 7,
    lockpicking: 9,
    traps: 9,
    gambling: 8,
    hide: 8,
    streetwise: 9,
    intimidation: 9
  }),
  bestiary("soldier", "Soldier", 126, [6, 6, 9, 6, 6, 6, 0], {
    dodge: 9,
    fighting: 9,
    "melee-combat": 9,
    lifting: 10,
    running: 10,
    search: 7,
    streetwise: 7,
    survival: 7,
    intimidation: 8,
    mettle: 7
  }),
  bestiary(
    "bird-of-prey",
    "Bird of Prey",
    126,
    [12, 3, 6, 3, 6, 6, 0],
    { fighting: 15, flying: 15, search: 9, tracking: 9, mettle: 9 },
    9,
    32
  ),
  bestiary(
    "domestic-cat",
    "Domestic Cat",
    126,
    [9, 3, 3, 3, 6, 6, 0],
    {
      fighting: 12,
      climbing: 12,
      dodge: 12,
      jumping: 12,
      stealth: 12,
      running: 9,
      search: 9,
      tracking: 9,
      mettle: 9
    },
    6,
    20
  ),
  bestiary(
    "large-cat",
    "Large Cat",
    126,
    [12, 6, 12, 3, 6, 6, 0],
    {
      climbing: 15,
      dodge: 15,
      fighting: 15,
      jumping: 15,
      stealth: 15,
      running: 15,
      search: 9,
      tracking: 9,
      intimidation: 15,
      mettle: 12
    },
    0,
    30
  ),
  bestiary(
    "cobra",
    "Cobra",
    126,
    [12, 6, 3, 3, 6, 6, 0],
    {
      fighting: 15,
      stealth: 15,
      marksmanship: 12,
      search: 9,
      tracking: 9,
      intimidation: 12,
      mettle: 12
    },
    9,
    15
  ),
  bestiary(
    "domestic-dog",
    "Domestic Dog",
    126,
    [9, 3, 9, 3, 6, 6, 0],
    {
      dodge: 12,
      fighting: 12,
      running: 12,
      search: 9,
      tracking: 12,
      intimidation: 9,
      mettle: 7
    },
    5,
    25
  ),
  bestiary(
    "guard-dog",
    "Guard Dog",
    126,
    [9, 3, 12, 3, 6, 6, 0],
    {
      dodge: 18,
      fighting: 15,
      running: 13,
      search: 9,
      tracking: 12,
      intimidation: 15,
      mettle: 12
    },
    4,
    25
  ),
  bestiary(
    "horse",
    "Horse",
    126,
    [9, 3, 12, 3, 9, 6, 0],
    { fighting: 12, jumping: 12, running: 15, intimidation: 9, mettle: 9 },
    3,
    25
  ),
  bestiary(
    "rats",
    "Rats",
    126,
    [9, 0, 3, 3, 6, 3, 0],
    {
      acrobatics: 10,
      climbing: 11,
      dodge: 10,
      fighting: 11,
      jumping: 12,
      running: 9,
      swimming: 5,
      hide: 12,
      search: 9
    },
    9,
    3
  )
];
var catalog_default = {
  packageManifest: {
    apiCompatibility: { minimum: 1, maximum: 1 },
    contractVersion: 1,
    genreId: "open-d6-fantasy-d6-system-2e",
    id: "open-d6-fantasy-d6-system-2e",
    kind: "genre",
    label: "Open D6 Fantasy",
    rulesFamily: "open-d6-first-edition",
    sources: [{ book, pages: "9\u201343, 83\u2013119, 125\u2013126, 128\u2013137" }],
    version: "0.1.0-alpha.23"
  },
  genreProfile: {
    attributeBudgetScore: 54,
    attributes: attributes.map((id) => ({
      id,
      label: `D6E2.Attribute.${id[0].toUpperCase()}${id.slice(1)}`
    })),
    genreId: "open-d6-fantasy-d6-system-2e",
    id: "open-d6-fantasy-d6-system-2e",
    label: "Open D6 Fantasy",
    roles: {
      initiative: "acumen",
      knowledge: "intellect",
      strength: "physique"
    },
    skillBudgetScore: 21,
    skills,
    version: 1
  },
  equipmentCatalog: {
    entries: equipment,
    eras: ["fantasy"],
    id: "open-d6-fantasy-equipment",
    label: "Open D6 Fantasy Equipment",
    version: 1
  },
  characterTemplateCatalog: {
    id: "open-d6-fantasy-character-templates",
    label: "Open D6 Fantasy Character Templates",
    templates,
    version: 2
  },
  bestiaryCatalog: {
    entries: bestiaryEntries,
    id: "open-d6-fantasy-bestiary",
    label: "Open D6 Fantasy Generic Characters and Animals",
    ownerId: "open-d6-fantasy-d6-system-2e",
    version: 1
  },
  packs: { skills, equipment, templates, bestiaryEntries }
};

// packages/open-d6-fantasy-d6-system-2e/src/main.ts
var MODULE_ID = "open-d6-fantasy-d6-system-2e";
Hooks.once("ready", () => {
  const api = game.system.api;
  if (api?.apiVersion !== 1 || !api.firstEditionGenreProfiles) {
    ui.notifications.warn(
      "Open D6 Fantasy requires a compatible D6 System Second Edition release."
    );
    return;
  }
  const systemApi = api;
  systemApi.campaignPackages.register(MODULE_ID, catalog_default.packageManifest);
  systemApi.firstEditionGenreProfiles.register(MODULE_ID, catalog_default.genreProfile);
  systemApi.equipment.register(MODULE_ID, catalog_default.equipmentCatalog);
  systemApi.templates.register(MODULE_ID, catalog_default.characterTemplateCatalog);
  systemApi.bestiaryRegistry.register(MODULE_ID, catalog_default.bestiaryCatalog);
});
//# sourceMappingURL=open-d6-fantasy-d6-system-2e.mjs.map
