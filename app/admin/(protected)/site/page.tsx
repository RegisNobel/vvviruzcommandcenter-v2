
import {ReleaseCategorySettingsPanel} from "@/components/release-category-settings-panel";
import {SiteSettingsEditor} from "@/components/site-settings-editor";
import {AppearsOnSettingsPanel} from "@/components/appears-on-settings-panel";
import {LinkHubsSettingsPanel} from "@/components/link-hubs-settings-panel";
import {PlaylistsSettingsPanel} from "@/components/playlists-settings-panel";
import {listReleaseCategories} from "@/lib/repositories/release-categories";
import {readAllAppearsOn} from "@/lib/repositories/appears-on";
import {readReleaseSummaries} from "@/lib/repositories/releases";
import {readSiteSettings} from "@/lib/repositories/site-settings";
import {readLinkHubs} from "@/lib/repositories/link-hubs";
import {readPlaylists} from "@/lib/repositories/playlists";
import {
  listExclusiveArtFiles,
  listExclusiveTrackFiles,
  listSiteIconFiles
} from "@/lib/server/storage";

export default async function AdminSitePage() {
  const [
    siteSettings,
    releaseSummaries,
    releaseCategories,
    siteIconOptions,
    exclusiveTrackFileOptions,
    exclusiveTrackArtOptions,
    appearsOnRecords,
    linkHubs,
    playlists
  ] = await Promise.all([
    readSiteSettings(),
    readReleaseSummaries(),
    listReleaseCategories(),
    listSiteIconFiles(),
    listExclusiveTrackFiles(),
    listExclusiveArtFiles(),
    readAllAppearsOn(),
    readLinkHubs(),
    readPlaylists({ archiveStatus: "active" })
  ]);

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <SiteSettingsEditor
          exclusiveTrackArtOptions={exclusiveTrackArtOptions}
          exclusiveTrackFileOptions={exclusiveTrackFileOptions}
          initialSiteSettings={siteSettings}
          releaseOptions={releaseSummaries}
          siteIconOptions={siteIconOptions}
        />

        <LinkHubsSettingsPanel
          initialHubs={linkHubs}
          releaseOptions={releaseSummaries}
        />

        <PlaylistsSettingsPanel
          initialPlaylists={playlists}
        />

        <ReleaseCategorySettingsPanel
          initialCategories={releaseCategories}
          releaseOptions={releaseSummaries}
        />

        <AppearsOnSettingsPanel records={appearsOnRecords} />
      </div>
    </main>
  );
}
