export type LyricLine = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type WorkflowStep =
  | "context"
  | "audio"
  | "trim"
  | "transcribe"
  | "edit"
  | "style"
  | "export";

export type TranscriptionStatus = "idle" | "running" | "complete" | "failed";

export type TranscriptionLanguage = "auto" | "en" | "fr" | "es";

export type BackgroundMode = "solid" | "gradient" | "motion" | "image" | "video";

export type BackgroundMediaAsset = {
  id: string;
  fileName: string;
  url: string;
  mediaType: "image" | "video";
  mimeType: string;
};

export type TextAlignment = "left" | "center" | "right";

export type AnimationStyle =
  | "fade"
  | "slide-up"
  | "pop"
  | "typewriter"
  | "karaoke";

export type ResolutionPreset = "720p" | "1080p";

export type PreviewAspectRatio = "9:16" | "16:9";

export type LyricPlacement = {
  x: number;
  y: number;
};

export type BackgroundStyle = {
  mode: BackgroundMode;
  solidColor: string;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  mediaAsset?: BackgroundMediaAsset | null;
};

export type LyricStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  inactiveColor: string;
  karaokeColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  alignment: TextAlignment;
  lineHeight: number;
};

export type AudioAsset = {
  id: string;
  fileName: string;
  url: string;
  durationMs: number;
  originalDurationMs: number;
  trimmed: boolean;
};

export type LyricProject = {
  id: string;
  title: string;
  release_id: string | null;
  audio: AudioAsset | null;
  lines: LyricLine[];
  background: BackgroundStyle;
  lyrics: LyricStyle;
  animationStyle: AnimationStyle;
  aspectRatio: PreviewAspectRatio;
  lyricPlacement: LyricPlacement;
  resolution: ResolutionPreset;
  transcriptionLanguage: TranscriptionLanguage;
  workflowStep: WorkflowStep;
  transcriptionStatus: TranscriptionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  title: string;
  release_id: string | null;
  createdAt: string;
  updatedAt: string;
  hasAudio: boolean;
  durationMs: number | null;
  aspectRatio: PreviewAspectRatio;
  lineCount: number;
  workflowStep: WorkflowStep;
};

export type UploadResponse = {
  audio: AudioAsset;
  requiresTrim: boolean;
};

export type BackgroundUploadResponse = {
  asset: BackgroundMediaAsset;
};

export type ReleaseStatus =
  | "Concept Complete"
  | "Beat Made"
  | "Lyrics Finished"
  | "Recorded"
  | "Mix/Mastered"
  | "Published";

export type ReleaseStageLabel =
  | "Concept"
  | "Cover Art"
  | "Beat Made"
  | "Lyrics"
  | "Recorded"
  | "Mix/Mastered"
  | "Published"
  | "Not Started";

export type ReleaseType = "nerdcore" | "mainstream";

export type ReleaseTask = {
  id: string;
  text: string;
  completed: boolean;
};

export type ReleaseCoverAsset = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
};

export type ReleaseStreamingLinks = {
  spotify: string;
  apple_music: string;
  youtube: string;
};

export type SocialLink = {
  id: string;
  label: string;
  url: string;
};

export type LinkHubItem = {
  id: string;
  label: string;
  url: string;
};

export type SubscriberSource = "exclusive" | "manual";

export type SubscriberStatus = "active" | "unsubscribed";

export type AudienceFilter = "all_active" | "exclusive_source" | "manual_source";

export type EmailCampaignStatus = "draft" | "sending" | "sent" | "failed";

export type EmailSendLogStatus = "pending" | "sent" | "failed" | "skipped";

export type BrandPillar = {
  id: string;
  title: string;
  description: string;
  imageFile: string;
};

export type SiteContentSettings = {
  metadata: {
    site_title: string;
    site_description: string;
    music_page_title: string;
    music_page_description: string;
    about_page_title: string;
    about_page_description: string;
    links_page_title: string;
    links_page_description: string;
    exclusive_page_title: string;
    exclusive_page_description: string;
    release_not_found_title: string;
    release_not_found_description: string;
  };
  chrome: {
    brand_mark_text: string;
    brand_mark_file: string;
    brand_subtitle_text: string;
    nav_home_label: string;
    nav_music_label: string;
    nav_about_label: string;
    nav_links_label: string;
    nav_exclusive_label: string;
    footer_copyright_text: string;
  };
  home: {
    hero_badge_text: string;
    secondary_cta_label: string;
    exclusive_cta_label: string;
    featured_releases_eyebrow: string;
    featured_releases_empty_text: string;
    featured_release_ids: string[];
    recent_releases_eyebrow: string;
    recent_releases_heading: string;
    recent_releases_view_all_label: string;
    brand_pillars_eyebrow: string;
    brand_pillars_heading: string;
    brand_pillars: BrandPillar[];
  };
  music: {
    page_eyebrow: string;
    page_heading: string;
    page_description: string;
    all_releases_label: string;
    nerdcore_label: string;
    mainstream_label: string;
    empty_state_text: string;
  };
  about: {
    statement_heading: string;
    statement_text: string;
    artist_image_file: string;
    narrative_heading: string;
    intro_heading: string;
    intro_text: string;
    philosophy_heading: string;
    philosophy_text: string;
    closing_heading: string;
    closing_text: string;
    connect_heading: string;
    connect_empty_text: string;
    contact_microcopy: string;
    contact_empty_text: string;
  };
  analytics: {
    meta_pixel_enabled: boolean;
    meta_pixel_id: string;
  };
  platforms: {
    spotify_label: string;
    apple_music_label: string;
    youtube_label: string;
    listen_on_spotify_label: string;
    listen_on_apple_music_label: string;
    listen_on_youtube_music_label: string;
    watch_on_youtube_label: string;
  };
  links: {
    badge_text: string;
    selected_release_id: string;
    exclusive_cta_label: string;
    empty_state_text: string;
  };
  exclusive: {
    badge_text: string;
    headline: string;
    subtext: string;
    brand_line: string;
    cta_label: string;
    name_label: string;
    email_label: string;
    consent_label: string;
    success_heading: string;
    success_message: string;
    duplicate_message: string;
    download_label: string;
    unavailable_heading: string;
    unavailable_body: string;
    exclusive_track_title: string;
    exclusive_track_description: string;
    exclusive_track_file_path: string;
    exclusive_track_art_path: string;
    exclusive_track_enabled: boolean;
  };
  release: {
    back_to_music_label: string;
    lyrics_heading: string;
    spotify_heading: string;
    video_heading: string;
    related_releases_eyebrow: string;
    related_releases_heading: string;
    related_releases_view_all_label: string;
    not_found_heading: string;
    not_found_body: string;
  };
};

export type ReleaseRecord = {
  id: string;
  title: string;
  slug: string;
  pinned: boolean;
  collaborator: boolean;
  collaborator_name: string;
  upc: string;
  isrc: string;
  cover_art: ReleaseCoverAsset | null;
  cover_art_path: string;
  streaming_links: ReleaseStreamingLinks;
  lyrics: string;
  type: ReleaseType;
  release_date: string;
  concept_details: string;
  public_description: string;
  public_long_description: string;
  featured_video_url: string;
  public_lyrics_enabled: boolean;
  is_published: boolean;
  is_featured: boolean;
  concept_complete: boolean;
  beat_made: boolean;
  lyrics_finished: boolean;
  recorded: boolean;
  mix_mastered: boolean;
  published: boolean;
  tasks: ReleaseTask[];
  created_on: string;
  updated_on: string;
};

export type ReleaseSummary = {
  id: string;
  title: string;
  pinned: boolean;
  type: ReleaseType;
  status: ReleaseStageLabel;
  release_date: string;
  progress_percentage: number;
  updated_on: string;
};
export type ReleasePlanStep = {
  id: string;
  label: ReleaseStageLabel;
  complete: boolean;
  current: boolean;
};

export type ReleasePlanItem = ReleaseSummary & {
  next_action: string;
  blockers: string[];
  validation_warnings: string[];
  stage_steps: ReleasePlanStep[];
  task_count: number;
  completed_task_count: number;
  clip_count: number;
  copy_count: number;
  has_cover_art: boolean;
  has_streaming_links: boolean;
  is_scheduled: boolean;
};

export type ReleaseCoverUploadResponse = {
  asset: ReleaseCoverAsset;
};

export type PublicReleaseRecord = {
  id: string;
  slug: string;
  title: string;
  collaborator: boolean;
  collaborator_name: string;
  release_date: string;
  type: ReleaseType;
  cover_art_path: string;
  public_description: string;
  public_long_description: string;
  spotify_url: string;
  apple_music_url: string;
  youtube_url: string;
  is_published: boolean;
  is_featured: boolean;
  featured_video_url: string;
  public_lyrics_enabled: boolean;
  lyrics: string;
  created_on: string;
  updated_on: string;
};

export type SiteSettingsRecord = {
  artist_name: string;
  tagline: string;
  short_bio: string;
  long_bio: string;
  contact_email: string;
  booking_email: string;
  social_links: SocialLink[];
  hero_text: string;
  about_content: string;
  links_page_items: LinkHubItem[];
  site_content: SiteContentSettings;
  created_on: string;
  updated_on: string;
};

export type SubscriberRecord = {
  id: string;
  name: string;
  email: string;
  source: SubscriberSource;
  status: SubscriberStatus;
  consent_given: boolean;
  download_token: string;
  unsubscribe_token: string;
  created_at: string;
  updated_at: string;
  unsubscribed_at: string | null;
};

export type AudienceOverview = {
  total_subscribers: number;
  active_subscribers: number;
  unsubscribed_subscribers: number;
  consented_subscribers: number;
  exclusive_subscribers: number;
  manual_subscribers: number;
};

export type EmailCampaignRecord = {
  id: string;
  subject: string;
  preview_text: string;
  body: string;
  cta_label: string;
  cta_url: string;
  audience_filter: AudienceFilter;
  status: EmailCampaignStatus;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailSendLogRecord = {
  id: string;
  campaign_id: string;
  subscriber_id: string | null;
  email: string;
  status: EmailSendLogStatus;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

export type ExclusiveClaimResponse = {
  downloadUrl: string;
  isDuplicate: boolean;
  message: string;
  subscriber: Pick<
    SubscriberRecord,
    "id" | "name" | "email" | "status" | "consent_given"
  >;
};

export type ExclusiveAssetUploadResponse = {
  assetType: "track" | "art";
  fileName: string;
  storedPath: string;
  publicUrl: string | null;
  mimeType: string;
};

export type CopyType =
  | "neutral"
  | "curiosity"
  | "contrarian-opinion"
  | "relatable-pain"
  | "listicle-numbered"
  | "direct-actionable"
  | "mistake-regret"
  | "before-after-result";

export type CopyRecord = {
  id: string;
  release_id: string | null;
  hook: string;
  caption: string;
  type: CopyType;
  created_on: string;
  updated_on: string;
};

export type CopySummary = {
  id: string;
  release_id: string | null;
  hook: string;
  caption: string;
  type: CopyType;
  created_on: string;
  updated_on: string;
};

export type TranscriptionResponse = {
  fullText: string;
  lines: LyricLine[];
};

export type ExportStreamEvent =
  | {
      type: "progress";
      progress: number;
      renderedFrames?: number;
      encodedFrames?: number;
      stage?: string;
    }
  | {
      type: "complete";
      downloadUrl: string;
      fileName: string;
    }
  | {
      type: "error";
      message: string;
    };

export type StylePreset = {
  id: string;
  name: string;
  animationStyle: AnimationStyle;
  background: BackgroundStyle;
  lyrics: LyricStyle;
};

export type RenderVideoProps = {
  project: LyricProject;
  audioSrc: string | null;
};
