import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:c:/Users/regis/Desktop/Codex/vvviruzcommandcenter/storage/vvviruz-command-center.db"
    }
  }
});

test("measure and verify release cover artwork dimensions", async ({ page }) => {
  // Query a published release
  const release = await prisma.release.findFirst({
    where: { isPublished: true },
    select: { slug: true }
  });

  const slug = release?.slug || "different-modes";
  console.log(`Testing using release slug: "${slug}"`);

  // Navigate to release page
  await page.goto(`/music/${slug}`);
  const cover = page.locator("[data-release-cover]");
  await expect(cover).toBeVisible();

  // Test wide desktop capping
  await page.setViewportSize({ width: 1920, height: 800 });
  let box = await cover.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBe(542);

  // Test tablet sizes
  await page.setViewportSize({ width: 1024, height: 800 });
  box = await cover.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBe(395);

  // Clean up prisma connection
  await prisma.$disconnect();
});
