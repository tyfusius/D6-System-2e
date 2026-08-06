const ATTRIBUTE_DESCRIPTION_KEYS: Readonly<Record<string, string>> =
  Object.freeze({
    acumen: "D6E2.Tooltip.Attribute.Acumen",
    agility: "D6E2.Tooltip.Attribute.Agility",
    brawn: "D6E2.Tooltip.Attribute.Brawn",
    charisma: "D6E2.Tooltip.Attribute.Charisma",
    charm: "D6E2.Tooltip.Attribute.Charm",
    coordination: "D6E2.Tooltip.Attribute.Coordination",
    extranormal: "D6E2.Tooltip.Attribute.Extranormal",
    intellect: "D6E2.Tooltip.Attribute.Intellect",
    knowledge: "D6E2.Tooltip.Attribute.Knowledge",
    magic: "D6E2.Tooltip.Attribute.Magic",
    mechanical: "D6E2.Tooltip.Attribute.Mechanical",
    mysticism: "D6E2.Tooltip.Attribute.Mysticism",
    perception: "D6E2.Tooltip.Attribute.Perception",
    physique: "D6E2.Tooltip.Attribute.Physique",
    presence: "D6E2.Tooltip.Attribute.Presence",
    reflexes: "D6E2.Tooltip.Attribute.Reflexes",
    technical: "D6E2.Tooltip.Attribute.Technical",
  });

const CORE_SKILL_DESCRIPTION_KEYS: Readonly<Record<string, string>> =
  Object.freeze({
    acrobatics: "D6E2.Tooltip.Skill.Acrobatics",
    athletics: "D6E2.Tooltip.Skill.Athletics",
    driving: "D6E2.Tooltip.Skill.Driving",
    intimidation: "D6E2.Tooltip.Skill.Intimidation",
    investigation: "D6E2.Tooltip.Skill.Investigation",
    languages: "D6E2.Tooltip.Skill.Languages",
    medicine: "D6E2.Tooltip.Skill.Medicine",
    melee: "D6E2.Tooltip.Skill.Melee",
    scholar: "D6E2.Tooltip.Skill.Scholar",
    sciences: "D6E2.Tooltip.Skill.Sciences",
    shooting: "D6E2.Tooltip.Skill.Shooting",
    "sleight-of-hand": "D6E2.Tooltip.Skill.SleightOfHand",
    stamina: "D6E2.Tooltip.Skill.Stamina",
    stealth: "D6E2.Tooltip.Skill.Stealth",
    survival: "D6E2.Tooltip.Skill.Survival",
    throwing: "D6E2.Tooltip.Skill.Throwing",
  });

export interface CharacterTooltipI18n {
  format(key: string, data: Record<string, string>): string;
  localize(key: string): string;
}

function usableDescription(value: unknown): string {
  if (typeof value !== "string") return "";
  const description = value.trim();
  if (["", "null", "undefined"].includes(description.toLowerCase())) return "";
  return description;
}

function withRollRequest(
  description: string,
  requestedRollLabel: string,
): string {
  const request = usableDescription(requestedRollLabel);
  return request.length > 0 ? `${request}<br>${description}` : description;
}

export function characterAttributeTooltip(
  id: string,
  label: string,
  requestedRollLabel: string,
  i18n: CharacterTooltipI18n,
): string {
  const descriptionKey = ATTRIBUTE_DESCRIPTION_KEYS[id];
  const description = descriptionKey
    ? i18n.localize(descriptionKey)
    : i18n.format("D6E2.Tooltip.Attribute.Generic", { attribute: label });
  return withRollRequest(description, requestedRollLabel);
}

export function characterSkillTooltip(
  skill: {
    readonly attributeLabel: string;
    readonly description: unknown;
    readonly key: string;
    readonly name: string;
    readonly requestedRollLabel: string;
  },
  i18n: CharacterTooltipI18n,
): string {
  const storedDescription = usableDescription(skill.description);
  const descriptionKey = CORE_SKILL_DESCRIPTION_KEYS[skill.key];
  const description =
    storedDescription ||
    (descriptionKey
      ? i18n.localize(descriptionKey)
      : i18n.format("D6E2.Tooltip.Skill.Generic", {
          attribute: skill.attributeLabel,
          skill: skill.name,
        }));
  return withRollRequest(description, skill.requestedRollLabel);
}
