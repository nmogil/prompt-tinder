import { internalMutation } from "../_generated/server";

export const migrate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const versions = await ctx.db
      .query("promptVersions")
      .take(1000);
    let count = 0;
    for (const v of versions) {
      if ((v.status as string) === "active") {
        await ctx.db.patch(v._id, { status: "current" });
        count++;
      }
    }
    return { migrated: count };
  },
});
