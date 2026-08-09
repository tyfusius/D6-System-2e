// packages/open-d6-adventure-d6-system-2e/content/catalog.mjs
var book = "D6 Adventure";
var source = (page) => ({ book, page });
var slug = (value) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
var equipmentId = (value) => {
  const id = slug(value);
  return /^[a-z]/u.test(id) ? id : `equipment-${id}`;
};
var score = (value) => {
  if (Number.isSafeInteger(value)) return value;
  const match = String(value).match(/^(\d+)D(?:\+(\d))?$/u);
  if (!match) throw new TypeError(`Invalid die code ${value}.`);
  return Number(match[1]) * 3 + Number(match[2] ?? 0);
};
var rows = (text) => text.trim().split("\n").map((row) => row.split("|"));
var attributes = [
  "reflexes",
  "coordination",
  "physique",
  "knowledge",
  "perception",
  "presence",
  "extranormal"
];
var groups = {
  reflexes: [
    "Acrobatics",
    "Brawling",
    "Climbing",
    "Contortion",
    "Dodge",
    "Flying",
    "Jumping",
    "Melee Combat",
    "Riding",
    "Sneak"
  ],
  coordination: [
    "Lockpicking",
    "Marksmanship",
    "Missile Weapons",
    "Piloting",
    "Sleight of Hand",
    "Throwing"
  ],
  physique: ["Lifting", "Running", "Stamina", "Swimming"],
  knowledge: [
    "Business",
    "Demolitions",
    "Forgery",
    "Languages",
    "Medicine",
    "Navigation",
    "Scholar",
    "Security",
    "Tech"
  ],
  perception: [
    "Artist",
    "Gambling",
    "Hide",
    "Investigation",
    "Know-How",
    "Repair",
    "Search",
    "Streetwise",
    "Survival",
    "Tracking"
  ],
  presence: [
    "Animal Handling",
    "Charm",
    "Command",
    "Con",
    "Disguise",
    "Intimidation",
    "Persuasion",
    "Willpower"
  ]
};
var skills = Object.entries(groups).flatMap(
  ([attributeId, names]) => names.map((name) => ({
    attributeId,
    key: slug(name),
    name,
    source: source(attributeId === "presence" ? 13 : 12)
  }))
);
skills.push(
  ...["Alteration", "Apportation", "Conjuration", "Divination"].map((name) => ({
    attributeId: "extranormal",
    key: `magic-${slug(name)}`,
    name,
    source: source(13)
  })),
  ...[
    "Astral Projection",
    "Empathy",
    "Far-Sensing",
    "Healing",
    "Medium",
    "Protection",
    "Psychometry",
    "Strike",
    "Telekinesis",
    "Telepathy"
  ].map((name) => ({
    attributeId: "extranormal",
    key: `psionics-${slug(name)}`,
    name,
    source: source(13)
  }))
);
var rankFrom = (name) => Number(name.match(/\(R?(\d+)/u)?.[1] ?? 1);
var trait = (name, type, page, cost = rankFrom(name)) => ({
  name,
  sourcePage: page,
  system: {
    activation: "",
    cost,
    description: `Mechanical reference. See D6 Adventure, printed p. ${page}.`,
    frequency: "always",
    key: slug(name),
    rank: rankFrom(name)
  },
  type
});
var advantages = [
  "Authority (R1)",
  "Authority (R2)",
  "Authority (R3)",
  "Contacts (R1)",
  "Contacts (R2)",
  "Contacts (R3)",
  "Contacts (R4)",
  "Cultures (R1)",
  "Cultures (R2)",
  "Cultures (R3)",
  "Cultures (R4)",
  "Equipment (R1)",
  "Equipment (R2)",
  "Equipment (R3)",
  "Equipment (R4)",
  "Fame (R1)",
  "Fame (R2)",
  "Fame (R3)",
  "Patron (R1)",
  "Patron (R2)",
  "Patron (R3)",
  "Size (R1 or more)",
  "Trademark Specialization (R1)",
  "Wealth (R1 or more)"
].map((name) => trait(name, "advantage", 16));
var disadvantages = [
  "Advantage Flaw (R1)",
  "Advantage Flaw (R2)",
  "Advantage Flaw (R3)",
  "Age (R1)",
  "Age (R2)",
  "Bad Luck (R2)",
  "Bad Luck (R3)",
  "Bad Luck (R4)",
  "Burn-out (R1 or more)",
  "Cultural Unfamiliarity (R1)",
  "Cultural Unfamiliarity (R2)",
  "Cultural Unfamiliarity (R3)",
  "Debt (R1)",
  "Debt (R2)",
  "Debt (R3)",
  "Devotion (R1)",
  "Devotion (R2)",
  "Devotion (R3)",
  "Employed (R1)",
  "Employed (R2)",
  "Employed (R3)",
  "Enemy (R1)",
  "Enemy (R2)",
  "Enemy (R3)",
  "Hindrance (R1)",
  "Hindrance (R2)",
  "Hindrance (R3)",
  "Hindrance (R4)",
  "Illiterate (R1)",
  "Infamy (R1)",
  "Infamy (R2)",
  "Infamy (R3)",
  "Language Problems (R2)",
  "Learning Problems (R1)",
  "Poverty (R1)",
  "Prejudice (R1)",
  "Prejudice (R2)",
  "Price (R1)",
  "Price (R2)",
  "Quirk (R1)",
  "Quirk (R2)",
  "Quirk (R3)",
  "Reduced Attribute (R2)",
  "Wild Luck"
].map(
  (name) => trait(name, "disadvantage", name.startsWith("Age") ? 15 : 16, 0)
);
var specialAbilities = [
  "Accelerated Healing (3)",
  "Ambidextrous (2)",
  "Animal Control (3)",
  "Armor-Defeating Attack (2)",
  "Atmospheric Tolerance (2)",
  "Attack Resistance (2)",
  "Attribute Scramble (4)",
  "Blur (3)",
  "Combat Sense (3)",
  "Confusion (4)",
  "Darkness (3)",
  "Elasticity (1)",
  "Endurance (1)",
  "Enhanced Sense (3)",
  "Environmental Resistance (1)",
  "Extra Body Part (1)",
  "Extra Sense (1)",
  "Fast Reactions (3)",
  "Fear (2)",
  "Flight (6)",
  "Glider Wings (3)",
  "Hardiness (1)",
  "Hypermovement (1)",
  "Immortality (7)",
  "Immunity (1)",
  "Increased Attribute (2)",
  "Infravision/Ultravision (1)",
  "Intangibility (5)",
  "Invisibility (3)",
  "Iron Will (2)",
  "Life Drain (5)",
  "Longevity (3)",
  "Luck, Good (2)",
  "Luck, Great (3)",
  "Master of Disguise (3)",
  "Multiple Abilities (1)",
  "Natural Armor (3)",
  "Natural Hand-to-Hand Weapon (2)",
  "Natural Ranged Weapon (3)",
  "Omnivorous (2)",
  "Paralyzing Touch (4)",
  "Possession, Limited (8)",
  "Quick Study (3)",
  "Sense of Direction (2)",
  "Shapeshifting (3)",
  "Silence (3)",
  "Skill Bonus (1)",
  "Skill Minimum (R4)",
  "Teleportation (3)",
  "Transmutation (5)",
  "Uncanny Aptitude (3)",
  "Ventriloquism (3)",
  "Water Breathing (2)",
  "Youthful Appearance (1)"
].map((name) => trait(name, "specialability", 17, rankFrom(name)));
var provenance = (id, page) => ({
  catalogId: "open-d6-adventure-equipment",
  catalogVersion: 1,
  entryId: id,
  era: "modern",
  ownerId: "open-d6-adventure-d6-system-2e",
  sourceBook: book,
  sourcePage: page
});
var common = (name, page) => ({
  context: "personal",
  description: `Mechanical reference. See D6 Adventure, printed p. ${page}.`,
  equipped: false,
  equipmentProvenance: provenance(equipmentId(name), page),
  key: slug(name),
  mass: 0,
  quantity: 1,
  value: 0
});
var gear = (name, availability, price) => ({
  era: "modern",
  id: equipmentId(name),
  kind: "gear",
  name,
  source: source(113),
  system: {
    ...common(name, 113),
    availability: `${availability}; ${price}`,
    legality: ""
  }
});
var gearEntries = rows(`
Alarm clock|A|VE
Archaeologist's tool kit|U|E
Art supplies|C|E
Backpack|A|VE
Basic clothing|A|E
Basic field rations|A|VE
Binoculars|C|E
Blanket|A|VE
Camera, basic point and shoot|C|E
Film, basic color or B&W|C|VE
Carpenter's/construction tool kit|A|E
Compass|C|VE
Crowbar|A|VE
Daily newspaper or weekly magazine|A|VE
Disguise kit|C|E
Duct tape, 10 meters|C|VE
Duffel bag|A|VE
Eating utensils|A|VE
Electrician's tool kit|C|E
Evidence kit|U|M
Field radio|U|E
First-aid kit|C|VE
Fishing gear|A|VE
Flashlight, large|C|VE
Gas mask|U|E
Gas stove|C|E
Geiger counter|U|E
Handcuffs|U|E
Holster|C|VE
Jungle adventurer's pack|U|E
Iron spikes and piton|A|VE
Kerosene heater|C|VE
Lantern|A|VE
Lighter|A|VE
Lockpicking tools|U|VE
Marbles|A|VE
Mechanic's tool kit|C|E
Movie camera, small|U|M
Movie camera film or tape|U|VE
Parachute|U|E
Personal hygiene kit|A|VE
PDA|C/N|M
Quick-draw holster|C|E
Radio, portable|A|VE
Rifle scope|C|E
Rope, hemp, 50 meters|A|VE
Rope, cotton, 50 meters|A|VE
Sewing machine, small|A|VE
Shovel|A|VE
Signal locator|U/N|D
Sleeping bag or bedroll|A|E
Steamer trunk|A|VE
Tape recorder|A|E
Tapes for recorder|A|VE
Telescope|C|E
Tent, 1-person|A|VE
Tent, 3-person|A|E
Tracking device|C/N|M
Typewriter|C|E
Torch|A|VE
Watch|A|VE-E
Wood stove|A|E
`).map(([name, availability, price]) => gear(name, availability, price));
var armor = (name, armorValue, price) => ({
  era: "modern",
  id: equipmentId(name),
  kind: "armor",
  name,
  source: source(114),
  system: {
    ...common(name, 114),
    coverage: "body",
    energyResistance: 0,
    physicalResistance: score(armorValue),
    stackingTag: "body",
    availability: price
  }
});
var armorEntries = rows(`
Woven metal fabric, light|0D+1|E
Hides and fur|0D+2|VE-E
Soft leather, canvas, or heavy khaki|0D+2|VE-E
Bone and hide|1D|E
Chain mail|1D|E
Hard leather or flying jacket|1D|E
Padded metal fabric, heavy|1D+1|M
Plate mail|2D|E
Bulletproof vest|3D|M
Flak jacket|3D|L
Reflective armor|3D|L
Light Kevlar|3D+1|M
Heavy Kevlar|2D+1|D
Ceramic armor|3D|D
Reinforced ceramic armor|3D+1|H
`).map(([name, value, price]) => armor(name, value, price));
var weapon = (name, damage, page, ranges, ammunition = 0, price = "", damageBasis = "fixed", skillKey = "marksmanship", kind = "standard") => ({
  era: "modern",
  id: equipmentId(name),
  kind: "weapon",
  name,
  source: source(page),
  system: {
    ...common(name, page),
    ammunition: { current: ammunition, maximum: ammunition },
    attackAttributeId: skillKey === "melee-combat" ? "reflexes" : "coordination",
    attackBonus: 0,
    attackSkillKey: skillKey,
    autofireRating: 0,
    damage: score(damage),
    damageBasis,
    damageType: "physical",
    range: {
      shortMinimum: 0,
      short: ranges[0],
      medium: ranges[1],
      long: ranges[2]
    },
    scale: 0,
    weaponKind: kind,
    availability: price
  }
});
var firearmEntries = rows(`
.30 M1 Carbine|5D+1|8|45|450|600|M
Colt Snub .38 Revolver|4D|6|5|10|15|E
Colt .45 Peacemaker|4D+1|6|15|30|45|E
Glock 17 9mm Pistol|3D+2|16|8|16|24|D
Luger P08 9mm|3D+2|8|10|20|30|E
Derringer .45 Pistol|4D|2|10|20|30|E
Smith & Wesson .38 Revolver|4D|6|15|30|45|E
Smith & Wesson .357 Magnum|5D|6|20|35|50|E
Walther PPK 9mm Short|3D|7|7|14|21|M
Blunderbuss|4D|1|12|20|30|M
Flintlock Musket|3D+2|1|25|40|100|M
Springfield M1903 Rifle|7D|5|40|80|160|E
Remington Model 30 Rifle|5D+1|6|20|75|200|E
Winchester 94 Lever Action|6D+1|6|30|60|120|M
Mossberg M500 Shotgun|6D|5|20|40|60|M
Remington 30 Double-Barrel Shotgun|6D|2|20|40|60|E
Sawed-Off Shotgun|6D|2|15|20|30|E
Kalashnikov AK-47|6D|30|45|85|170|D
Bergmann MP18|3D+2|12|15|30|60|E
Schmeisser MP38/40|3D+2|32|30|60|90|E
TEC-9 Machine Pistol|3D+2|30|15|30|45|M
Thompson M1928/M1|4D+2|30|25|50|75|E
Israeli Uzi|3D+2|30|20|40|60|M
MG42 Machine Gun|8D+2|500|300|600|1200|M
Vickers MK.1 Machine Gun|7D+1|250|150|300|900|M
Laser Pistol|4D|15|25|75|150|L
Laser Rifle|4D+2|20|30|250|1000|L
Blaster Pistol|4D+1|12|20|50|150|L
Blaster Rifle|7D|30|25|150|300|L
`).map(
  ([name, damage, ammo, short, medium, long, price]) => weapon(
    name,
    damage,
    116,
    [Number(short), Number(medium), Number(long)],
    Number(ammo),
    price
  )
);
var meleeEntries = rows(`
Awl or pocket knife|0D+2
Arrow or crossbow bolt|0D+1
Large axe|3D
Ball and chain|2D
Baton or nightstick|1D+1
Blackjack|0D+2
Brass knuckles|1D+1
Bullwhip|1D
Club or baseball bat|1D+1
Hatchet|1D+1
Hedge clippers|1D
Katana|3D
Large knife or dagger|1D
Mace|1D+1
Machete|1D+2
Manrikigusari|1D+2
Nunchaku|1D+2
Quarterstaff|1D+2
Rapier|2D
Sai|1D+1
Sap or tool hammer|1D
Broad sword|2D+2
Short sword|1D+2
Two-handed sword|3D+1
Tonfa|1D+2
`).map(
  ([name, damage]) => weapon(
    name,
    damage,
    119,
    [0, 0, 0],
    0,
    "",
    "strength-damage",
    "melee-combat"
  )
);
var missileEntries = rows(`
Blowgun and dart|1D|10|40|100
Short bow and arrow|1D+2|10|100|250
Long bow and arrow|2D+2|10|100|250
Composite bow and arrow|3D+1|10|60|250
Sling|1D|5|10|15
Light crossbow and bolt|4D|10|100|200
Heavy crossbow and bolt|4D+1|10|100|300
Wrist-mounted crossbow and dart|4D|10|25|50
Heavy boomerang|1D+1|5|40|100
Dart|0D+1|3|4|5
Javelin|2D|5|25|40
Throwing dagger|1D|5|10|15
Throwing star|1D|5|10|15
`).map(
  ([name, damage, short, medium, long]) => weapon(
    name,
    damage,
    119,
    [Number(short), Number(medium), Number(long)],
    0,
    "",
    "strength-damage",
    name.includes("bow") || name.includes("Sling") ? "missile-weapons" : "throwing"
  )
);
var explosiveEntries = rows(`
81mm Mortar Round|8D|0|0|0
Dynamite Stick|5D|0|0|0
Fragmentation Grenade|6D|0|0|0
Plastic Explosive Charge|5D|0|0|0
Tear Gas Grenade|1D|0|0|0
Smoke Grenade|1D|0|0|0
`).map(
  ([name, damage, short, medium, long]) => weapon(
    name,
    damage,
    118,
    [Number(short), Number(medium), Number(long)],
    1,
    "",
    "fixed",
    "throwing",
    "thrown-explosive"
  )
);
var equipment = [
  ...gearEntries,
  ...armorEntries,
  ...firearmEntries,
  ...meleeEntries,
  ...missileEntries,
  ...explosiveEntries
];
var manifestation = (name, skillKey, difficulty, page, tradition) => ({
  id: `${tradition}-${slug(name)}`,
  name,
  source: source(page),
  system: {
    ...common(name, page),
    magicSystem: "first-edition-adventure",
    firstEdition: { difficulty, skillKey, sourcePage: page, tradition }
  }
});
var spellRows = [
  ["Conjuration", 5, 97],
  ["Alteration", 3, 97],
  ["Conjuration", 4, 97],
  ["Apportation", 5, 98],
  ["Alteration", 19, 98],
  ["Alteration", 21, 98],
  ["Alteration", 10, 98],
  ["Alteration", 12, 99],
  ["Alteration", 19, 99],
  ["Apportation", 15, 99],
  ["Apportation", 18, 99],
  ["Apportation", 13, 100],
  ["Apportation", 12, 100],
  ["Conjuration", 11, 100],
  ["Conjuration", 27, 101],
  ["Conjuration", 10, 101],
  ["Conjuration", 12, 101],
  ["Conjuration", 16, 101],
  ["Conjuration", 18, 101],
  ["Conjuration", 12, 102],
  ["Conjuration", 10, 102],
  ["Conjuration", 10, 102],
  ["Conjuration", 12, 102],
  ["Divination", 12, 102],
  ["Divination", 11, 103],
  ["Divination", 25, 103],
  ["Divination", 19, 103]
];
var spells = spellRows.map(
  ([skillName, difficulty, page], index) => manifestation(
    `Adventure Spell Example ${String(index + 1).padStart(2, "0")}`,
    `magic-${slug(skillName)}`,
    difficulty,
    page,
    "magic"
  )
);
var psionicRows = [
  ["Astral Projection", 15, 107],
  ["Empathy", 10, 108],
  ["Far-Sensing", 15, 108],
  ["Healing", 2, 109],
  ["Medium", 15, 109],
  ["Protection", 5, 110],
  ["Psychometry", 15, 110],
  ["Strike", 5, 110],
  ["Telekinesis", 10, 110],
  ["Telepathy", 10, 111]
];
var psionics = psionicRows.map(
  ([name, difficulty, page], index) => manifestation(
    `Adventure Psionic Exercise ${String(index + 1).padStart(2, "0")}`,
    `psionics-${slug(name)}`,
    difficulty,
    page,
    "psionics"
  )
);
var manifestations = [...spells, ...psionics];
var template = (label, page, values, suggestedSkillKeys) => ({
  attributeScores: Object.fromEntries(
    attributes.map((id, index) => [id, values[index]])
  ),
  firstEdition: {
    biography: `Original generic template based on the printed mechanical profile. See D6 Adventure, printed p. ${page}.`,
    characterPoints: 5,
    fatePoints: 1,
    move: 10
  },
  id: `open-d6-adventure-${slug(label)}`,
  label,
  rulesFamily: "open-d6-first-edition",
  source: source(page),
  suggestedSkillKeys,
  version: 2
});
var templates = [
  template(
    "Protective Specialist",
    128,
    [10, 10, 11, 7, 8, 8, 0],
    ["brawling", "dodge", "marksmanship", "intimidation"]
  ),
  template(
    "Field Correspondent",
    129,
    [8, 6, 7, 12, 12, 9, 0],
    ["investigation", "scholar", "search", "persuasion"]
  ),
  template(
    "Medical Professional",
    130,
    [7, 6, 8, 12, 11, 10, 0],
    ["medicine", "scholar", "investigation", "persuasion"]
  ),
  template(
    "Field Researcher",
    131,
    [8, 9, 8, 11, 12, 6, 0],
    ["scholar", "investigation", "search", "survival"]
  ),
  template(
    "Private Investigator",
    132,
    [7, 10, 8, 8, 11, 10, 0],
    ["investigation", "lockpicking", "search", "streetwise"]
  ),
  template(
    "Stage Magician",
    133,
    [7, 10, 6, 7, 9, 12, 3],
    ["sleight-of-hand", "artist", "con", "charm"]
  ),
  template(
    "Paranormal Researcher",
    134,
    [6, 6, 6, 12, 12, 12, 0],
    ["scholar", "investigation", "search", "willpower"]
  ),
  template(
    "Reformed Infiltrator",
    135,
    [11, 11, 7, 7, 11, 7, 0],
    ["lockpicking", "sneak", "security", "streetwise"]
  ),
  template(
    "Supernatural Investigator",
    136,
    [9, 9, 9, 9, 9, 9, 0],
    ["investigation", "scholar", "search", "willpower"]
  ),
  template(
    "Weapons Specialist",
    137,
    [12, 12, 9, 6, 9, 6, 0],
    ["brawling", "melee-combat", "marksmanship", "dodge"]
  )
];
var vehicle = (label, move, passengers, toughness, maneuverability, price, page = 120) => ({
  biography: `Generic mechanical vehicle profile. Move ${move}; price ${price}. See D6 Adventure, printed p. ${page}.`,
  hull: score(toughness),
  id: `adventure-${slug(label)}`,
  label,
  maneuverability: score(maneuverability),
  move,
  passengers,
  scale: 0,
  source: source(page)
});
var vehicles = [
  vehicle("Bicycle", 10, 2, "2D", "2D+2", "E-M"),
  vehicle("Stage Coach", 5, 8, "4D+1", "0D", "D"),
  vehicle("Small Motorcycle", 84, 2, "3D+2", "3D", "D"),
  vehicle("Large Motorcycle", 98, 2, "4D", "2D", "D"),
  vehicle("Small Car", 49, 4, "4D+1", "2D", "VD"),
  vehicle("Mid-Size Car", 70, 6, "4D+2", "1D+1", "VD"),
  vehicle("Large Car", 70, 8, "5D", "1D", "VD"),
  vehicle("Sports Car", 107, 4, "4D+1", "3D", "H"),
  vehicle("Minivan", 63, 7, "5D+1", "1D", "H"),
  vehicle("Full-Size Van", 63, 15, "5D+2", "0D", "H"),
  vehicle("Pickup Truck", 63, 3, "5D+2", -1, "H"),
  vehicle("Delivery Truck", 63, 3, "6D", -4, "L"),
  vehicle("City Bus", 49, 81, "5D+2", -4, "L"),
  vehicle("Intercity Bus", 49, 43, "5D+2", -4, "L"),
  vehicle("Tractor Trailer", 49, 2, "6D+2", -6, "L"),
  vehicle("Canoe", 6, 4, "2D", "1D", "E-M"),
  vehicle("Rowboat", 6, 6, "3D+2", "0D", "E"),
  vehicle("Small Sailboat", 10, 2, "4D", "2D", "D"),
  vehicle("Large Sailboat", 10, 18, "6D", "1D", "H"),
  vehicle("Medium Powerboat", 42, 9, "4D+2", "1D", "D"),
  vehicle("Civilian Helicopter", 126, 5, "6D+1", "3D", "L"),
  vehicle("Small Prop Plane", 98, 8, "5D", "1D", "L"),
  vehicle("Medium Prop Plane", 133, 20, "6D+1", "0D", "L"),
  vehicle("Small Jet", 308, 20, "6D+1", "0D", "L")
];
var bestiary = (label, page, values, skillScores, move = 10, scale = 0) => ({
  attributeScores: Object.fromEntries(
    attributes.map((id, index) => [id, values[index]])
  ),
  biography: `Generic mechanical profile. See D6 Adventure, printed p. ${page}.`,
  defenseOverrides: { dodge: 0, parry: 0 },
  id: `adventure-${slug(label)}`,
  label,
  move,
  rulesFamily: "open-d6-first-edition",
  scale,
  skillScores,
  source: source(page),
  version: 1
});
var bestiaryEntries = [
  bestiary("Henchperson", 126, [6, 6, 6, 6, 6, 6, 0], {
    brawling: 12,
    lockpicking: 9,
    marksmanship: 12,
    streetwise: 9
  }),
  bestiary("Police Officer", 126, [6, 6, 6, 6, 6, 6, 0], {
    brawling: 9,
    dodge: 9,
    marksmanship: 12,
    streetwise: 12
  }),
  bestiary("Reporter", 126, [6, 6, 6, 6, 6, 6, 0], {
    sneak: 9,
    investigation: 9,
    scholar: 9,
    search: 9,
    persuasion: 9
  }),
  bestiary("Scientist", 126, [6, 3, 3, 9, 9, 6, 0], {
    investigation: 15,
    scholar: 12,
    tech: 12,
    repair: 12
  }),
  bestiary("Security Guard", 126, [6, 6, 6, 6, 6, 6, 0], {
    brawling: 9,
    dodge: 12,
    security: 9,
    medicine: 9
  }),
  bestiary("Soldier", 127, [6, 6, 6, 6, 6, 6, 0], {
    brawling: 9,
    dodge: 9,
    marksmanship: 9,
    lifting: 9,
    willpower: 9
  }),
  bestiary("Street Tough", 127, [6, 6, 9, 6, 6, 3, 0], {
    brawling: 9,
    lockpicking: 9,
    marksmanship: 9,
    streetwise: 9,
    intimidation: 9
  }),
  bestiary(
    "Small Bat",
    127,
    [9, 3, 3, 3, 3, 3, 0],
    { brawling: 12, flying: 12, search: 6, tracking: 6, willpower: 9 },
    15,
    9
  ),
  bestiary(
    "Bird of Prey",
    127,
    [12, 3, 6, 3, 6, 6, 0],
    { brawling: 15, flying: 15, search: 9, tracking: 9, willpower: 9 },
    32,
    9
  ),
  bestiary(
    "Domestic Cat",
    127,
    [9, 3, 3, 3, 6, 6, 0],
    { brawling: 12, climbing: 12, dodge: 12, jumping: 12, sneak: 12 },
    20,
    6
  ),
  bestiary(
    "Large Cat",
    127,
    [12, 6, 12, 3, 6, 6, 0],
    { brawling: 15, climbing: 15, dodge: 15, jumping: 15, sneak: 15 },
    30
  ),
  bestiary(
    "Domestic Dog",
    127,
    [9, 3, 9, 3, 6, 6, 0],
    { brawling: 12, dodge: 12, running: 12, search: 9, tracking: 12 },
    25,
    5
  ),
  bestiary(
    "Guard Dog",
    127,
    [9, 3, 12, 3, 6, 6, 0],
    { brawling: 15, dodge: 18, running: 12, tracking: 12, intimidation: 15 },
    25,
    4
  ),
  bestiary(
    "Horse",
    127,
    [9, 3, 12, 3, 9, 6, 0],
    { brawling: 12, jumping: 12, running: 15, intimidation: 9 },
    25,
    3
  ),
  bestiary(
    "Shark",
    127,
    [9, 3, 9, 3, 6, 6, 0],
    { brawling: 12, swimming: 15, search: 9, tracking: 9, intimidation: 18 },
    16
  ),
  bestiary("Walking Dead", 127, [6, 3, 6, 3, 3, 3, 0], {
    brawling: 9,
    lifting: 9,
    search: 9,
    tracking: 9,
    intimidation: 18
  }),
  bestiary("Minor Destructive Spirit", 127, [9, 6, 15, 6, 6, 6, 0], {
    brawling: 12,
    sneak: 12,
    throwing: 12,
    lifting: 16,
    running: 18,
    intimidation: 18
  }),
  bestiary("Young Blood-Drinker", 127, [9, 6, 15, 9, 6, 12, 0], {
    brawling: 12,
    flying: 10,
    sneak: 12,
    throwing: 12,
    charm: 15,
    intimidation: 18,
    willpower: 21
  })
];
var catalog_default = {
  packageManifest: {
    apiCompatibility: { minimum: 2, maximum: 2 },
    contractVersion: 1,
    genreId: "open-d6-adventure-d6-system-2e",
    id: "open-d6-adventure-d6-system-2e",
    kind: "genre",
    label: "Open D6 Adventure",
    rulesFamily: "open-d6-first-edition",
    sources: [{ book, pages: "9\u201342, 83\u2013120, 126\u2013137" }],
    version: "0.1.0-beta.1"
  },
  genreProfile: {
    attributeBudgetScore: 54,
    attributes: attributes.map((id) => ({
      id,
      label: `D6E2.Attribute.${id[0].toUpperCase()}${id.slice(1)}`
    })),
    genreId: "open-d6-adventure-d6-system-2e",
    id: "open-d6-adventure-d6-system-2e",
    label: "Open D6 Adventure",
    roles: {
      initiative: "perception",
      knowledge: "knowledge",
      strength: "physique"
    },
    skillBudgetScore: 21,
    skills,
    version: 1
  },
  equipmentCatalog: {
    entries: equipment,
    eras: ["modern"],
    id: "open-d6-adventure-equipment",
    label: "Open D6 Adventure Equipment",
    version: 1
  },
  characterTemplateCatalog: {
    id: "open-d6-adventure-character-templates",
    label: "Open D6 Adventure Character Templates",
    templates,
    version: 2
  },
  bestiaryCatalog: {
    entries: bestiaryEntries,
    id: "open-d6-adventure-bestiary",
    label: "Open D6 Adventure Generic Characters, Animals, and Monsters",
    ownerId: "open-d6-adventure-d6-system-2e",
    version: 1
  },
  packs: {
    advantages,
    bestiaryEntries,
    disadvantages,
    equipment,
    manifestations,
    skills,
    specialAbilities,
    templates,
    vehicles
  }
};

// packages/open-d6-adventure-d6-system-2e/src/main.ts
var MODULE_ID = "open-d6-adventure-d6-system-2e";
Hooks.once("ready", () => {
  const api = game.system.api;
  if (api?.apiVersion !== 2 || !api.firstEditionGenreProfiles) {
    ui.notifications.warn(
      "Open D6 Adventure requires a compatible D6 System Second Edition release."
    );
    return;
  }
  const systemApi = api;
  systemApi.campaignPackages.register(MODULE_ID, catalog_default.packageManifest);
  systemApi.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "first-edition-adventure",
    id: MODULE_ID,
    label: "Open D6 Adventure",
    mechanicIds: ["adventure-magic", "adventure-psionics"],
    recommendedPrimaryProfile: "open-d6",
    recommendedSettingProfile: MODULE_ID,
    rulesFamily: "open-d6-first-edition",
    version: "0.1.0-beta.8"
  });
  systemApi.firstEditionGenreProfiles.register(MODULE_ID, catalog_default.genreProfile);
  systemApi.equipment.register(MODULE_ID, catalog_default.equipmentCatalog);
  systemApi.templates.register(MODULE_ID, catalog_default.characterTemplateCatalog);
  systemApi.bestiaryRegistry.register(MODULE_ID, catalog_default.bestiaryCatalog);
});
//# sourceMappingURL=open-d6-adventure-d6-system-2e.mjs.map
