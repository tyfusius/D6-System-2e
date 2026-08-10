// content/core-character-template-catalog.json
var core_character_template_catalog_default = {
  id: "d6-system-2e.core-templates",
  label: "D6 System Second Edition Core Templates",
  version: 2,
  source: {
    book: "D6 System: Second Edition",
    pages: "138-139"
  },
  templates: [
    {
      id: "core-athlete",
      label: "Athlete",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 138 },
      attributeScores: {
        agility: 15,
        brawn: 12,
        knowledge: 3,
        perception: 6
      },
      suggestedSkillKeys: ["acrobatics", "athletics", "stamina"]
    },
    {
      id: "core-brawler",
      label: "Brawler",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 138 },
      attributeScores: {
        agility: 9,
        brawn: 15,
        knowledge: 3,
        perception: 9
      },
      suggestedSkillKeys: ["athletics", "melee", "stamina"]
    },
    {
      id: "core-doctor",
      label: "Doctor",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 138 },
      attributeScores: {
        agility: 9,
        brawn: 9,
        knowledge: 12,
        perception: 6
      },
      suggestedSkillKeys: ["medicine", "sciences", "scholar"]
    },
    {
      id: "core-driver",
      label: "Driver",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 139 },
      attributeScores: {
        agility: 9,
        brawn: 6,
        knowledge: 9,
        perception: 12
      },
      suggestedSkillKeys: ["driving", "sciences", "stamina"]
    },
    {
      id: "core-jack-of-all-trades",
      label: "Jack of all Trades",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 139 },
      attributeScores: {
        agility: 9,
        brawn: 9,
        knowledge: 9,
        perception: 9
      },
      suggestedSkillKeys: []
    },
    {
      id: "core-thief",
      label: "Thief",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 139 },
      attributeScores: {
        agility: 12,
        brawn: 6,
        knowledge: 6,
        perception: 12
      },
      suggestedSkillKeys: ["acrobatics", "sleight-of-hand", "stealth"]
    },
    {
      id: "core-investigator",
      label: "Investigator",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 139 },
      attributeScores: {
        agility: 6,
        brawn: 6,
        knowledge: 9,
        perception: 15
      },
      suggestedSkillKeys: ["investigation", "languages", "stealth"]
    },
    {
      id: "core-scholar",
      label: "Scholar",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 139 },
      attributeScores: {
        agility: 9,
        brawn: 6,
        knowledge: 15,
        perception: 6
      },
      suggestedSkillKeys: ["languages", "scholar", "sciences"]
    },
    {
      id: "core-veteran",
      label: "Veteran",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 139 },
      attributeScores: {
        agility: 12,
        brawn: 12,
        knowledge: 6,
        perception: 6
      },
      suggestedSkillKeys: ["athletics", "melee", "shooting"]
    }
  ]
};

// packages/d6-system-2e-core-content/src/main.ts
var MODULE_ID = "d6-system-2e-core-content";
Hooks.once("ready", () => {
  const api = game.system.api;
  if (api?.apiVersion !== 2 || !api.contentPackages || !api.templates) {
    ui.notifications.warn(
      "D6 System Second Edition Core Content requires a compatible system release."
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "core",
    id: MODULE_ID,
    label: "D6 System Second Edition \u2014 Core Content",
    mechanicIds: [],
    recommendedPrimaryProfile: "second-edition",
    recommendedSettingProfile: "d6-system-second-edition",
    rulesFamily: "d6-system-second-edition",
    version: "0.1.0-beta.9"
  });
  api.templates.register(MODULE_ID, core_character_template_catalog_default);
});
//# sourceMappingURL=d6-system-2e-core-content.mjs.map
