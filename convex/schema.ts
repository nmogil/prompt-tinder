import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  ...authTables,
  // M1: organizations, organizationMembers, projects, projectCollaborators
  // M2: projectVariables, testCases, promptVersions, promptAttachments
  // M3: openRouterKeys, promptRuns, runOutputs
  // M4: outputFeedback, promptFeedback
  // M5: optimizationRequests
});

export default schema;
