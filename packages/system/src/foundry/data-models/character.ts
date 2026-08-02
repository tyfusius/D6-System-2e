import { migrationField, pipScoreField } from "./fields";
import { convertLegacyAttributeScores } from "../../migrations/003-canonical-pip-scores";
import { addFirstEditionResourceFields } from "../../migrations/004-add-first-edition-resources";
import { addSecondEditionAdvancementFields } from "../../migrations/009-add-second-edition-advancement";
import { addSecondEditionAdvancementWorkflows } from "../../migrations/013-add-second-edition-advancement-workflows";
import { addMovementAndScale } from "../../migrations/014-add-movement-and-scale";
import { addBaseMove } from "../../migrations/016-add-base-move";
import { addFirstEditionWounds } from "../../migrations/017-add-first-edition-wounds";
import { addFirstEditionInjuryState } from "../../migrations/018-add-first-edition-injury-state";
import { addFirstEditionMortalityClock } from "../../migrations/019-add-first-edition-mortality-clock";
import { addEnvironmentEffects } from "../../migrations/020-add-environment-effects";
import { addFirstEditionBodyPoints } from "../../migrations/023-add-first-edition-body-points";
import { addFirstEditionAccumulatingStuns } from "../../migrations/024-add-first-edition-accumulating-stuns";
import { addCharacterTemplateState } from "../../migrations/025-add-character-template-state";
import { addMagicPointsResource } from "../../migrations/027-add-magic-points-and-autofire";
import { addBestiaryProvenance } from "../../migrations/028-add-bestiary-provenance";
import { addDodgeBasis } from "../../migrations/029-add-dodge-basis";
import { addPsionicsState } from "../../migrations/031-add-psionics-state";
import { addCyberpunkState } from "../../migrations/032-add-cyberpunk-state";

const {
  ArrayField,
  BooleanField,
  HTMLField,
  NumberField,
  SchemaField,
  StringField,
} = foundry.data.fields;

export class CharacterDataModel extends foundry.abstract.TypeDataModel {
  static migrateData(source: Record<string, unknown>): Record<string, unknown> {
    convertLegacyAttributeScores(source);
    addFirstEditionResourceFields({
      items: [],
      system: source,
      type: "character",
    });
    addSecondEditionAdvancementFields({
      items: [],
      system: source,
      type: "character",
    });
    addSecondEditionAdvancementWorkflows({
      items: [],
      system: source,
      type: "character",
    });
    const hadMovement = Object.hasOwn(source, "movement");
    const hadScale = Object.hasOwn(source, "scale");
    addMovementAndScale({
      items: [],
      system: source,
      type: "character",
    });
    // Foundry also invokes migrateData for partial document updates. Keep
    // schema defaults out of an unrelated update delta so editing one field
    // cannot overwrite already-persisted movement or scale values.
    if (!hadMovement) delete source.movement;
    if (!hadScale) delete source.scale;
    addBaseMove({ items: [], system: source, type: "character" });
    addFirstEditionWounds({ items: [], system: source, type: "character" });
    addFirstEditionInjuryState({
      items: [],
      system: source,
      type: "character",
    });
    addFirstEditionMortalityClock({
      items: [],
      system: source,
      type: "character",
    });
    addEnvironmentEffects({ items: [], system: source, type: "character" });
    addFirstEditionBodyPoints({ items: [], system: source, type: "character" });
    addFirstEditionAccumulatingStuns({
      items: [],
      system: source,
      type: "character",
    });
    addCharacterTemplateState({ items: [], system: source, type: "character" });
    addMagicPointsResource({ items: [], system: source, type: "character" });
    if (Object.hasOwn(source, "defenses")) {
      addDodgeBasis({ items: [], system: source, type: "character" });
    }
    const hadPsionics = Object.hasOwn(source, "psionics");
    addPsionicsState({ items: [], system: source, type: "character" });
    if (!hadPsionics) delete source.psionics;
    const hadCyberpunk = Object.hasOwn(source, "cyberpunk");
    addCyberpunkState({ items: [], system: source, type: "character" });
    if (!hadCyberpunk) delete source.cyberpunk;
    return source;
  }

  static defineSchema(): Record<string, object> {
    return {
      _migration: migrationField(),
      attributes: new SchemaField({
        agility: pipScoreField(3, 3, 15),
        brawn: pipScoreField(3, 3, 15),
        charm: pipScoreField(0, 0, 15),
        knowledge: pipScoreField(3, 3, 15),
        magic: pipScoreField(0, 0, 15),
        mechanical: pipScoreField(0, 0, 15),
        mysticism: pipScoreField(0, 0, 15),
        perception: pipScoreField(3, 3, 15),
        technical: pipScoreField(0, 0, 15),
      }),
      biography: new HTMLField({
        initial: "",
        nullable: false,
        required: true,
      }),
      cyberpunk: new SchemaField({
        hardening: new SchemaField({
          combatId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          untilRound: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
          untilTurn: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
      }),
      bestiary: new SchemaField({
        applied: new BooleanField({
          initial: false,
          nullable: false,
          required: true,
        }),
        catalogId: new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        entryId: new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        label: new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        ownerId: new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        sourceBook: new StringField({
          initial: "",
          nullable: false,
          required: true,
        }),
        sourcePage: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
        version: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
      }),
      advancement: new SchemaField({
        milestone: new SchemaField({
          attributeDice: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
          skillPips: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
        narrativeArcs: new ArrayField(
          new SchemaField({
            id: new StringField({
              initial: "",
              nullable: false,
              required: true,
            }),
            rewardId: new StringField({
              initial: "",
              nullable: false,
              required: true,
            }),
            rewardKind: new StringField({
              choices: ["attribute", "perk", "skill"],
              initial: "skill",
              nullable: false,
              required: true,
            }),
            rewardName: new StringField({
              initial: "",
              nullable: false,
              required: true,
            }),
            status: new StringField({
              choices: ["draft", "approved", "completed"],
              initial: "draft",
              nullable: false,
              required: true,
            }),
            steps: new ArrayField(
              new SchemaField({
                complete: new BooleanField({
                  initial: false,
                  nullable: false,
                  required: true,
                }),
                description: new StringField({
                  initial: "",
                  nullable: false,
                  required: true,
                }),
                id: new StringField({
                  initial: "",
                  nullable: false,
                  required: true,
                }),
              }),
              { initial: [], nullable: false, required: true },
            ),
            targetScore: new NumberField({
              initial: 3,
              integer: true,
              min: 1,
              nullable: false,
              required: true,
            }),
            title: new StringField({
              initial: "",
              nullable: false,
              required: true,
            }),
          }),
          { initial: [], nullable: false, required: true },
        ),
      }),
      creation: new SchemaField({
        active: new BooleanField({
          initial: false,
          nullable: false,
          required: true,
        }),
        specializationSlots: new NumberField({
          choices: [0, 3],
          initial: 0,
          integer: true,
          nullable: false,
          required: true,
        }),
        template: new SchemaField({
          applied: new BooleanField({
            initial: false,
            nullable: false,
            required: true,
          }),
          catalogId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          label: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          ownerId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          sourceBook: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          sourcePage: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
          suggestedSkillKeys: new ArrayField(
            new StringField({ nullable: false, required: true }),
            { initial: [], nullable: false, required: true },
          ),
          templateId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          version: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
      }),
      defenses: new SchemaField({
        dodgeBasis: new StringField({
          choices: ["perception", "flying"],
          initial: "perception",
          nullable: false,
          required: true,
        }),
        dodgeOverride: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
        parryOverride: new NumberField({
          initial: 0,
          integer: true,
          min: 0,
          nullable: false,
          required: true,
        }),
      }),
      environment: new SchemaField({
        active: new BooleanField({
          initial: false,
          nullable: false,
          required: true,
        }),
        appliedCondition: new StringField({
          choices: [
            "none",
            "healthy",
            "staggered",
            "stunned",
            "wounded",
            "incapacitated",
            "mortally-wounded",
            "dead",
          ],
          initial: "none",
          nullable: false,
          required: true,
        }),
        difficulty: new NumberField({
          choices: [0, 15, 20, 30],
          initial: 0,
          integer: true,
          nullable: false,
          required: true,
        }),
        halfMove: new BooleanField({
          initial: false,
          nullable: false,
          required: true,
        }),
        hazard: new StringField({
          choices: ["none", "cold", "drowning", "heat", "poisonous-air"],
          initial: "none",
          nullable: false,
          required: true,
        }),
        penaltyScore: new NumberField({
          choices: [0, 3, 6],
          initial: 0,
          integer: true,
          nullable: false,
          required: true,
        }),
        previousCondition: new StringField({
          choices: [
            "healthy",
            "staggered",
            "stunned",
            "wounded",
            "incapacitated",
            "mortally-wounded",
            "dead",
          ],
          initial: "healthy",
          nullable: false,
          required: true,
        }),
        severity: new StringField({
          choices: ["none", "moderate", "severe", "deadly"],
          initial: "none",
          nullable: false,
          required: true,
        }),
        sourcePage: new NumberField({
          choices: [0, 77, 78],
          initial: 0,
          integer: true,
          nullable: false,
          required: true,
        }),
        version: new NumberField({
          choices: [1],
          initial: 1,
          integer: true,
          nullable: false,
          required: true,
        }),
      }),
      health: new SchemaField({
        condition: new StringField({
          choices: [
            "healthy",
            "staggered",
            "stunned",
            "wounded",
            "incapacitated",
            "mortally-wounded",
            "dead",
          ],
          initial: "healthy",
          nullable: false,
          required: true,
        }),
        firstEditionWound: new StringField({
          choices: [
            "healthy",
            "stunned",
            "wounded",
            "severely-wounded",
            "incapacitated",
            "mortally-wounded",
            "dead",
          ],
          initial: "healthy",
          nullable: false,
          required: true,
        }),
        firstEditionBodyPoints: new SchemaField({
          current: new NumberField({
            initial: 0,
            integer: true,
            nullable: false,
            required: true,
          }),
          maximum: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
        firstEditionStuns: new SchemaField({
          version: new NumberField({
            initial: 1,
            integer: true,
            min: 1,
            nullable: false,
            required: true,
          }),
          total: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
          penaltyDice: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            max: 2,
            nullable: false,
            required: true,
          }),
          roundsRemaining: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
          lastProcessedRoundId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
        }),
        firstEditionState: new SchemaField({
          consciousness: new StringField({
            choices: ["conscious", "unconscious", "unresolved"],
            initial: "conscious",
            nullable: false,
            required: true,
          }),
          source: new StringField({
            choices: ["none", "stun", "incapacitated", "mortally-wounded"],
            initial: "none",
            nullable: false,
            required: true,
          }),
          stunWound: new StringField({
            choices: [
              "none",
              "stunned",
              "wounded",
              "severely-wounded",
              "incapacitated",
            ],
            initial: "none",
            nullable: false,
            required: true,
          }),
          unconsciousMinutes: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
          mortalityCheckId: new StringField({
            initial: "",
            nullable: false,
            required: true,
          }),
          mortalityRounds: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
      }),
      movement: new SchemaField({
        base: new NumberField({
          initial: 10,
          integer: true,
          min: 1,
          nullable: false,
          required: true,
        }),
        posture: new StringField({
          choices: ["standing", "prone"],
          initial: "standing",
          nullable: false,
          required: true,
        }),
      }),
      psionics: new SchemaField({
        attempts: new ArrayField(
          new SchemaField({
            powerId: new StringField({
              initial: "",
              nullable: false,
              required: true,
            }),
            worldTime: new NumberField({
              initial: 0,
              min: 0,
              nullable: false,
              required: true,
            }),
          }),
          { initial: [], nullable: false, required: true },
        ),
      }),
      resources: new SchemaField({
        experiencePoints: new SchemaField({
          value: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
        characterPoints: new SchemaField({
          value: new NumberField({
            initial: 5,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
        fatePoints: new SchemaField({
          value: new NumberField({
            initial: 1,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
        heroPoints: new SchemaField({
          value: new NumberField({
            initial: 1,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
        magicPoints: new SchemaField({
          initialized: new BooleanField({
            initial: false,
            nullable: false,
            required: true,
          }),
          value: new NumberField({
            initial: 0,
            integer: true,
            min: 0,
            nullable: false,
            required: true,
          }),
        }),
      }),
      sheetMode: new SchemaField({
        value: new StringField({
          choices: ["normal", "advance", "freeedit"],
          initial: "normal",
          nullable: false,
          required: true,
        }),
      }),
      scale: new NumberField({
        initial: 0,
        integer: true,
        max: 6,
        min: 0,
        nullable: false,
        required: true,
      }),
    };
  }
}

export class CreatureDataModel extends CharacterDataModel {
  static override migrateData(
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    super.migrateData(source);
    if (Object.hasOwn(source, "bestiary")) {
      addBestiaryProvenance({ items: [], system: source, type: "creature" });
    }
    return source;
  }

  static override defineSchema(): Record<string, object> {
    return {
      ...super.defineSchema(),
      attributes: new SchemaField({
        agility: pipScoreField(3, 3),
        brawn: pipScoreField(3, 3),
        charm: pipScoreField(0),
        knowledge: pipScoreField(3, 3),
        magic: pipScoreField(0),
        mechanical: pipScoreField(0),
        mysticism: pipScoreField(0),
        perception: pipScoreField(3, 3),
        technical: pipScoreField(0),
      }),
    };
  }
}
