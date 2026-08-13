import { describe, expect, it } from "vitest";
import {
  canonicalLegacyExtraordinaryPowerActors,
  type LegacyExtraordinaryPowerActorMapping,
} from "./legacy-extraordinary-power-actors";
import type {
  LegacyWorldExportRecord,
  LegacyWorldSource,
} from "./legacy-world-import";

const SOURCE: LegacyWorldSource = {
  coreVersion: "14.365",
  system: "od6s-next",
  systemVersion: "2.0.0-alpha.2",
  worldId: "fixture",
};
const MAPPING: LegacyExtraordinaryPowerActorMapping = {
  actorMarkerPaths: ["system.forceUser.value"],
  consequenceResources: [
    { paths: ["system.custom1.value"], resourceRoleId: "dark-side-points" },
  ],
  frameworkId: "test.force",
  ignoredManifestationNames: ["Choose a power"],
  powers: [
    {
      id: "force.focus",
      maintenance: "active-toggle",
      names: ["Focus"],
      sourceIds: ["PowerSource0001"],
    },
  ],
  skillRoles: [
    { itemKeys: ["force-control"], names: ["Control"], roleId: "control" },
  ],
};

function actorRecords(): LegacyWorldExportRecord[] {
  return [
    {
      collection: "actors",
      key: "!actors!ForceActor000001",
      value: {
        _id: "ForceActor000001",
        system: { custom1: { value: 3 }, forceUser: { value: true } },
        type: "character",
      },
    },
    {
      collection: "actors",
      key: "!actors.items!ForceActor000001.SkillItem000001",
      value: {
        _id: "SkillItem000001",
        name: "Control",
        system: { attribute: "met" },
        type: "skill",
      },
    },
    {
      collection: "actors",
      key: "!actors.items!ForceActor000001.PowerItem000001",
      value: {
        _id: "PowerItem000001",
        flags: { core: { sourceId: "Compendium.fixture.PowerSource0001" } },
        name: "Renamed Focus",
        system: { active: true },
        type: "manifestation",
      },
    },
    {
      collection: "actors",
      key: "!actors.items!ForceActor000001.Instruction0001",
      value: {
        _id: "Instruction0001",
        name: "Choose a power",
        system: {},
        type: "manifestation",
      },
    },
  ];
}

describe("canonical legacy extraordinary-power Actors", () => {
  it("projects bindings, consequences, and maintained state without writes", () => {
    const report = canonicalLegacyExtraordinaryPowerActors(
      SOURCE,
      actorRecords(),
      MAPPING,
    );
    expect(report).toMatchObject({
      dryRun: true,
      summary: {
        actors: 1,
        consequenceValues: 1,
        exact: 1,
        ignoredManifestations: 1,
        maintainedPowers: 1,
        powerBindings: 1,
        skillBindings: 1,
        unresolved: 0,
      },
      targetWrites: 0,
    });
    expect(report.rows[0]?.target).toEqual({
      consequenceValues: { "dark-side-points": 3 },
      frameworkId: "test.force",
      maintainedPowerIds: ["force.focus"],
      powerBindings: { "force.focus": "PowerItem000001" },
      skillBindings: { control: "SkillItem000001" },
    });
  });

  it("reports unknown powers and duplicate roles instead of guessing", () => {
    const records = [
      ...actorRecords(),
      {
        collection: "actors" as const,
        key: "!actors.items!ForceActor000001.SkillItem000002",
        value: { _id: "SkillItem000002", name: "Control", type: "skill" },
      },
      {
        collection: "actors" as const,
        key: "!actors.items!ForceActor000001.UnknownPower0001",
        value: {
          _id: "UnknownPower0001",
          name: "Uncatalogued Power",
          system: { active: true },
          type: "manifestation",
        },
      },
    ];
    const row = canonicalLegacyExtraordinaryPowerActors(
      SOURCE,
      records,
      MAPPING,
    ).rows[0];
    expect(row?.status).toBe("unresolved");
    expect(row?.notes).toEqual(
      expect.arrayContaining([
        "unresolved:duplicate-skill-role:control",
        "unresolved:unknown-manifestation:UnknownPower0001",
      ]),
    );
    expect(row?.target.skillBindings).toEqual({});
  });

  it("is byte-stable for repeated dry runs", () => {
    expect(
      JSON.stringify(
        canonicalLegacyExtraordinaryPowerActors(
          SOURCE,
          actorRecords(),
          MAPPING,
        ),
      ),
    ).toBe(
      JSON.stringify(
        canonicalLegacyExtraordinaryPowerActors(
          SOURCE,
          actorRecords(),
          MAPPING,
        ),
      ),
    );
  });
});
