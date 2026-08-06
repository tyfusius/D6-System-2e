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
  id: `open-d6-fantasy-${id}`,
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
var gear = (name, price, page = 114) => ({
  era: "medieval",
  id: slug(name),
  kind: "gear",
  name,
  source: source(page),
  system: {
    ...common(slug(name), page),
    availability: `Price difficulty: ${price}`,
    legality: ""
  }
});
var weapon = (name, damage, page = 118, range = { short: 0, medium: 0, long: 0 }, skill = "melee-combat", damageBasis = "fixed") => ({
  era: "medieval",
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
    damageBasis,
    damageType: "physical",
    range: { ...range, shortMinimum: 0 },
    scale: 0,
    weaponKind: "standard"
  }
});
var armor = (name, resistance) => ({
  era: "medieval",
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
    ["Basket, woven", "VE"],
    ["Bell, small metal", "E"],
    ["Bedroll", "E"],
    ["Blanket, flannel single", "E"],
    ["Bowl, wooden soup", "VE"],
    ["Brazier, portable bronze", "M"],
    ["Bucket, wooden", "E"],
    ["Candle or lamp", "VE"],
    ["Chest, small wooden", "M"],
    ["Cloth, flannel", "VE"],
    ["Compass", "D"],
    ["Drum, handheld", "M"],
    ["Fishing hook and line", "VE"],
    ["Flute", "E"],
    ["Grappling hook", "E"],
    ["Hammer", "E"],
    ["Healer's pack", "VE"],
    ["Holy symbol, silver unblessed", "M"],
    ["Ink, small vial", "M"],
    ["Incense", "E"],
    ["Lamp oil, medium flask", "VE"],
    ["Lockpicking tools", "VD"],
    ["Lute", "M"],
    ["Marbles, hard clay", "VE"],
    ["Makeup kit", "E"],
    ["Mirror, silver", "M"],
    ["Mirror, polished metal", "M"],
    ["Writing sheet", "E"],
    ["Pick, mining", "E"],
    ["Perfumed water", "E"],
    ["Pouch, large leather", "E"],
    ["Pouch, small flannel", "VE"],
    ["Pot, iron cooking", "E"],
    ["Quill", "VE"],
    ["Quiver", "E"],
    ["Inn room, private", "M"],
    ["Inn room, common", "VE"],
    ["Rope, heavy hemp", "E"],
    ["Rope, light silk", "M"],
    ["Sack, rough cloth", "VE"],
    ["Scabbard", "E"],
    ["Sealing wax", "VE"],
    ["Shovel", "E"],
    ["Spoon or fork, brass", "VE"],
    ["Spikes, iron", "E"],
    ["Tent, two-person", "M"],
    ["Tinder box", "VE"],
    ["Vial, ceramic", "VE"],
    ["Vial, glass", "VE"],
    ["Waterskin", "E"],
    ["Whetstone", "VE"]
  ].map(([name, price]) => gear(name, price)),
  ...[
    ["Belt", "VE"],
    ["Boots", "E"],
    ["Cloak", "E"],
    ["Dress", "E"],
    ["Hat", "E"],
    ["Jerkin", "E"],
    ["Robe", "E"],
    ["Sandals", "VE"],
    ["Shoes", "VE"],
    ["Skirt", "E"],
    ["Tunic", "E"]
  ].map(([name, price]) => gear(name, price, 115)),
  ...[
    "Ale",
    "Bread",
    "Butter",
    "Cheese",
    "Sweet cookies",
    "Eggs",
    "Animal feed",
    "Fruit",
    "Gruel",
    "Herbs",
    "Jam or preserves",
    "Fresh meat",
    "Milk",
    "Nuts",
    "Pastry",
    "Rations",
    "Stew",
    "Vegetables",
    "Water",
    "Wine"
  ].map((name) => gear(name, "VE", 115)),
  ...[
    ["Grain or flour", "E"],
    ["Smoked meat", "E"],
    ["Rare spices", "E"]
  ].map(([name, price]) => gear(name, price, 115)),
  ...[
    ["Hides and Fur", 2],
    ["Soft Leather", 2],
    ["Quilted Silk", 2],
    ["Bone and Hide", 3],
    ["Padded Leather", 3],
    ["Hard Leather", 4],
    ["Ring Mail", 5],
    ["Chain Mail", 6],
    ["Bronze", 6],
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
    "marksmanship",
    "strength-damage"
  ),
  weapon(
    "Short Bow",
    5,
    117,
    { short: 10, medium: 100, long: 250 },
    "marksmanship",
    "strength-damage"
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
  weapon(
    "Blowgun and Dart",
    3,
    117,
    { short: 10, medium: 40, long: 100 },
    "marksmanship"
  ),
  weapon(
    "Handheld Crossbow",
    12,
    117,
    { short: 10, medium: 25, long: 50 },
    "marksmanship"
  ),
  weapon(
    "Sling",
    3,
    117,
    { short: 5, medium: 10, long: 15 },
    "marksmanship",
    "strength-damage"
  ),
  weapon(
    "Heavy Boomerang",
    4,
    117,
    { short: 5, medium: 40, long: 100 },
    "throwing",
    "strength-damage"
  ),
  weapon(
    "Dart",
    1,
    117,
    { short: 3, medium: 4, long: 5 },
    "throwing",
    "strength-damage"
  ),
  weapon(
    "Rock",
    1,
    117,
    { short: 1, medium: 2, long: 3 },
    "throwing",
    "strength-damage"
  ),
  weapon(
    "Javelin",
    6,
    117,
    { short: 5, medium: 25, long: 40 },
    "throwing",
    "strength-damage"
  ),
  weapon(
    "Throwing Dagger",
    3,
    117,
    { short: 5, medium: 10, long: 15 },
    "throwing",
    "strength-damage"
  ),
  weapon(
    "Throwing Star",
    3,
    117,
    { short: 5, medium: 10, long: 15 },
    "throwing",
    "strength-damage"
  ),
  weapon(
    "Arquebus",
    11,
    117,
    { short: 10, medium: 20, long: 40 },
    "marksmanship"
  ),
  weapon(
    "Wheellock Musket",
    12,
    117,
    { short: 10, medium: 25, long: 60 },
    "marksmanship"
  ),
  weapon(
    "Wheellock Pistol",
    10,
    117,
    { short: 5, medium: 10, long: 25 },
    "marksmanship"
  ),
  weapon(
    "Black Powder Bomb",
    18,
    117,
    { short: 1, medium: 2, long: 3 },
    "throwing"
  ),
  ...[
    ["Awl or Stake", 2],
    ["Arrow or Bolt", 1],
    ["Battle Axe", 9],
    ["Ball and Chain", 6],
    ["Bullwhip", 3],
    ["Large Club", 4],
    ["Spiked Club", 5],
    ["Hatchet", 4],
    ["Halberd", 9],
    ["Katana", 9],
    ["Dagger", 3],
    ["Mace", 4],
    ["Morning Star", 9],
    ["Nunchaku", 5],
    ["Quarterstaff", 5],
    ["Rapier", 6],
    ["Sai", 4],
    ["Sap or Tool Hammer", 3],
    ["Spear", 6],
    ["Long Sword", 8],
    ["Short Sword", 5],
    ["Two-Handed Sword", 10],
    ["Tonfa", 5],
    ["Trident", 8],
    ["War Hammer", 9]
  ].map(
    ([name, score]) => weapon(name, score, 118, void 0, "melee-combat", "strength-damage")
  )
];
var manifestation = (name, skill, difficulty, page, tradition = "magic") => ({
  id: `${tradition}-${slug(name)}`,
  name,
  source: source(page),
  system: {
    ...common(`${tradition}-${slug(name)}`, page),
    magicSystem: "first-edition-fantasy",
    firstEdition: {
      difficulty,
      skillKey: `${tradition}-${slug(skill)}`,
      sourcePage: page,
      tradition
    }
  }
});
var manifestations = [
  ...[
    ["Alteration", 5, 97],
    ["Alteration", 3, 97],
    ["Apportation", 5, 97],
    ["Alteration", 19, 98],
    ["Alteration", 11, 98],
    ["Alteration", 11, 98],
    ["Alteration", 19, 98],
    ["Alteration", 10, 98],
    ["Apportation", 15, 99],
    ["Apportation", 13, 99],
    ["Apportation", 14, 100],
    ["Conjuration", 27, 100],
    ["Conjuration", 10, 100],
    ["Conjuration", 11, 100],
    ["Conjuration", 12, 101],
    ["Conjuration", 10, 101],
    ["Conjuration", 10, 101],
    ["Conjuration", 10, 101],
    ["Conjuration", 12, 102],
    ["Divination", 14, 102],
    ["Divination", 11, 102],
    ["Divination", 25, 102]
  ].map(
    ([skill, difficulty, page], index) => manifestation(
      `Magic Example ${String(index + 1).padStart(2, "0")}`,
      skill,
      difficulty,
      page
    )
  ),
  ...[
    ["Favor", 11, 108],
    ["Favor", 13, 108],
    ["Favor", 8, 108],
    ["Favor", 7, 109],
    ["Favor", 8, 109],
    ["Favor", 12, 109],
    ["Favor", 13, 109],
    ["Divination", 20, 110],
    ["Divination", 19, 110],
    ["Strife", 15, 110],
    ["Strife", 13, 111],
    ["Strife", 14, 111],
    ["Strife", 25, 111],
    ["Strife", 23, 111],
    ["Strife", 12, 111],
    ["Strife", 27, 111]
  ].map(
    ([skill, difficulty, page], index) => manifestation(
      `Miracle Example ${String(index + 1).padStart(2, "0")}`,
      skill,
      difficulty,
      page,
      "miracles"
    )
  )
];
var vehicle = (id, label, scale, hull, maneuverability, passengers, crew, move) => ({
  biography: `Mechanical vehicle record. Move: ${move}. Crew: ${crew}. See D6 Fantasy, printed p. 119.`,
  hull,
  id: `fantasy-${id}`,
  label,
  maneuverability,
  move,
  passengers,
  crew,
  scale,
  source: source(119)
});
var vehicles = [
  vehicle("chariot", "Chariot", 3, 12, -2, 2, 1, "animal Move \xD7 75%"),
  vehicle("wagon", "Wagon", 5, 13, 0, 8, 1, "animal Move \xD7 50%"),
  vehicle(
    "passenger-carriage",
    "Passenger Carriage",
    6,
    13,
    -3,
    5,
    1,
    "animal Move \xD7 50%"
  ),
  vehicle("mine-cart", "Mine Cart", 3, 16, -9, 2, 1, "animal Move \xD7 25%"),
  vehicle("canoe", "Canoe", 0, 6, 3, 4, 1, "Physique or lifting roll"),
  vehicle("galleon", "Galleon", 14, 23, -6, 220, 120, "7 meters per round"),
  vehicle(
    "merchant-galley",
    "Merchant Galley",
    15,
    17,
    2,
    50,
    43,
    "10 meters per round"
  ),
  vehicle(
    "small-galley",
    "Small Galley",
    14,
    14,
    5,
    43,
    40,
    "12 meters per round"
  ),
  vehicle(
    "war-galley",
    "War Galley",
    21,
    22,
    -6,
    540,
    420,
    "12 meters per round"
  ),
  vehicle("longship", "Longship", 12, 20, 0, 120, 30, "4 meters per round"),
  vehicle("rowboat", "Rowboat", 2, 11, 0, 6, 1, "Physique or lifting roll"),
  vehicle(
    "small-sailboat",
    "Small Sailboat",
    4,
    12,
    6,
    2,
    1,
    "wind + 25% of pilotry total"
  )
];
var shipWeapon = (name, damage, range, attackBonus = 0) => ({
  id: slug(name),
  name,
  system: {
    ...common(slug(name), 119),
    ammunition: { current: 0, maximum: 0 },
    attackAttributeId: "coordination",
    attackBonus,
    attackSkillKey: "marksmanship",
    autofireRating: 0,
    damage,
    damageBasis: "fixed",
    damageType: "physical",
    range: { ...range, shortMinimum: 0 },
    scale: 0,
    weaponKind: "standard"
  }
});
var shipWeapons = [
  shipWeapon("Small Cannon", 12, { short: 50, medium: 200, long: 800 }),
  shipWeapon("Large Cannon", 15, { short: 50, medium: 150, long: 500 }),
  shipWeapon("Catapult", 11, { short: 45, medium: 90, long: 180 }, -5),
  shipWeapon("Ram", 0, { short: 0, medium: 0, long: 0 })
];
var ancestryFeature = (species, name, type, rank, cost, mechanic) => ({
  id: `${species}-${slug(name)}`,
  name: `${species} \u2014 ${name}`,
  type,
  system: {
    activation: mechanic,
    cost,
    description: `Ancestry mechanic. See D6 Fantasy, printed pp. 42\u201343.`,
    frequency: "always",
    key: `${species.toLowerCase()}-${slug(name)}`,
    rank
  }
});
var ancestryFeatures = [
  ancestryFeature("Dwarf", "Scale Trait", "advantage", 1, 0, "Scale value 3."),
  ancestryFeature(
    "Dwarf",
    "Social Difficulty",
    "disadvantage",
    2,
    0,
    "+2 difficulty to bluff, charm, and persuasion."
  ),
  ancestryFeature(
    "Dwarf",
    "Move Reduction",
    "disadvantage",
    1,
    0,
    "Reduce running, swimming, and jumping Move by 2 meters."
  ),
  ancestryFeature(
    "Dwarf",
    "Resistance Bonus",
    "specialability",
    2,
    2,
    "+2 to damage resistance totals."
  ),
  ancestryFeature(
    "Dwarf",
    "Aging Trait",
    "specialability",
    1,
    3,
    "Long-lived ancestry trait; adjudicate aging narratively."
  ),
  ancestryFeature(
    "Dwarf",
    "Dark-Sight Bonus",
    "specialability",
    1,
    1,
    "+2 to sight-based totals in dim or dark conditions."
  ),
  ancestryFeature(
    "Elf",
    "Nature Obligation",
    "disadvantage",
    2,
    0,
    "A binding devotion to trees and plants."
  ),
  ancestryFeature(
    "Elf",
    "Social Difficulty",
    "disadvantage",
    2,
    0,
    "+2 difficulty to bluff, charm, and persuasion."
  ),
  ancestryFeature(
    "Elf",
    "Resistance Penalty",
    "disadvantage",
    2,
    0,
    "\u22122 to damage resistance totals."
  ),
  ancestryFeature(
    "Elf",
    "Sight Bonus",
    "specialability",
    1,
    3,
    "+1 to sight-based totals."
  ),
  ancestryFeature(
    "Elf",
    "Aging Trait",
    "specialability",
    1,
    3,
    "Long-lived ancestry trait; adjudicate aging narratively."
  ),
  ancestryFeature(
    "Elf",
    "Stealth Skill Bonus",
    "specialability",
    1,
    1,
    "+1 to hide, stealth, and tracking totals."
  ),
  ancestryFeature("Gnome", "Scale Trait", "advantage", 1, 0, "Scale value 3."),
  ancestryFeature(
    "Gnome",
    "Move Reduction",
    "disadvantage",
    1,
    0,
    "Reduce running, swimming, and jumping Move by 2 meters."
  ),
  ancestryFeature(
    "Gnome",
    "Technical Skill Bonus",
    "specialability",
    1,
    1,
    "+1 to crafting, devices, and traps totals."
  ),
  ancestryFeature(
    "Reptile Folk",
    "Cold Difficulty",
    "disadvantage",
    3,
    0,
    "+1 difficulty per round below 15\xB0C."
  ),
  ancestryFeature(
    "Reptile Folk",
    "Social Difficulty",
    "disadvantage",
    2,
    0,
    "+2 difficulty to bluff, charm, and persuasion."
  ),
  ancestryFeature(
    "Reptile Folk",
    "Tail Trait",
    "specialability",
    1,
    0,
    "Extra body part: tail."
  ),
  ancestryFeature(
    "Reptile Folk",
    "Physical Resistance Bonus",
    "specialability",
    1,
    3,
    "+1D physical damage resistance."
  ),
  ancestryFeature(
    "Reptile Folk",
    "Unarmed Damage Bonus",
    "specialability",
    1,
    2,
    "+1D Strength Damage in unarmed attacks."
  )
];
var ancestry = (name, scale, moveModifier) => ({
  id: `${slug(name)}-ancestry`,
  label: `${name} Ancestry`,
  memberIds: ancestryFeatures.filter((entry) => entry.name.startsWith(`${name} \u2014`)).map((entry) => entry.id),
  moveModifier,
  rulesFamily: "open-d6-first-edition",
  scale
});
var ancestries = [
  ancestry("Dwarf", 3, -2),
  ancestry("Elf", 0, 0),
  ancestry("Gnome", 3, -2),
  ancestry("Reptile Folk", 0, 0)
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
    eras: ["medieval"],
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
  packs: {
    ancestries,
    ancestryFeatures,
    bestiaryEntries,
    equipment,
    manifestations,
    shipWeapons,
    skills,
    templates,
    vehicles
  }
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
  systemApi.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "first-edition-fantasy",
    id: MODULE_ID,
    label: "Open D6 Fantasy",
    mechanicIds: [],
    recommendedPrimaryProfile: "open-d6",
    rulesFamily: "open-d6-first-edition",
    version: "0.1.0-beta.2"
  });
  systemApi.firstEditionGenreProfiles.register(MODULE_ID, catalog_default.genreProfile);
  systemApi.equipment.register(MODULE_ID, catalog_default.equipmentCatalog);
  systemApi.templates.register(MODULE_ID, catalog_default.characterTemplateCatalog);
  systemApi.bestiaryRegistry.register(MODULE_ID, catalog_default.bestiaryCatalog);
});
//# sourceMappingURL=open-d6-fantasy-d6-system-2e.mjs.map
