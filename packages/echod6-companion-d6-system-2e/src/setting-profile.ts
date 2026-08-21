import { createEchoTerminology } from "./terminology";

const ATTRIBUTES = Object.freeze([
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
  ["reflexes", "Reflexes"],
] as const);

export function createEchoSettingProfile(localize: (key: string) => string) {
  return Object.freeze({
    attributes: Object.freeze(
      ATTRIBUTES.map(([id, label]) => Object.freeze({ id, label })),
    ),
    description: "Echo D6 character vocabulary and presentation.",
    healthLabels: Object.freeze({}),
    id: "echo-d6",
    label: "Echo D6",
    logo: "modules/echod6-companion-d6-system-2e/art/branding/echo-logo.png",
    logoAsWatermark: true,
    originRulesFamily: "d6-system-second-edition" as const,
    skills: Object.freeze([]),
    terminology: createEchoTerminology(localize),
    version: 5 as const,
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
