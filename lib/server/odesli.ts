export type OdesliResolution = {
  title: string;
  artists: string;
  coverArtUrl: string;
  spotifyUrl: string;
  appleMusicUrl: string;
  youtubeMusicUrl: string;
  youtubeUrl: string;
};

export async function resolveOdesliLinks(url: string): Promise<OdesliResolution | null> {
  try {
    const targetUrl = new URL(url).toString();
    const encodedUrl = encodeURIComponent(targetUrl);
    const apiEndpoint = `https://api.song.link/v1-alpha.1/links?url=${encodedUrl}`;

    const response = await fetch(apiEndpoint, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const primaryId = data.entityUniqueId;
    const entity = data.entitiesByUniqueId[primaryId];

    if (!entity) {
      return null;
    }

    const links = data.linksByPlatform || {};

    return {
      title: entity.title || "",
      artists: entity.artistName || "",
      coverArtUrl: entity.thumbnailUrl || "",
      spotifyUrl: links.spotify?.url || "",
      appleMusicUrl: links.appleMusic?.url || "",
      youtubeMusicUrl: links.youtubeMusic?.url || "",
      youtubeUrl: links.youtube?.url || ""
    };
  } catch (error) {
    console.error("Odesli Resolution Error:", error);
    return null;
  }
}
