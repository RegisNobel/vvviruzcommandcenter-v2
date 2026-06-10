import {revalidateTag} from "next/cache";
import {NextResponse} from "next/server";

import {prisma} from "@/lib/db/prisma";
import {PUBLIC_CACHE_TAGS} from "@/lib/public-cache-tags";
import {deleteLinkHub, readLinkHubs} from "@/lib/repositories/link-hubs";
import {createId} from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hubs = await readLinkHubs();
    return NextResponse.json(hubs);
  } catch (error) {
    console.error("Failed to read link hubs:", error);
    return NextResponse.json({message: "Failed to read link hubs."}, {status: 500});
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {id, path, releaseId, isEnabled, showInPublicNav, label, sortOrder} = body;

    if (!path) {
      return NextResponse.json({message: "Path is required."}, {status: 400});
    }

    let cleanPath = path.replace(/^\//, "").trim();

    // V1 only supports paths matching ^links[0-9]*$
    if (!/^links[0-9]*$/.test(cleanPath)) {
      return NextResponse.json(
        {message: "Path must match the format 'links[0-9]*' (e.g. links, links2)."},
        {status: 400}
      );
    }

    const isPrimaryLinks = cleanPath === "links";

    // Primary /links hub validations
    const finalIsEnabled = isPrimaryLinks ? true : Boolean(isEnabled);
    const finalShowInPublicNav = isPrimaryLinks ? true : Boolean(showInPublicNav);

    // /links2+ should require an assigned release to render correctly when enabled
    if (!isPrimaryLinks && finalIsEnabled && !releaseId) {
      return NextResponse.json(
        {message: "An assigned release is required to enable campaign link hubs."},
        {status: 400}
      );
    }

    // Ensure path uniqueness
    const activeHubId = id || "new";
    const existingWithPath = await prisma.linkHub.findUnique({
      where: {path: cleanPath}
    });

    if (existingWithPath && existingWithPath.id !== activeHubId) {
      return NextResponse.json(
        {message: `A link hub with the path '/${cleanPath}' already exists.`},
        {status: 400}
      );
    }

    // If id is provided, ensure we are not trying to change /links path
    if (activeHubId !== "new") {
      const current = await prisma.linkHub.findUnique({
        where: {id: activeHubId}
      });
      if (current && current.path === "links" && cleanPath !== "links") {
        return NextResponse.json(
          {message: "The path for the primary /links hub cannot be modified."},
          {status: 400}
        );
      }
    }

    const now = new Date();
    const record = await prisma.linkHub.upsert({
      where: {id: activeHubId === "new" ? createId() : activeHubId},
      create: {
        id: activeHubId === "new" ? createId() : activeHubId,
        path: cleanPath,
        releaseId: releaseId || null,
        isEnabled: finalIsEnabled,
        showInPublicNav: finalShowInPublicNav,
        label: label || null,
        sortOrder: Number(sortOrder) || 0,
        createdAt: now,
        updatedAt: now
      },
      update: {
        path: cleanPath,
        releaseId: releaseId || null,
        isEnabled: finalIsEnabled,
        showInPublicNav: finalShowInPublicNav,
        label: label || null,
        sortOrder: Number(sortOrder) || 0,
        updatedAt: now
      }
    });

    revalidateTag(PUBLIC_CACHE_TAGS.siteSettings);

    return NextResponse.json({ok: true, record});
  } catch (error) {
    console.error("Failed to upsert link hub:", error);
    return NextResponse.json({message: "Failed to save link hub."}, {status: 500});
  }
}

export async function DELETE(request: Request) {
  try {
    const {searchParams} = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({message: "ID is required."}, {status: 400});
    }

    await deleteLinkHub(id);

    revalidateTag(PUBLIC_CACHE_TAGS.siteSettings);

    return NextResponse.json({ok: true});
  } catch (error: any) {
    console.error("Failed to delete link hub:", error);
    return NextResponse.json({message: error.message || "Failed to delete link hub."}, {status: 500});
  }
}
