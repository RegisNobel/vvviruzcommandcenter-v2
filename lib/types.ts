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
    unlock_experience: "instant_unlock" | "email_only" | "signup_notify";
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
  vault: {
    is_enabled: boolean;
    badge_text: string;
    title: string;
    subtitle: string;
    body: string;
    cta_label: string;
    cta_url: string;
    benefits: ExclusiveCommunityBenefit[];
  };
  commissions: {
    is_enabled: boolean;
    page_eyebrow: string;
    page_title: string;
    page_subtitle: string;
    card_title: string;
    card_price: string;
    card_description: string;
    card_button_text: string;
    closed_message: string;
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
  seo_title: string;
  meta_description: string;
  cover_art_alt_text: string;
  social_share_title: string;
  social_share_description: string;
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
  slug: string;
  pinned: boolean;
  type: ReleaseType;
  status: ReleaseStageLabel;
  release_date: string;
  collaborator_name: string;
  upc: string;
  isrc: string;
  progress_percentage: number;
  updated_on: string;
  discovery_status: "Ready" | "Needs polish" | "Missing essentials";
  discovery_passed: number;
  discovery_warning: number;
  discovery_missing: number;
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
  seo_title: string;
  meta_description: string;
  cover_art_alt_text: string;
  social_share_title: string;
  social_share_description: string;
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
  source_utm_source: string;
  source_utm_medium: string;
  source_utm_campaign: string;
  source_utm_content: string;
  source_utm_term: string;
  source_referrer: string;
  source_landing_page: string;
  source_offer_mode: string;
  source_offer_name: string;
  source_signup_context: string;
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
  unlockExperience: "instant_unlock" | "email_only" | "signup_notify";
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
  | "proof-of-skill"
  | "emotional-pull"
  | "curiosity-gap"
  | "hype-challenge"
  | (string & {});

export type CopyType = HookType;

export type CopyContentType =
  | "amv-lyric-edit"
  | "studio-performance"
  | "gym-clip"
  | "talking-head"
  | "meme-skit"
  | "b-roll-stock"
  | "text-only"
  | "cover-art-static"
  | (string & {});

export type CopySongSection =
  | "intro"
  | "hook"
  | "verse"
  | "bridge"
  | "outro"
  | "full-song"
  | (string & {});

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
  archived_at?: string | null;
  archive_reason?: string | null;
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
  archived_at?: string | null;
  archive_reason?: string | null;
};

/**
 * V1.2 controlled decision set.
 * Each label tells the user what to do next, not how the campaign "felt."
 * Do not add vague labels like "good", "promising", "winner", or "loser."
 */
export type AdCampaignDecision =
  | "scale"
  | "iterate"
  | "pause"
  | "retire"
  | "retest-hook"
  | "retest-visual"
  | "retest-audience"
  | "needs-more-data";

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
  landing_page_views: number;
  results: number;
  link_clicks: number;
  clicks_all: number;
  ctr: number | null;
  click_to_landing_rate: number | null;
  cost_per_landing_page_view: number | null;
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
  frequency: number | null;
  cost_per_thousand_accounts_reached: number | null;
  cpm: number | null;
  results: number | null;
  result_indicator: string;
  cost_per_result: number | null;
  link_clicks: number | null;
  cpc: number | null;
  ctr: number | null;
  clicks_all: number | null;
  ctr_all: number | null;
  cpc_all: number | null;
  landing_page_views: number | null;
  cost_per_landing_page_view: number | null;
  shop_clicks: number | null;
  page_engagement: number | null;
  post_reactions: number | null;
  post_comments: number | null;
  post_saves: number | null;
  post_shares: number | null;
  facebook_likes: number | null;
  instagram_follows: number | null;
  video_plays: number | null;
  two_second_continuous_plays: number | null;
  cost_per_two_second_continuous_play: number | null;
  three_second_plays: number | null;
  cost_per_three_second_play: number | null;
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
  copy_link_source?: "direct" | "carryover" | "none";
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
  landing_page_views: number;
  cpc: number | null;
  ctr: number | null;
  click_to_landing_rate: number | null;
  cost_per_landing_page_view: number | null;
  thru_plays: number;
  video_100: number;
  video_hold_rate: number | null;
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
  /** V1.2 archive fields — populated when "Lock & Archive Test Cycle" is triggered. */
  reviewed_at: string | null;
  reviewed_by: string;
  final_decision: string;
  human_override_notes: string;
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
  creative_diagnostics?: CreativeDiagnostic[];
  data_warnings?: CreativeDiagnostic[];
};

export type CampaignHistoryCreative = {
  ad_name: string;
  visual: string;
  songSection: string;
  revision: string;
  spend: number;
  results: number;
  cost_per_result: number | null;
  confidence_score: string;
  confidence_source: "conversion" | "ctr" | "none";
};

export type CampaignHistoryCycle = {
  learning_id: string;
  batch_id: string;
  batch_name: string;
  reviewed_at: string;
  reviewed_by: string;
  final_decision: string;
  human_override_notes: string;
  reporting_start: string | null;
  reporting_end: string | null;
  batch_type: AdBatchType;
  spend: number;
  results: number;
  cost_per_result: number | null;
  top_creative: CampaignHistoryCreative | null;
  confidence_score: string;
  confidence_source: "conversion" | "ctr" | "none";
};

export type ReleaseCampaignHistory = {
  archived_cycles: CampaignHistoryCycle[];
  current_snapshot: CampaignHistoryCycle | null;
  comparison: {
    mode: AdBatchComparisonMode | "No Comparison";
    archived_winner: CampaignHistoryCreative | null;
    current_winner: CampaignHistoryCreative | null;
    ranges_overlap: boolean;
  } | null;
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

export type ShortLinkStatus = "ACTIVE" | "ARCHIVED" | "PAUSED";
export type ShortLinkAdminFilter = ShortLinkStatus | "DELETED";

export type ShortLinkRecord = {
  id: string;
  slug: string;
  destination_url: string;
  release_id: string;
  release_title: string;
  status: ShortLinkStatus;
  click_count: number;
  campaign_label: string;
  content_label: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  paused_at: string | null;
  destination_updated_at: string | null;
  deleted_at: string | null;
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
  total_landing_page_views: number;
  total_thru_plays: number | null;
  total_video_100: number | null;
  ctr: number | null;
  cpc: number | null;
  cpr: number | null;
  click_to_landing_rate: number | null;
  cost_per_landing_page_view: number | null;
  batch_count: number;
  report_count: number;
  best_ad: ReleaseAdHighlightAd | null;
  worst_ad: ReleaseAdHighlightAd | null;
  best_hook: ReleaseAdHighlightHook | null;
  worst_hook: ReleaseAdHighlightHook | null;
  batches: ReleaseAdBatchRef[];
};
/**
 * V1.3 Release Intelligence Layer — controlled promo verdict label set.
 * Each label describes the promotional status of the release, not a feeling.
 * Do not add vague or emotional labels.
 */
export type ReleasePromoVerdict =
  | "Untested"
  | "Testing"
  | "Winner"
  | "Promising"
  | "Needs New Creative"
  | "Paused"
  | "Retired";

export type CommissionRequestRecord = {
  id: string;
  name: string;
  email: string;
  requestType: string;
  budgetRange: string;
  deadline: string;
  specificDeadline: string;
  topic: string;
  beatLink: string;
  referenceLink: string;
  usageIntent: string;
  additionalNotes: string;
  status: string;
  quotedPrice: string;
  paypalLink: string;
  adminNotes: string;
  deliveryLink: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  referrer: string;
  landingPage: string;
  createdAt: string;
  updatedAt: string;
};

export type ComponentPerformanceRow = {
  value: string;
  batchCount: number;
  totalSpend: number;
  isSpendOverlapping: boolean;
  metricBasis: "combined_total" | "latest_snapshot";
  totalResults: number;
  averageCpr: number | null;
  bestBatchCpr: number | null;
  latestBatchCpr: number | null;
  confidenceScore: string;
  confidenceType: "conversion" | "ctr" | "none";
  trendLabel: "Improving" | "Stable" | "Fading" | "Needs More Data";
};

export type CreativePerformanceMemorySummaryRow = {
  value: string;
  cpr?: number | null;
  results?: number;
  score?: string;
  isLowData?: boolean;
  warning?: string;
};

export type CreativePerformanceMemory = {
  visuals: ComponentPerformanceRow[];
  songSections: ComponentPerformanceRow[];
  revisions: ComponentPerformanceRow[];
  bestVisual: CreativePerformanceMemorySummaryRow | null;
  bestSongSection: CreativePerformanceMemorySummaryRow | null;
  volumeWinner: CreativePerformanceMemorySummaryRow | null;
  efficiencyWinner: CreativePerformanceMemorySummaryRow | null;
  strongestConfidenceSignal: CreativePerformanceMemorySummaryRow | null;
  hasOverlappingSnapshots: boolean;
};

export type AdPerformanceCell = {
  cpr: number | null;
  results: number;
  spend: number;
  confidenceScore: string;
  confidenceType: "conversion" | "ctr" | "none";
  movementLabel: "Took Lead" | "Kept Lead" | "Rebounded" | "Lost Lead" | "New Entrant" | "No Change" | "Underperforming" | "Needs More Data" | null;
  isSnapshotWinner: boolean;
  isPresent: boolean;
};

export type AdPerformanceSnapshot = {
  id: string;
  name: string;
  reportingStart: string | null;
  reportingEnd: string | null;
  totalSpend: number;
  totalResults: number;
  winnerAdName: string | null;
  lowDataWinnerAdName: string | null;
  lostLeadAdName: string | null; // For snapshot summary note if previous winner lost the lead in this snapshot
};

export type AdPerformanceRow = {
  normalizedName: string;
  originalName: string;
  cells: Array<AdPerformanceCell | null>;
};

export type AdPerformanceTimeline = {
  snapshots: AdPerformanceSnapshot[];
  rows: AdPerformanceRow[];
  hasOverlappingSnapshots: boolean;
};

export type CopyPerformanceRow = {
  label: string;
  copyEntryId: string | null;
  copyAngle?: string;
  hook?: string;
  caption?: string;
  spend: number;
  isSpendOverlapping: boolean;
  metricBasis: "combined_total" | "latest_snapshot";
  results: number;
  cpr: number | null;
  linkClicks: number;
  landingPageViews: number;
  outboundStreamingClicks: number;
  batchCount: number;
  confidenceScore: string;
  confidenceType: "conversion" | "ctr" | "none";
};

export type CopyPerformanceCoverage = {
  totalSpend: number;
  linkedSpend: number;
  unlinkedSpend: number;
  metricBasis: "combined_total" | "latest_snapshot";
  linkedSpendPercentage: number;
  unlinkedSpendPercentage: number;
  linkedAdCount: number;
  unlinkedAdCount: number;
};

export type CopyPerformanceMemoryWinner = {
  label: string;
  cpr: number | null;
  results: number;
  warning?: string;
};

export type UnlinkedAdSummaryRow = {
  adName: string;
  spend: number;
  isSpendOverlapping: boolean;
  metricBasis: "combined_total" | "latest_snapshot";
  results: number;
  cpr: number | null;
  linkClicks: number;
  landingPageViews: number;
  batchCount: number;
};

export type CopyPerformanceMemory = {
  coverage: CopyPerformanceCoverage;
  copyPairs: CopyPerformanceRow[];
  copyAngles: CopyPerformanceRow[];
  songSections: CopyPerformanceRow[];
  combos: CopyPerformanceRow[];
  unlinkedAds: UnlinkedAdSummaryRow[];
  hasOverlappingSnapshots: boolean;
  winners: {
    bestCopyPair: CopyPerformanceMemoryWinner | null;
    bestAngle: CopyPerformanceMemoryWinner | null;
    bestCombo: CopyPerformanceMemoryWinner | null;
    volumeWinner: CopyPerformanceMemoryWinner | null;
  };
  suggestions?: NextTestSuggestion[];
};

export type DiagnosticType =
  | "data-quality-warning"
  | "strong-control"
  | "maintain-consider-scale"
  | "pause-retire"
  | "retest-contender"
  | "weak-visual-scroll-stop"
  | "weak-copy-click-intent"
  | "weak-song-section-retention"
  | "landing-follow-through-issue"
  | "combo-test";

export interface CreativeDiagnostic {
  adName: string;
  type: DiagnosticType;
  action: string;
  severity: "success" | "warning" | "danger" | "info";
  reason: string;
  confidence: "High" | "Moderate" | "Directional" | "Needs More Data";
  evidence: string;
}

export interface NextTestSuggestion {
  type: "combo-test" | "data-quality-warning";
  action: string;
  reason: string;
  confidence: "High" | "Moderate" | "Directional" | "Needs More Data";
  evidence: string;
  alignmentNote?: string;
}
