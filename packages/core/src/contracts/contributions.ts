export interface D6System2eTerminologyContribution {
  readonly attributes?: Readonly<Record<string, string>>;
  readonly characterSheetLabel?: string;
  readonly resources?: Readonly<{
    readonly characterPoints?: string;
    readonly fatePoints?: string;
    readonly heroPoints?: string;
  }>;
  readonly systemLabel?: string;
}

export interface D6System2eResolvedTerminology {
  readonly attributes: Readonly<Record<string, string>>;
  readonly characterSheetLabel?: string;
  readonly resources: Readonly<{
    readonly characterPoints?: string;
    readonly fatePoints?: string;
    readonly heroPoints?: string;
  }>;
  readonly systemLabel?: string;
}

export interface D6System2eThemeDiceDefinition {
  readonly body: string;
  readonly colorsetId: string;
  readonly edge: string;
  readonly face: string;
  readonly name: string;
  readonly systemId: string;
  readonly wildDieLabels?: readonly string[];
}

export interface D6System2eThemeDefinition {
  readonly cssClass: string;
  readonly dice?: D6System2eThemeDiceDefinition;
  readonly id: string;
  readonly label: string;
  readonly tokens: Readonly<{
    readonly accent: string;
    readonly accentBright: string;
    readonly background: string;
    readonly muted: string;
    readonly text: string;
  }>;
}

export interface D6System2eTerminologyRegistry {
  current(): D6System2eResolvedTerminology;
  register(
    ownerId: string,
    contribution: D6System2eTerminologyContribution,
  ): void;
  unregisterOwner(ownerId: string): void;
}

export interface D6System2eThemeRegistry {
  current(): readonly D6System2eThemeDefinition[];
  register(ownerId: string, definition: D6System2eThemeDefinition): void;
  unregisterOwner(ownerId: string): void;
}
