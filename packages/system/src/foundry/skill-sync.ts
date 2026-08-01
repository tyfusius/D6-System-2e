import { missingSkillSources } from "../content/skill-catalog";
import { currentRulesProfile } from "../settings/rules-compatibility";
import { campaignOptionalAttributeIds } from "../settings/campaign-profile";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";

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
  const campaign = currentSecondEditionCampaignProfile();
  const sources = missingSkillSources(
    existingKeys,
    profile.compatibility.firstEditionAttributes ? "open-d6" : "second-edition",
    campaignOptionalAttributeIds(),
    new Set([
      ...(campaign.fantasySkills ? ["fantasy"] : []),
      ...(campaign.freeformSkillBasedMagic ? ["freeform-magic"] : []),
      ...(campaign.magicPointsCasting ? ["magic-points"] : []),
    ]),
  );
  if (sources.length === 0) return 0;
  await actor.createEmbeddedDocuments("Item", sources, {
    d6System2eCatalogSync: true,
  });
  return sources.length;
}
