import { missingSkillSources } from "../content/skill-catalog";
import { currentRulesProfile } from "../settings/rules-compatibility";
import { secondEditionOptionalAttributes } from "../settings/setting-values";

export async function synchronizeActorSkills(
  actor: FoundryActorDocument,
): Promise<number> {
  if (game.user?.isGM !== true || actor.type !== "character") return 0;
  const existingKeys = new Set(
    actor.items.contents
      .filter((item) => item.type === "skill")
      .map((item) =>
        typeof item.system.key === "string" ? item.system.key : "",
      )
      .filter((key) => key.length > 0),
  );
  const profile = currentRulesProfile();
  const sources = missingSkillSources(
    existingKeys,
    profile.compatibility.firstEditionAttributes ? "open-d6" : "second-edition",
    secondEditionOptionalAttributes(),
  );
  if (sources.length === 0) return 0;
  await actor.createEmbeddedDocuments("Item", sources, {
    d6System2eCatalogSync: true,
  });
  return sources.length;
}
