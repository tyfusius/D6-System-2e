// packages/western1876-companion-d6-system-2e/src/d6-system-api.ts
function isD6ProfileApi(value) {
  if (typeof value !== "object" || value === null) return false;
  const api = value;
  return api.apiVersion === 2 && api.systemId === "d6-system-2e" && [
    "rulesProfileRegistry",
    "settingProfileRegistry",
    "settingProfileFontRegistry",
    "profilePresetRegistry",
    "firstEditionGenreProfiles"
  ].every((name) => {
    const registry = api[name];
    if (typeof registry !== "object" || registry === null) return false;
    const candidate = registry;
    return typeof candidate.register === "function" && typeof candidate.unregisterOwner === "function";
  });
}

// packages/western1876-companion-d6-system-2e/src/module.ts
var MODULE_ID = "western1876-companion-d6-system-2e";
var RULES_PROFILE_ID = "western-1876-initial";
var SETTING_PROFILE_ID = "western-1876";
var PRESET_ID = "western-1876-initial";
var LOGO_PATH = `modules/${MODULE_ID}/art/branding/1876-logo.png`;

// packages/western1876-companion-d6-system-2e/src/font.ts
var DISPLAY_FONT_ID = "bleeding-cowboys";
var DISPLAY_FONT_REF = `module/${MODULE_ID}/${DISPLAY_FONT_ID}`;
var WESTERN1876_DISPLAY_FONT = Object.freeze({
  version: 1,
  id: DISPLAY_FONT_ID,
  label: "Bleeding Cowboys",
  path: `modules/${MODULE_ID}/art/fonts/Bleeding_Cowboys.ttf`,
  roles: Object.freeze(["display"])
});

// packages/western1876-companion-d6-system-2e/src/catalog.ts
var WESTERN1876_ATTRIBUTES = Object.freeze([
  Object.freeze({ id: "reflexes", label: "Reflexes" }),
  Object.freeze({ id: "coordination", label: "Coordination" }),
  Object.freeze({ id: "physique", label: "Physique" }),
  Object.freeze({ id: "knowledge", label: "Knowledge" }),
  Object.freeze({ id: "perception", label: "Perception" }),
  Object.freeze({ id: "presence", label: "Presence" })
]);
var GROUPS = [
  [
    "reflexes",
    [
      [
        "dodge",
        "Dodge",
        "svg/shield.svg",
        "Evasive positioning against a perceived attack. It requires an action or available defensive reaction and respects actual cover and movement limits; it does not undo an injury."
      ],
      [
        "brawling",
        "Brawling",
        "skills/melee/unarmed-punch-fist.webp",
        "Unarmed strikes, grapples, escape from close restraint, and suitable unarmed defenses. State one intended result; securing a hold does not also injure, bind, throw, or disarm the opponent."
      ],
      [
        "melee",
        "Melee",
        "svg/sword.svg",
        "Attacking and parrying with handheld weapons. Readiness, reach, room, and a suitable defensive position matter. Weapon damage is resolved separately from the skill rating."
      ],
      [
        "riding",
        "Riding",
        "environment/creatures/horse-brown.webp",
        "Staying seated and directing a mount during demanding movement. Routine travel on a familiar manageable mount usually needs no roll. Training and trust use the relevant Handling field; team-drawn vehicle control uses Driving."
      ],
      [
        "acrobatics",
        "Acrobatics",
        "svg/jump.svg",
        "Balance, controlled falls, and unusual whole-body maneuvers. Ordinary running, climbing, and jumping use Athletics. Choose the skill that resolves the actual obstacle; this is not an automatic second chance after damage."
      ],
      [
        "stealth",
        "Stealth",
        "svg/sound-off.svg",
        "Moving or remaining unnoticed through concealment, quiet, and timing. Notice can catch an approach; Search deliberately examines a hiding place. A high result cannot conceal an exposed person without a plausible method."
      ]
    ]
  ],
  [
    "coordination",
    [
      [
        "firearms",
        "Firearms",
        "weapons/guns/pistol-revolver-steel.webp",
        "Shooting familiar firearms, including practical aiming and trigger control. Readiness, ammunition, condition, and the weapon's action remain requirements. Damage is separate; repair and alteration require Gunsmithing."
      ],
      [
        "archery",
        "Archery",
        "weapons/bows/bow-simple-small.webp",
        "Shooting a bow with familiar equipment and judging the shot. An ordinary attempt after basic instruction can default to Coordination. Making and repairing archery equipment requires the appropriate learned Craft."
      ],
      [
        "blowguns",
        "Blowguns",
        "weapons/thrown/dart-feathered.webp",
        "Elective Coordination skill for learned blowgun use, separate from Archery and Firearms. An ordinary attempt after instruction can default to Coordination. At creation, an existing background familiarity can grant access and existing personal pips buy training within the ordinary caps. It grants no free pips, extra familiarity, package substitution, ancestry benefit, or half-price specialization. Improve at the ordinary skill cost with instruction and practice. Weapon procedures are outside this catalogue."
      ],
      [
        "throwing",
        "Throwing",
        "weapons/thrown/throwing-stone.webp",
        "Accurately placing a held object, including a rope, stone, or familiar thrown weapon. The route must be possible. Placement does not also maintain a restraint or perform the separate trained preparation of a charge."
      ],
      [
        "sleight",
        "Sleight",
        "skills/social/theft-pickpocket-bribery-brown.webp",
        "Small hand movements that conceal a transfer, palm an object, or hide manipulation from an observer. It does not replace Deception, disguise, or Lockwork. Use Notice when an observer could detect the movement."
      ],
      [
        "lockwork",
        "Lockwork",
        "tools/hand/lockpicks-steel-grey.webp",
        "Learned picking, bypassing, and repair of ordinary mechanical locks with suitable equipment. Record the mechanisms and practice actually known. A Coordination default does not supply professional access, tools, or understanding of an unfamiliar mechanism."
      ],
      [
        "driving",
        "Driving",
        "environment/settlement/wagon.webp",
        "Controlling a cart, wagon, coach, or other team-drawn vehicle during demanding travel. Load, harness, vehicle condition, and the team limit what is possible. Animal training uses Handling; repairs use the relevant Craft."
      ]
    ]
  ],
  [
    "physique",
    [
      [
        "athletics",
        "Athletics",
        "skills/movement/figure-running-gray.webp",
        "Running, climbing, jumping, and general bodily movement. Resolve the named obstacle and consequence. Carrying a heavy load or enduring prolonged exertion may be separate Lifting or Stamina tasks, rather than extra rolls for every movement."
      ],
      [
        "lifting",
        "Lifting",
        "svg/lever.svg",
        "Moving, holding, or forcing a heavy load when strength is the uncertainty. Footing, leverage, assistance, and the object's strength determine whether an attempt is possible. Athletics covers movement and Stamina covers sustained exertion."
      ],
      [
        "stamina",
        "Stamina",
        "svg/regen.svg",
        "Endurance under strain, exposure, and sustained effort. It does not supply missing rest, water, warmth, or treatment, and does not replace the base Physique attribute for damage resistance."
      ],
      [
        "swimming",
        "Swimming",
        "svg/waterfall.svg",
        "Moving and remaining afloat in water. Current, temperature, clothing, load, and available exits define the task. Later exposure or endurance can require Stamina, but does not replace the swimming attempt."
      ]
    ]
  ],
  [
    "knowledge",
    [
      [
        "demolition",
        "Demolition",
        "svg/explosion.svg",
        "Learned explosives work within the character's recorded professional training. Knowledge is its provisional attribute in the current working draft; a high default does not teach an unlearned procedure. Throwing remains a separate skill. The catalogue does not automate dynamite procedures."
      ],
      [
        "medicine",
        "Medicine",
        "tools/medical/bandage-rough.webp",
        "Diagnosis and care within the practitioner's recorded training: household nursing, midwifery, medical practice, surgery, veterinary work, or another learned scope. Related experience does not grant every treatment or surgical permission. Instruments, conditions, and the patient's state matter; one roll does not also stabilize, diagnose, transport, and definitively treat a patient."
      ],
      [
        "gunsmithing",
        "Gunsmithing",
        "skills/trades/smithing-anvil-brown.webp",
        "Firearm repair, fitting, and alteration within learned methods and available tools. Establish the particular weapon, fault, intended work, and equipment. Shooting ability does not grant repair expertise; a repair does not automatically add accuracy, a talent, or new ammunition compatibility."
      ],
      [
        "craft",
        "Craft",
        "skills/trades/construction-carpentry-hammer.webp",
        "Work within recorded learned trades, such as wheelwright, blacksmith, carpenter, or printer. Use the rating within those established fields; it does not confer every workshop profession. Craft does not replace specialist Demolition, Gunsmithing, Lockwork, or Medicine procedures."
      ],
      [
        "scholarship",
        "Scholarship",
        "skills/trades/academics-study-reading-book.webp",
        "Difficult written, historical, technical, scientific, or cultural knowledge within actual education and access to sources. Record languages and literacy separately. Interpreting a document does not prove its authenticity; connecting case evidence uses Investigation."
      ],
      [
        "law",
        "Law",
        "skills/social/trading-justice-scale-gold.webp",
        "Legal knowledge within a specified jurisdiction and period, including authority, process, records, and obligations. Research can establish an unfamiliar legal environment. Knowledge does not grant office, a warrant, universal arrest powers, or compliance by officials."
      ],
      [
        "business",
        "Business",
        "skills/trades/academics-merchant-scribe.webp",
        "Accounts, prices, contracts, provisioning, and commercial judgment. It can identify costs or discrepancies without compelling agreement. Separate negotiation may use Persuasion; skill alone supplies no customers, capital, or ownership."
      ]
    ]
  ],
  [
    "perception",
    [
      [
        "notice",
        "Notice",
        "svg/eye.svg",
        "Catching an immediate change, suspicious movement, or relevant sensory detail. It can oppose Stealth or Sleight when detection is possible. Deliberate examination uses Search; interpretation uses Investigation. Notice does not replace base Perception initiative."
      ],
      [
        "search",
        "Search",
        "tools/scribal/magnifying-glass.webp",
        "Deliberately examining a specified place or object with an established method and time. It locates evidence; Investigation connects it to events. Repeating an unchanged failed search is not a free reroll."
      ],
      [
        "tracking",
        "Tracking",
        "svg/pawprint.svg",
        "Following physical traces and judging direction, passage, or changes along a trail. Surface, weather, age, traffic, and surviving evidence matter. It cannot create absent tracks or guarantee a route after the trail is lost."
      ],
      [
        "survival",
        "Survival",
        "environment/wilderness/camp-improvised.webp",
        "Route judgment, shelter, water, weather, and field living in environments the character can reasonably understand. Actual supplies and geography constrain the choices. It does not replace Tracking or grant universal knowledge of unfamiliar country."
      ],
      [
        "investigation",
        "Investigation",
        "skills/trades/academics-investigation-study-blue.webp",
        "Connecting testimony, documents, physical evidence, and inconsistencies to answer a precise question. Conclusions must follow the available evidence. It does not read minds, establish unsupported guilt, or replace searching for a hidden object."
      ],
      [
        "gambling",
        "Gambling",
        "skills/trades/gaming-gambling-dice-gray.webp",
        "Informed decisions and observation within an understood wagering game. Establish stakes and possible loss before resolving play. It cannot guarantee profit from pure chance; concrete cheating or a separate false account uses the appropriate other skill."
      ]
    ]
  ],
  [
    "presence",
    [
      [
        "persuasion",
        "Persuasion",
        "skills/social/diplomacy-handshake.webp",
        "Seeking willing agreement through reasons, offers, and a credible relationship. State the concession and why the listener could grant it. A success does not erase commitments or create permanent loyalty."
      ],
      [
        "deception",
        "Deception",
        "svg/card-joker.svg",
        "Creating or maintaining a plausible misleading account. Known contradictory evidence or an impossible claim can prevent an attempt. Success has the stated effect for now; later evidence can expose it."
      ],
      [
        "intimidation",
        "Intimidation",
        "skills/social/intimidation-impressing.webp",
        "Applying a credible, understood threat to obtain a specific concession. The target must have reason to fear the consequence. Compliance can harm trust or provoke retaliation; it is not permanent obedience."
      ],
      [
        "command",
        "Command",
        "skills/social/wave-halt-stop.webp",
        "Coordinating people who have a reason to listen using a feasible instruction they can hear. It does not grant legal office, compel enemies, or make simultaneous impossible tasks possible."
      ],
      [
        "willpower",
        "Willpower",
        "svg/shield.svg",
        "Maintaining resolve against immediate mental pressure, using Presence when unimproved. It is a skill, not a seventh attribute or physical damage resistance. The working manuscript uses it for Nerve; this catalogue does not implement the manuscript's additional mental-wound procedures."
      ],
      [
        "performance",
        "Performance",
        "tools/instruments/lute-gold-brown.webp",
        "Holding an audience's attention through an actual learned form, such as music, stage work, recitation, or storytelling. Record the necessary instrument, language, repertoire, and experience. Entertainment does not automatically secure a separate agreement or professional technique."
      ]
    ]
  ]
];
var WESTERN1876_HANDLING_FIELDS = Object.freeze([
  ["horses", "Horses", "environment/creatures/horse-brown.webp"],
  ["dogs", "Dogs", "creatures/mammals/dog-husky-white-blue.webp"],
  ["cattle", "Cattle", "creatures/mammals/livestock-cow-green.webp"],
  ["sheep", "Sheep", "creatures/mammals/livestock-sheep-green.webp"],
  ["pigs", "Pigs", "creatures/mammals/livestock-pig-green.webp"],
  ["mules", "Mules", "svg/pawprint.svg"],
  ["falconry", "Falconry", "creatures/birds/raptor-hawk-flying.webp"],
  ["poultry", "Poultry", "creatures/birds/chicken-hen-white.webp"]
]);
function skill(attributeId, [key, name, icon, description]) {
  return Object.freeze({
    attributeId,
    key,
    name,
    img: `icons/${icon}`,
    description: `${description} Source: 1876 working draft, Chapter 5 \u2014 ${key.startsWith("handling-") ? "Handling and Animal fields" : name}.`,
    training: "standard"
  });
}
var WESTERN1876_SKILLS = Object.freeze([
  ...GROUPS.flatMap(
    ([attributeId, rows]) => rows.map((row) => skill(attributeId, row))
  ),
  ...WESTERN1876_HANDLING_FIELDS.map(
    ([id, label, icon]) => skill("presence", [
      `handling-${id}`,
      `Handling: ${label}`,
      icon,
      `Animal behavior, training, and trust within the learned ${label} field. This is an independent full skill whose total includes Presence; it is not a specialization or a bonus to universal Handling. Routine familiar care or a familiar command often needs no roll. An ordinary uncertain attempt defaults to Presence when unimproved, while demanding training requires relevant knowledge. Other animal fields and Riding do not transfer their trained ratings. Veterinary treatment requires Medicine with appropriate training. Other agreed fields can be added as separate custom skills.`
    ])
  )
]);

// packages/western1876-companion-d6-system-2e/src/genre.ts
var WESTERN1876_GENRE = Object.freeze({
  version: 1,
  id: MODULE_ID,
  genreId: MODULE_ID,
  label: "1876 \u2014 Current Working Attributes",
  attributeBudgetScore: 54,
  skillBudgetScore: 21,
  attributes: WESTERN1876_ATTRIBUTES,
  roles: Object.freeze({
    initiative: "perception",
    knowledge: "knowledge",
    strength: "physique"
  }),
  skills: Object.freeze([])
});

// packages/western1876-companion-d6-system-2e/src/profiles.ts
function create1876RulesProfile(localize) {
  return Object.freeze({
    version: 5,
    id: RULES_PROFILE_ID,
    label: localize("WESTERN1876.RulesName"),
    description: localize("WESTERN1876.RulesDescription"),
    source: Object.freeze({ kind: "module", ownerId: MODULE_ID }),
    firstEditionGenreProfile: Object.freeze({
      version: 1,
      id: MODULE_ID
    }),
    constraints: Object.freeze([]),
    difficultyLadder: Object.freeze([
      Object.freeze({ id: "very-easy", label: "Very Easy", value: 5 }),
      Object.freeze({ id: "easy", label: "Easy", value: 10 }),
      Object.freeze({ id: "moderate", label: "Moderate", value: 15 }),
      Object.freeze({ id: "difficult", label: "Difficult", value: 20 }),
      Object.freeze({
        id: "very-difficult",
        label: "Very Difficult",
        value: 25
      }),
      Object.freeze({ id: "heroic", label: "Exceptional", value: 30 })
    ]),
    healthModels: Object.freeze([]),
    matchingEvaluators: Object.freeze([]),
    homebrew: Object.freeze({ tyfusiusD8ExplosiveDeviation: false }),
    strategies: Object.freeze({
      actionEconomy: "open-d6.action-economy.segmented",
      activeDefenses: "open-d6.defenses.active",
      advancement: "open-d6.advancement.character-points",
      attributes: "open-d6.attributes.six-attribute",
      health: "open-d6.health.wounds-or-body-points",
      initiative: "open-d6.initiative.perception-reflexes",
      movement: "open-d6.movement.relative",
      metaCurrency: "open-d6.meta-currency.character-and-fate-points",
      pips: "open-d6.pips.classic",
      retries: "open-d6.retries.no-general-reroll",
      scale: "open-d6.scale.scalar",
      successEvaluator: "open-d6.success.meets-or-exceeds",
      wildDie: "open-d6.wild-die.critical-one",
      consequenceSuite: "open-d6.consequences.physical-only",
      creation: "open-d6.creation.attribute-skill-dice",
      featureEconomy: "open-d6.features.none"
    }),
    terminology: Object.freeze({})
  });
}
var ATTRIBUTES = [
  ["agility", "Agility"],
  ["brawn", "Brawn"],
  ["knowledge", "Knowledge"],
  ["perception", "Perception"],
  ["charm", "Charm"],
  ["magic", "Magic"],
  ["mechanical", "Mechanical"],
  ["mysticism", "Mysticism"],
  ["technical", "Technical"],
  ["acumen", "Acumen"],
  ["charisma", "Charisma"],
  ["coordination", "Coordination"],
  ["extranormal", "Extranormal"],
  ["intellect", "Intellect"],
  ["physique", "Physique"],
  ["presence", "Presence"],
  ["reflexes", "Reflexes"]
];
function create1876SettingProfile(localize) {
  return Object.freeze({
    version: 6,
    currency: Object.freeze({
      denominations: Object.freeze([
        Object.freeze({
          displayPrecision: 2,
          id: "dollar",
          pluralName: localize("WESTERN1876.Currency.Dollars"),
          ratioToParent: "1",
          singularName: localize("WESTERN1876.Currency.Dollar"),
          symbol: "$"
        }),
        Object.freeze({
          displayPrecision: 0,
          id: "cent",
          pluralName: localize("WESTERN1876.Currency.Cents"),
          ratioToParent: "100",
          singularName: localize("WESTERN1876.Currency.Cent"),
          symbol: "\xA2"
        })
      ]),
      id: "western-1876-dollar",
      revision: 1,
      version: 1
    }),
    id: SETTING_PROFILE_ID,
    label: localize("WESTERN1876.SettingName"),
    description: localize("WESTERN1876.SettingDescription"),
    originRulesFamily: "open-d6-first-edition",
    attributes: Object.freeze(
      ATTRIBUTES.map(([id, label]) => Object.freeze({ id, label }))
    ),
    skills: WESTERN1876_SKILLS,
    healthLabels: Object.freeze({}),
    terminology: Object.freeze({}),
    logo: LOGO_PATH,
    logoAsWatermark: false,
    typography: Object.freeze({
      display: DISPLAY_FONT_REF,
      body: "system/d6-interface"
    }),
    palette: Object.freeze({
      background: "#0b0b0a",
      text: "#e8dcc6",
      accent: "#c7a264",
      accentBright: "#e8dcc6",
      muted: "#c0aa85"
    }),
    wildDie: Object.freeze({
      one: Object.freeze({ kind: "text", value: "1" }),
      oneSound: "systems/d6-system-2e/assets/audio/wild-one.mp3",
      six: Object.freeze({
        kind: "image",
        value: "systems/d6-system-2e/assets/dice/wild-six.png"
      }),
      sixSound: "systems/d6-system-2e/assets/audio/wild-six.mp3"
    })
  });
}
function create1876Preset(localize) {
  return Object.freeze({
    version: 1,
    id: PRESET_ID,
    label: localize("WESTERN1876.PresetName"),
    description: localize("WESTERN1876.PresetDescription"),
    selection: Object.freeze({
      version: 1,
      rulesProfileId: RULES_PROFILE_ID,
      settingProfileId: SETTING_PROFILE_ID
    })
  });
}

// packages/western1876-companion-d6-system-2e/src/outlaw.ts
var OUTLAW_SETTING_PROFILE_ID = "western-1876-outlaw";
var OUTLAW_LOGO_PATH = `modules/${MODULE_ID}/art/branding/1876-outlaw-logo.png`;
function create1876OutlawSettingProfile(localize) {
  return Object.freeze({
    ...create1876SettingProfile(localize),
    id: OUTLAW_SETTING_PROFILE_ID,
    label: localize("WESTERN1876.OutlawName"),
    description: localize("WESTERN1876.OutlawDescription"),
    logo: OUTLAW_LOGO_PATH,
    palette: Object.freeze({
      background: "#090607",
      text: "#ead9d1",
      accent: "#f08c80",
      accentBright: "#f3b0a3",
      muted: "#baa69e"
    })
  });
}

// packages/western1876-companion-d6-system-2e/src/register.ts
function register1876Contributions(api, localize) {
  api.settingProfileFontRegistry.register(MODULE_ID, WESTERN1876_DISPLAY_FONT);
  api.firstEditionGenreProfiles.register(MODULE_ID, WESTERN1876_GENRE);
  api.rulesProfileRegistry.register(
    MODULE_ID,
    create1876RulesProfile(localize)
  );
  api.settingProfileRegistry.register(
    MODULE_ID,
    create1876SettingProfile(localize)
  );
  api.settingProfileRegistry.register(
    MODULE_ID,
    create1876OutlawSettingProfile(localize)
  );
  api.profilePresetRegistry.register(MODULE_ID, create1876Preset(localize));
}

// packages/western1876-companion-d6-system-2e/src/main.ts
Hooks.once("ready", () => {
  const api = game.system.api;
  if (!isD6ProfileApi(api)) {
    ui.notifications.warn(game.i18n.localize("WESTERN1876.ApiUnavailable"));
    return;
  }
  register1876Contributions(api, (key) => game.i18n.localize(key));
});
//# sourceMappingURL=western1876-companion-d6-system-2e.mjs.map
