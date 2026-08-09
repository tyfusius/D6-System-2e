// content/fantasy-character-template-catalog.json
var fantasy_character_template_catalog_default = {
  id: "d6-system-2e.fantasy-templates",
  label: "D6 System Second Edition Fantasy Templates",
  version: 2,
  source: {
    book: "D6 System: Second Edition",
    pages: "168-171"
  },
  templates: [
    {
      id: "fantasy-occultist",
      label: "Occultist",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 168 },
      attributeScores: {
        agility: 6,
        brawn: 6,
        charm: 12,
        knowledge: 15,
        magic: 3,
        mysticism: 12,
        perception: 9
      },
      suggestedSkillKeys: [
        "arcane-world",
        "esoterica",
        "identify-magic",
        "scholar"
      ]
    },
    {
      id: "fantasy-priest",
      label: "Priest",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 169 },
      unassignedAttributeScore: 9,
      attributeScores: {
        agility: 6,
        brawn: 6,
        charm: 9,
        knowledge: 12,
        magic: 3,
        mysticism: 12,
        perception: 6
      },
      suggestedSkillKeys: ["esoterica", "prayer", "scholar", "ritual"]
    },
    {
      id: "fantasy-warrior",
      label: "Warrior",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 170 },
      attributeScores: {
        agility: 12,
        brawn: 15,
        charm: 9,
        knowledge: 9,
        magic: 3,
        mysticism: 3,
        perception: 12
      },
      suggestedSkillKeys: [
        "athletics",
        "melee",
        "shooting",
        "stamina",
        "throwing"
      ]
    },
    {
      id: "fantasy-wizard",
      label: "Wizard",
      rulesFamily: "d6-system-second-edition",
      version: 2,
      source: { book: "D6 System: Second Edition", page: 171 },
      attributeScores: {
        agility: 3,
        brawn: 6,
        charm: 9,
        knowledge: 15,
        magic: 15,
        mysticism: 6,
        perception: 9
      },
      suggestedSkillKeys: ["arcane-world", "identify-magic", "spell-school"]
    }
  ]
};

// packages/d6-system-2e-fantasy/src/main.ts
var MODULE_ID = "d6-system-2e-fantasy";
Hooks.once("ready", () => {
  const api = game.system.api;
  if (api?.apiVersion !== 2 || !api.contentPackages || !api.templates) {
    ui.notifications.warn(
      "D6 System Second Edition Fantasy requires a compatible system release."
    );
    return;
  }
  api.contentPackages.register(MODULE_ID, {
    contractVersion: 1,
    family: "fantasy",
    id: MODULE_ID,
    label: "D6 System Second Edition \u2014 Fantasy",
    mechanicIds: ["fantasy-skills-magic"],
    recommendedPrimaryProfile: "second-edition",
    recommendedSettingProfile: "d6-system-second-edition",
    rulesFamily: "d6-system-second-edition",
    version: "0.1.0-beta.8"
  });
  api.templates.register(MODULE_ID, fantasy_character_template_catalog_default);
});
//# sourceMappingURL=d6-system-2e-fantasy.mjs.map
