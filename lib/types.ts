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

export type ExclusiveCommunityBenefit = {
  id: string;
  title: string;
  description: string;
};

export type ReleaseCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  release_ids: string[];
  created_at: string;
  updated_at: string;
};

export type PublicReleaseCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  release_count: number;
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
    unlock_experience: "instant_unlock" | "email_only";
    private_external_url: string;
    instant_unlock_button_label: string;
    also_email_link: boolean;
    email_subject: string;
    email_body: string;
    discord_invite_url: string;
    community_badge_text: string;
    community_headline: string;
    community_subheadline: string;
    community_microcopy: string;
    community_cta_heading: string;
    community_cta_label: string;
    community_cta_helper: string;
    community_benefits: ExclusiveCommunityBenefit[];
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
  categories: PublicReleaseCategory[];
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
  downloadUrl?: string; // Kept for backwards compatibility/fallback
  privateExternalUrl?: string;
  unlockExperience: "instant_unlock" | "email_only";
  instantUnlockButtonLabel: string;
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

export type HookType =
  | "discovery-shock"
  | "identity-callout"
  | "proof-of-skill";

export type CopyType = HookType;

export type CopyContentType =
  | "amv-lyric-edit"
  | "performance-clip"
  | "b-roll-stock-clip";

export type CopySongSection =
  | "hook"
  | "verse-1"
  | "verse-2";

export type CopyRecord = {
  id: string;
  release_id: string | null;
  hook: string;
  caption: string;
  hook_type: HookType;
  content_type: CopyContentType;
  song_section: CopySongSection;
  creative_notes: string;
  created_on: string;
  updated_on: string;
};

export type CopySummary = {
  id: string;
  release_id: string | null;
  hook: string;
  caption: string;
  hook_type: HookType;
  content_type: CopyContentType;
  song_section: CopySongSection;
  creative_notes: string;
  created_on: string;
  updated_on: string;
};

export type AdCampaignDecision = "scale" | "retest" | "iterate" | "pause" | "archive";

export type AdBatchType = "Rolling Snapshot" | "Fixed Period" | "Release-to-Date" | "Full Campaign";

export type AdBatchComparisonMode = "Snapshot Comparison" | "Combined Fixed Period";

export type AdImportBatchSummary = {
  id: string;
  source: string;
  name: string;
  release_id: string | null;
  release_title: string | null;
  reporting_start: string | null;
  reporting_end: string | null;
  exported_at: string | null;
  attribution_setting: string;
  batch_type: AdBatchType;
  file_names: string[];
  notes: string;
  report_count: number;
  linked_copy_count: number;
  spend: number;
  impressions: number;
  reach: number;
  results: number;
  link_clicks: number;
  ctr: number | null;
  created_at: string;
  updated_at: string;
};

export type AdCreativeReportRecord = {
  id: string;
  import_batch_id: string;
  release_id: string | null;
  campaign_name: string;
  ad_set_name: string;
  ad_name: string;
  ad_delivery: string;
  reporting_start: string | null;
  reporting_end: string | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  results: number | null;
  cost_per_result: number | null;
  link_clicks: number | null;
  cpc: number | null;
  ctr: number | null;
  page_engagement: number | null;
  post_reactions: number | null;
  post_comments: number | null;
  post_saves: number | null;
  post_shares: number | null;
  instagram_follows: number | null;
  video_plays: number | null;
  three_second_plays: number | null;
  thru_plays: number | null;
  cost_per_thru_play: number | null;
  video_25: number | null;
  video_50: number | null;
  video_75: number | null;
  video_95: number | null;
  video_100: number | null;
  quality_ranking: string;
  engagement_rate_ranking: string;
  conversion_rate_ranking: string;
  utm_source: string;
  utm_campaign: string;
  utm_content: string;
  linked_copy: CopySummary | null;
  performance_signals: string[];
  created_at: string;
  updated_at: string;
};

export type AdStrategyBreakdownRow = {
  label: string;
  spend: number;
  impressions: number;
  reach: number;
  results: number;
  link_clicks: number;
  cpc: number | null;
  ctr: number | null;
  thru_plays: number;
  video_100: number;
  report_count: number;
};

export type AdLinkFollowThroughRecord = {
  ad_report_id: string;
  meta_link_clicks: number;
  links_page_views: number;
  outbound_streaming_clicks: number;
  spotify_clicks: number;
  apple_music_clicks: number;
  youtube_music_clicks: number;
  click_to_view_match_percentage: number | null;
  view_to_stream_intent_percentage: number | null;
  meta_click_to_stream_intent_percentage: number | null;
};

export type AdCampaignLearningRecord = {
  id: string;
  import_batch_id: string;
  release_id: string | null;
  summary: string;
  what_worked: string;
  what_failed: string;
  next_test: string;
  decision: AdCampaignDecision;
  created_at: string;
  updated_at: string;
};

export type AdImportBatchDetail = AdImportBatchSummary & {
  reports: AdCreativeReportRecord[];
  available_copies: CopySummary[];
  strategy_breakdowns: {
    hook_type: AdStrategyBreakdownRow[];
    content_type: AdStrategyBreakdownRow[];
    song_section: AdStrategyBreakdownRow[];
    combo: AdStrategyBreakdownRow[];
  };
  link_follow_through: AdLinkFollowThroughRecord[];
  learning: AdCampaignLearningRecord | null;
};

export type AppearsOnRecord = {
  id: string;
  title: string;
  artists: string;
  cover_art_url: string;
  spotify_url: string;
  apple_music_url: string;
  youtube_music_url: string;
  youtube_url: string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ReleaseAdHighlightAd = {
  ad_name: string;
  spend: number;
  results: number;
  cpr: number | null;
  ctr: number | null;
  signals: string[];
};

export type ReleaseAdHighlightHook = {
  label: string;
  spend: number;
  results: number;
  link_clicks: number;
  cpr: number | null;
  ctr: number | null;
};

export type ReleaseAdBatchRef = {
  id: string;
  name: string;
  spend: number;
  report_count: number;
  created_at: string;
};

export type ReleaseAdMetricsOverview = {
  has_data: boolean;
  source_label: string;
  source_context: {
    reporting_start: string | null;
    reporting_end: string | null;
    batch_type: string;
    exported_at: string | null;
    attribution_setting: string;
  } | null;
  total_spend: number;
  total_impressions: number;
  total_reach: number;
  total_results: number;
  total_link_clicks: number;
  total_thru_plays: number | null;
  total_video_100: number | null;
  ctr: number | null;
  cpc: number | null;
  cpr: number | null;
  batch_count: number;
  report_count: number;
  best_ad: ReleaseAdHighlightAd | null;
  worst_ad: ReleaseAdHighlightAd | null;
  best_hook: ReleaseAdHighlightHook | null;
  worst_hook: ReleaseAdHighlightHook | null;
  batches: ReleaseAdBatchRef[];
};
