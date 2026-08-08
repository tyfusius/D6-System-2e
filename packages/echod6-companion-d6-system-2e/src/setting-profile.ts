import { createEchoTerminology } from "./terminology";

const ATTRIBUTES = Object.freeze([
  ["agility", "Agility", true],
  ["brawn", "Brawn", true],
  ["knowledge", "Knowledge", true],
  ["perception", "Perception", true],
  ["charm", "Charm", false],
  ["magic", "Magic", false],
  ["mechanical", "Mechanical", true],
  ["mysticism", "Mysticism", false],
  ["technical", "Technical", true],
  ["acumen", "Acumen", false],
  ["charisma", "Charisma", false],
  ["coordination", "Coordination", false],
  ["extranormal", "Extranormal", false],
  ["intellect", "Intellect", false],
  ["physique", "Physique", false],
  ["presence", "Presence", false],
  ["reflexes", "Reflexes", false],
] as const);

export function createEchoSettingProfile(localize: (key: string) => string) {
  return Object.freeze({
    attributes: Object.freeze(
      ATTRIBUTES.map(([id, label, active]) =>
        Object.freeze({ active, id, label }),
      ),
    ),
    description: "Echo D6 character vocabulary and presentation.",
    id: "echo-d6",
    label: "Echo D6",
    logo: "modules/echod6-companion-d6-system-2e/art/branding/echo-logo.png",
    logoAsWatermark: true,
    originRulesFamily: "open-d6-first-edition" as const,
    skills: Object.freeze([]),
    terminology: createEchoTerminology(localize),
    version: 2 as const,
    wildDie: Object.freeze({
      one: Object.freeze({ kind: "text" as const, value: "1" }),
      oneSound: "systems/d6-system-2e/assets/audio/wild-one.mp3",
      six: Object.freeze({
        kind: "image" as const,
        value: "modules/echod6-companion-d6-system-2e/art/dice/echo-six.png",
      }),
      sixSound: "systems/d6-system-2e/assets/audio/wild-six.mp3",
    }),
  });
}
