import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireProjectRole } from "./lib/auth";

export const generateUploadUrl = mutation({
  args: { versionId: v.id("promptVersions") },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    await requireProjectRole(ctx, version.projectId, ["owner", "editor"]);

    return ctx.storage.generateUploadUrl();
  },
});

export const registerUploaded = mutation({
  args: {
    versionId: v.id("promptVersions"),
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");
    if (version.status !== "draft") {
      throw new Error("Can only add attachments to draft versions");
    }

    await requireProjectRole(ctx, version.projectId, ["owner", "editor"]);

    // Compute next order
    const existing = await ctx.db
      .query("promptAttachments")
      .withIndex("by_version", (q) =>
        q.eq("promptVersionId", args.versionId),
      )
      .take(50);
    const maxOrder = existing.reduce((max, a) => Math.max(max, a.order), -1);

    return ctx.db.insert("promptAttachments", {
      promptVersionId: args.versionId,
      storageId: args.storageId,
      filename: args.filename,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      order: maxOrder + 1,
    });
  },
});

export const list = query({
  args: { versionId: v.id("promptVersions") },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) return [];

    await requireProjectRole(ctx, version.projectId, ["owner", "editor"]);

    const attachments = await ctx.db
      .query("promptAttachments")
      .withIndex("by_version", (q) =>
        q.eq("promptVersionId", args.versionId),
      )
      .take(50);

    const enriched = [];
    for (const a of attachments) {
      const url = await ctx.storage.getUrl(a.storageId);
      enriched.push({ ...a, url });
    }

    return enriched.sort((a, b) => a.order - b.order);
  },
});

export const deleteAttachment = mutation({
  args: { attachmentId: v.id("promptAttachments") },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    const version = await ctx.db.get(attachment.promptVersionId);
    if (!version) throw new Error("Version not found");

    await requireProjectRole(ctx, version.projectId, ["owner", "editor"]);

    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(args.attachmentId);
  },
});

export const reorder = mutation({
  args: {
    versionId: v.id("promptVersions"),
    orderedIds: v.array(v.id("promptAttachments")),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    await requireProjectRole(ctx, version.projectId, ["owner", "editor"]);

    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i]!, { order: i });
    }
  },
});
