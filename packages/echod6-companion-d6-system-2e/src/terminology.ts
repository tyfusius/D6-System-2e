export interface EchoTerminology {
  readonly attributes: Readonly<Record<string, string>>;
  readonly characterSheetLabel: string;
  readonly details: Readonly<{
    readonly allegiance: string;
    readonly currency: string;
  }>;
  readonly machines: Readonly<{
    readonly interstellarDrive: string;
    readonly starshipToughness: string;
    readonly vehicleToughness: string;
  }>;
  readonly manifestations: Readonly<{
    readonly plural: string;
    readonly singular: string;
  }>;
  readonly metaphysics: Readonly<{
    readonly attribute: string;
    readonly extranormal: string;
    readonly skills: Readonly<{
      readonly channel: string;
      readonly sense: string;
      readonly transform: string;
    }>;
  }>;
  readonly resources: Readonly<{ readonly fatePoints: string }>;
  readonly systemLabel: string;
}

export function createEchoTerminology(
  localize: (key: string) => string,
): EchoTerminology {
  return Object.freeze({
    attributes: Object.freeze({
      agility: "Agility",
      mysticism: localize("ECHOD6.EchoResonance"),
    }),
    characterSheetLabel: localize("ECHOD6.CharacterSheet"),
    details: Object.freeze({
      allegiance: localize("ECHOD6.Allegiance"),
      currency: localize("ECHOD6.Credits"),
    }),
    machines: Object.freeze({
      interstellarDrive: localize("ECHOD6.SlipstreamDrive"),
      starshipToughness: localize("ECHOD6.StarshipToughness"),
      vehicleToughness: localize("ECHOD6.VehicleToughness"),
    }),
    manifestations: Object.freeze({
      plural: localize("ECHOD6.EchoPowers"),
      singular: localize("ECHOD6.EchoPower"),
    }),
    metaphysics: Object.freeze({
      attribute: localize("ECHOD6.EchoResonance"),
      extranormal: localize("ECHOD6.Resonance"),
      skills: Object.freeze({
        channel: localize("ECHOD6.Harmonize"),
        sense: localize("ECHOD6.Attune"),
        transform: localize("ECHOD6.Project"),
      }),
    }),
    resources: Object.freeze({
      fatePoints: localize("ECHOD6.EchoPoints"),
    }),
    systemLabel: localize("ECHOD6.Title"),
  });
}
