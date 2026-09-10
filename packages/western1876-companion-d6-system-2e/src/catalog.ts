import type { D6SettingSkillV1 } from "@d6-system-2e/core";

/** Current working Chapter 3 mapping; availability does not activate it. */
export const WESTERN1876_ATTRIBUTES = Object.freeze([
  Object.freeze({ id: "reflexes", label: "Reflexes" }),
  Object.freeze({ id: "coordination", label: "Coordination" }),
  Object.freeze({ id: "physique", label: "Physique" }),
  Object.freeze({ id: "knowledge", label: "Knowledge" }),
  Object.freeze({ id: "perception", label: "Perception" }),
  Object.freeze({ id: "presence", label: "Presence" }),
]);

type SkillRow = readonly [
  key: string,
  name: string,
  icon: string,
  description: string,
];
const GROUPS: readonly (readonly [string, readonly SkillRow[]])[] = [
  [
    "reflexes",
    [
      [
        "dodge",
        "Dodge",
        "svg/shield.svg",
        "Evasive positioning against a perceived attack. It requires an action or available defensive reaction and respects actual cover and movement limits; it does not undo an injury.",
      ],
      [
        "brawling",
        "Brawling",
        "skills/melee/unarmed-punch-fist.webp",
        "Unarmed strikes, grapples, escape from close restraint, and suitable unarmed defenses. State one intended result; securing a hold does not also injure, bind, throw, or disarm the opponent.",
      ],
      [
        "melee",
        "Melee",
        "svg/sword.svg",
        "Attacking and parrying with handheld weapons. Readiness, reach, room, and a suitable defensive position matter. Weapon damage is resolved separately from the skill rating.",
      ],
      [
        "riding",
        "Riding",
        "environment/creatures/horse-brown.webp",
        "Staying seated and directing a mount during demanding movement. Routine travel on a familiar manageable mount usually needs no roll. Training and trust use the relevant Handling field; team-drawn vehicle control uses Driving.",
      ],
      [
        "acrobatics",
        "Acrobatics",
        "svg/jump.svg",
        "Balance, controlled falls, and unusual whole-body maneuvers. Ordinary running, climbing, and jumping use Athletics. Choose the skill that resolves the actual obstacle; this is not an automatic second chance after damage.",
      ],
      [
        "stealth",
        "Stealth",
        "svg/sound-off.svg",
        "Moving or remaining unnoticed through concealment, quiet, and timing. Notice can catch an approach; Search deliberately examines a hiding place. A high result cannot conceal an exposed person without a plausible method.",
      ],
    ],
  ],
  [
    "coordination",
    [
      [
        "firearms",
        "Firearms",
        "weapons/guns/pistol-revolver-steel.webp",
        "Shooting familiar firearms, including practical aiming and trigger control. Readiness, ammunition, condition, and the weapon's action remain requirements. Damage is separate; repair and alteration require Gunsmithing.",
      ],
      [
        "archery",
        "Archery",
        "weapons/bows/bow-simple-small.webp",
        "Shooting a bow with familiar equipment and judging the shot. An ordinary attempt after basic instruction can default to Coordination. Making and repairing archery equipment requires the appropriate learned Craft.",
      ],
      [
        "blowguns",
        "Blowguns",
        "weapons/thrown/dart-feathered.webp",
        "Elective Coordination skill for learned blowgun use, separate from Archery and Firearms. An ordinary attempt after instruction can default to Coordination. At creation, an existing background familiarity can grant access and existing personal pips buy training within the ordinary caps. It grants no free pips, extra familiarity, package substitution, ancestry benefit, or half-price specialization. Improve at the ordinary skill cost with instruction and practice. Weapon procedures are outside this catalogue.",
      ],
      [
        "throwing",
        "Throwing",
        "weapons/thrown/throwing-stone.webp",
        "Accurately placing a held object, including a rope, stone, or familiar thrown weapon. The route must be possible. Placement does not also maintain a restraint or perform the separate trained preparation of a charge.",
      ],
      [
        "sleight",
        "Sleight",
        "skills/social/theft-pickpocket-bribery-brown.webp",
        "Small hand movements that conceal a transfer, palm an object, or hide manipulation from an observer. It does not replace Deception, disguise, or Lockwork. Use Notice when an observer could detect the movement.",
      ],
      [
        "lockwork",
        "Lockwork",
        "tools/hand/lockpicks-steel-grey.webp",
        "Learned picking, bypassing, and repair of ordinary mechanical locks with suitable equipment. Record the mechanisms and practice actually known. A Coordination default does not supply professional access, tools, or understanding of an unfamiliar mechanism.",
      ],
      [
        "driving",
        "Driving",
        "environment/settlement/wagon.webp",
        "Controlling a cart, wagon, coach, or other team-drawn vehicle during demanding travel. Load, harness, vehicle condition, and the team limit what is possible. Animal training uses Handling; repairs use the relevant Craft.",
      ],
    ],
  ],
  [
    "physique",
    [
      [
        "athletics",
        "Athletics",
        "skills/movement/figure-running-gray.webp",
        "Running, climbing, jumping, and general bodily movement. Resolve the named obstacle and consequence. Carrying a heavy load or enduring prolonged exertion may be separate Lifting or Stamina tasks, rather than extra rolls for every movement.",
      ],
      [
        "lifting",
        "Lifting",
        "svg/lever.svg",
        "Moving, holding, or forcing a heavy load when strength is the uncertainty. Footing, leverage, assistance, and the object's strength determine whether an attempt is possible. Athletics covers movement and Stamina covers sustained exertion.",
      ],
      [
        "stamina",
        "Stamina",
        "svg/regen.svg",
        "Endurance under strain, exposure, and sustained effort. It does not supply missing rest, water, warmth, or treatment, and does not replace the base Physique attribute for damage resistance.",
      ],
      [
        "swimming",
        "Swimming",
        "svg/waterfall.svg",
        "Moving and remaining afloat in water. Current, temperature, clothing, load, and available exits define the task. Later exposure or endurance can require Stamina, but does not replace the swimming attempt.",
      ],
    ],
  ],
  [
    "knowledge",
    [
      [
        "demolition",
        "Demolition",
        "svg/explosion.svg",
        "Learned explosives work within the character's recorded professional training. Knowledge is its provisional attribute in the current working draft; a high default does not teach an unlearned procedure. Throwing remains a separate skill. The catalogue does not automate dynamite procedures.",
      ],
      [
        "medicine",
        "Medicine",
        "tools/medical/bandage-rough.webp",
        "Diagnosis and care within the practitioner's recorded training: household nursing, midwifery, medical practice, surgery, veterinary work, or another learned scope. Related experience does not grant every treatment or surgical permission. Instruments, conditions, and the patient's state matter; one roll does not also stabilize, diagnose, transport, and definitively treat a patient.",
      ],
      [
        "gunsmithing",
        "Gunsmithing",
        "skills/trades/smithing-anvil-brown.webp",
        "Firearm repair, fitting, and alteration within learned methods and available tools. Establish the particular weapon, fault, intended work, and equipment. Shooting ability does not grant repair expertise; a repair does not automatically add accuracy, a talent, or new ammunition compatibility.",
      ],
      [
        "craft",
        "Craft",
        "skills/trades/construction-carpentry-hammer.webp",
        "Work within recorded learned trades, such as wheelwright, blacksmith, carpenter, or printer. Use the rating within those established fields; it does not confer every workshop profession. Craft does not replace specialist Demolition, Gunsmithing, Lockwork, or Medicine procedures.",
      ],
      [
        "scholarship",
        "Scholarship",
        "skills/trades/academics-study-reading-book.webp",
        "Difficult written, historical, technical, scientific, or cultural knowledge within actual education and access to sources. Record languages and literacy separately. Interpreting a document does not prove its authenticity; connecting case evidence uses Investigation.",
      ],
      [
        "law",
        "Law",
        "skills/social/trading-justice-scale-gold.webp",
        "Legal knowledge within a specified jurisdiction and period, including authority, process, records, and obligations. Research can establish an unfamiliar legal environment. Knowledge does not grant office, a warrant, universal arrest powers, or compliance by officials.",
      ],
      [
        "business",
        "Business",
        "skills/trades/academics-merchant-scribe.webp",
        "Accounts, prices, contracts, provisioning, and commercial judgment. It can identify costs or discrepancies without compelling agreement. Separate negotiation may use Persuasion; skill alone supplies no customers, capital, or ownership.",
      ],
    ],
  ],
  [
    "perception",
    [
      [
        "notice",
        "Notice",
        "svg/eye.svg",
        "Catching an immediate change, suspicious movement, or relevant sensory detail. It can oppose Stealth or Sleight when detection is possible. Deliberate examination uses Search; interpretation uses Investigation. Notice does not replace base Perception initiative.",
      ],
      [
        "search",
        "Search",
        "tools/scribal/magnifying-glass.webp",
        "Deliberately examining a specified place or object with an established method and time. It locates evidence; Investigation connects it to events. Repeating an unchanged failed search is not a free reroll.",
      ],
      [
        "tracking",
        "Tracking",
        "svg/pawprint.svg",
        "Following physical traces and judging direction, passage, or changes along a trail. Surface, weather, age, traffic, and surviving evidence matter. It cannot create absent tracks or guarantee a route after the trail is lost.",
      ],
      [
        "survival",
        "Survival",
        "environment/wilderness/camp-improvised.webp",
        "Route judgment, shelter, water, weather, and field living in environments the character can reasonably understand. Actual supplies and geography constrain the choices. It does not replace Tracking or grant universal knowledge of unfamiliar country.",
      ],
      [
        "investigation",
        "Investigation",
        "skills/trades/academics-investigation-study-blue.webp",
        "Connecting testimony, documents, physical evidence, and inconsistencies to answer a precise question. Conclusions must follow the available evidence. It does not read minds, establish unsupported guilt, or replace searching for a hidden object.",
      ],
      [
        "gambling",
        "Gambling",
        "skills/trades/gaming-gambling-dice-gray.webp",
        "Informed decisions and observation within an understood wagering game. Establish stakes and possible loss before resolving play. It cannot guarantee profit from pure chance; concrete cheating or a separate false account uses the appropriate other skill.",
      ],
    ],
  ],
  [
    "presence",
    [
      [
        "persuasion",
        "Persuasion",
        "skills/social/diplomacy-handshake.webp",
        "Seeking willing agreement through reasons, offers, and a credible relationship. State the concession and why the listener could grant it. A success does not erase commitments or create permanent loyalty.",
      ],
      [
        "deception",
        "Deception",
        "svg/card-joker.svg",
        "Creating or maintaining a plausible misleading account. Known contradictory evidence or an impossible claim can prevent an attempt. Success has the stated effect for now; later evidence can expose it.",
      ],
      [
        "intimidation",
        "Intimidation",
        "skills/social/intimidation-impressing.webp",
        "Applying a credible, understood threat to obtain a specific concession. The target must have reason to fear the consequence. Compliance can harm trust or provoke retaliation; it is not permanent obedience.",
      ],
      [
        "command",
        "Command",
        "skills/social/wave-halt-stop.webp",
        "Coordinating people who have a reason to listen using a feasible instruction they can hear. It does not grant legal office, compel enemies, or make simultaneous impossible tasks possible.",
      ],
      [
        "willpower",
        "Willpower",
        "svg/shield.svg",
        "Maintaining resolve against immediate mental pressure, using Presence when unimproved. It is a skill, not a seventh attribute or physical damage resistance. The working manuscript uses it for Nerve; this catalogue does not implement the manuscript's additional mental-wound procedures.",
      ],
      [
        "performance",
        "Performance",
        "tools/instruments/lute-gold-brown.webp",
        "Holding an audience's attention through an actual learned form, such as music, stage work, recitation, or storytelling. Record the necessary instrument, language, repertoire, and experience. Entertainment does not automatically secure a separate agreement or professional technique.",
      ],
    ],
  ],
];

export const WESTERN1876_HANDLING_FIELDS = Object.freeze([
  ["horses", "Horses", "environment/creatures/horse-brown.webp"],
  ["dogs", "Dogs", "creatures/mammals/dog-husky-white-blue.webp"],
  ["cattle", "Cattle", "creatures/mammals/livestock-cow-green.webp"],
  ["sheep", "Sheep", "creatures/mammals/livestock-sheep-green.webp"],
  ["pigs", "Pigs", "creatures/mammals/livestock-pig-green.webp"],
  ["mules", "Mules", "svg/pawprint.svg"],
  ["falconry", "Falconry", "creatures/birds/raptor-hawk-flying.webp"],
  ["poultry", "Poultry", "creatures/birds/chicken-hen-white.webp"],
] as const);

function skill(
  attributeId: string,
  [key, name, icon, description]: SkillRow,
): D6SettingSkillV1 {
  return Object.freeze({
    attributeId,
    key,
    name,
    img: `icons/${icon}`,
    description: `${description} Source: 1876 working draft, Chapter 5 — ${key.startsWith("handling-") ? "Handling and Animal fields" : name}.`,
    training: "standard",
  });
}

/** Independent full skills, never bonus specializations of a universal pool. */
export const WESTERN1876_SKILLS: readonly D6SettingSkillV1[] = Object.freeze([
  ...GROUPS.flatMap(([attributeId, rows]) =>
    rows.map((row) => skill(attributeId, row)),
  ),
  ...WESTERN1876_HANDLING_FIELDS.map(([id, label, icon]) =>
    skill("presence", [
      `handling-${id}`,
      `Handling: ${label}`,
      icon,
      `Animal behavior, training, and trust within the learned ${label} field. This is an independent full skill whose total includes Presence; it is not a specialization or a bonus to universal Handling. Routine familiar care or a familiar command often needs no roll. An ordinary uncertain attempt defaults to Presence when unimproved, while demanding training requires relevant knowledge. Other animal fields and Riding do not transfer their trained ratings. Veterinary treatment requires Medicine with appropriate training. Other agreed fields can be added as separate custom skills.`,
    ]),
  ),
]);
