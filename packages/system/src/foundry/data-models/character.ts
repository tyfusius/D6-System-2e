import { migrationField, pipScoreField } from "./fields";
import { convertLegacyAttributeScores } from "../../migrations/003-canonical-pip-scores";
import { addFirstEditionResourceFields } from "../../migrations/004-add-first-edition-resources";
import { addSecondEditionAdvancementFields } from "../../migrations/009-add-second-edition-advancement";
import { addSecondEditionAdvancementWorkflows } from "../../migrations/013-add-second-edition-advancement-workflows";
import { addMovementAndScale } from "../../migrations/014-add-movement-and-scale";
import { addBaseMove } from "../../migrations/016-add-base-move";
import { addFirstEditionWounds } from "../../migrations/017-add-first-edition-wounds";
import { addFirstEditionInjuryState } from "../../migrations/018-add-first-edition-injury-state";

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
    addMovementAndScale({
      items: [],
      system: source,
      type: "character",
    });
    addBaseMove({ items: [], system: source, type: "character" });
    addFirstEditionWounds({ items: [], system: source, type: "character" });
    addFirstEditionInjuryState({
      items: [],
      system: source,
      type: "character",
    });
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
              choices: ["attribute", "skill"],
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
              min: 3,
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
      }),
      defenses: new SchemaField({
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
