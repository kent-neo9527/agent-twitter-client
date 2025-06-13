import { Profile, parseProfile } from './profile';
import { QueryProfilesResponse, QueryTweetsResponse } from './timeline-v1';
import { parseAndPush, TimelineEntryRaw } from './timeline-v2';
import { Tweet } from './tweets';
import { TwitterAuth } from './auth';
import { addApiFeatures, requestApi } from './api';
import stringify from 'json-stable-stringify';
import { Console } from 'console';

export enum QueryListsMode {
  UsersList,
  TweetsList,
}

export interface ListTimeline {
  data?: {
    list?: {
      tweets_timeline?: {
        timeline?: {
          instructions?: {
            entries?: TimelineEntryRaw[];
            entry?: TimelineEntryRaw;
            type?: string;
          }[];
        };
      };
      members_timeline?: {
        timeline?: {
          instructions?: {
            entries?: TimelineEntryRaw[];
            entry?: TimelineEntryRaw;
            type?: string;
          }[];
        };
      };
    };
  };
}

export interface ListsTimeline {
  id: string;
  id_str: string;
  name: string;
  description: string;
  member_count: number;
  subscriber_count: number;
  created_at?: Date;
  profile: Profile;
}

export async function getListsMembers(
  listsId: string,
  maxItems: number,
  auth: TwitterAuth,
): Promise<QueryProfilesResponse> {
  const timeline = await getListsTimeline(
    listsId,
    maxItems,
    QueryListsMode.UsersList,
    auth,
  );
  console.log('List timeline:', JSON.stringify(timeline, null, 2));
  return parseListTimelineMembers(timeline);
}

export async function getTweetsInList(
  listsId: string,
  maxItems: number,
  auth: TwitterAuth,
): Promise<QueryTweetsResponse> {
  const timeline = await getListsTimeline(
    listsId,
    maxItems,
    QueryListsMode.TweetsList,
    auth,
  );
  return parseListTimelineTweets(timeline);
}

export async function getListsTimeline(
  listsId: string,
  maxItems: number,
  queryMode: QueryListsMode,
  auth: TwitterAuth,
): Promise<ListTimeline> {
  const variables: Record<string, any> = {
    listId: listsId,
    count: maxItems,
  };

  let features: any = addApiFeatures({
    rweb_video_screen_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    longform_notetweets_inline_media_enabled: true,
  });
  let queryUrl: string;
  switch (queryMode) {
    case QueryListsMode.UsersList:
      queryUrl = `https://x.com/i/api/graphql/MIVGmoGBX0zdn-Vb1a3IsQ/ListMembers`;
      features = {
        rweb_video_screen_enabled: false,
        payments_enabled: false,
        profile_label_improvements_pcf_label_in_post_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        verified_phone_label_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_grok_analyze_post_followups_enabled: true,
        responsive_web_jetfuel_frame: false,
        responsive_web_grok_share_attachment_enabled: true,
        articles_preview_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        responsive_web_grok_show_grok_translated_post: false,
        responsive_web_grok_analysis_button_from_backend: true,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
          true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_grok_image_annotation_enabled: true,
        responsive_web_enhance_cards_enabled: false,
        subscriptions_verification_info_enabled: true,
      };
      break;
    case QueryListsMode.TweetsList:
      queryUrl = `https://x.com/i/api/graphql/Wkhm1GmXHvIPYGx83--imA/ListLatestTweetsTimeline`;
      break;
    default:
      throw new Error('Invalid query mode for lists timeline');
  }

  const params = new URLSearchParams();
  params.set('features', stringify(features) ?? '');
  params.set('variables', stringify(variables) ?? '');
  const requestAPI = `${queryUrl}?${params.toString()}`;
  console.log('Requesting List Timeline:', requestAPI);
  const res = await requestApi<ListTimeline>(requestAPI, auth);
  if (!res.success) {
    throw res.err;
  }
  return res.value;
}

export function parseListTimelineTweets(
  timeline: ListTimeline,
): QueryTweetsResponse {
  let bottomCursor: string | undefined;
  let topCursor: string | undefined;
  const tweets: Tweet[] = [];
  const instructions =
    timeline.data?.list?.tweets_timeline?.timeline?.instructions ?? [];
  for (const instruction of instructions) {
    const entries = instruction.entries ?? [];

    for (const entry of entries) {
      const entryContent = entry.content;
      if (!entryContent) continue;

      if (entryContent.cursorType === 'Bottom') {
        bottomCursor = entryContent.value;
        continue;
      } else if (entryContent.cursorType === 'Top') {
        topCursor = entryContent.value;
        continue;
      }

      const idStr = entry.entryId;
      if (
        !idStr.startsWith('tweet') &&
        !idStr.startsWith('list-conversation')
      ) {
        continue;
      }

      if (entryContent.itemContent) {
        parseAndPush(tweets, entryContent.itemContent, idStr);
      } else if (entryContent.items) {
        for (const contentItem of entryContent.items) {
          if (
            contentItem.item &&
            contentItem.item.itemContent &&
            contentItem.entryId
          ) {
            parseAndPush(
              tweets,
              contentItem.item.itemContent,
              contentItem.entryId.split('tweet-')[1],
            );
          }
        }
      }
    }
  }

  return { tweets, next: bottomCursor, previous: topCursor };
}

export function parseListTimelineMembers(
  timeline: ListTimeline,
): QueryProfilesResponse {
  let bottomCursor: string | undefined;
  let topCursor: string | undefined;
  const profiles: Profile[] = [];
  const instructions =
    timeline.data?.list?.members_timeline?.timeline?.instructions ?? [];
  for (const instruction of instructions) {
    if (
      instruction.type === 'TimelineAddEntries' ||
      instruction.type === 'TimelineReplaceEntry'
    ) {
      if (instruction.entry?.content?.cursorType === 'Bottom') {
        bottomCursor = instruction.entry.content.value;
        continue;
      } else if (instruction.entry?.content?.cursorType === 'Top') {
        topCursor = instruction.entry.content.value;
        continue;
      }
      console.log('Processing instruction:', JSON.stringify(instruction));
      const entries = instruction.entries ?? [];
      for (const entry of entries) {
        console.log('Processing entry:', JSON.stringify(entry));
        const itemContent = entry.content?.itemContent;
        if (itemContent?.userDisplayType === 'User') {
          const userResultRaw = itemContent.user_results?.result;

          if (userResultRaw?.legacy) {
            const profile = parseProfile(
              userResultRaw.legacy,
              userResultRaw.is_blue_verified,
            );

            if (!profile.userId) {
              profile.userId = userResultRaw.rest_id;
            }

            profiles.push(profile);
          }
        } else if (entry.content?.cursorType === 'Bottom') {
          bottomCursor = entry.content.value;
        } else if (entry.content?.cursorType === 'Top') {
          topCursor = entry.content.value;
        }
      }
    }
  }
  return { profiles, next: bottomCursor, previous: topCursor };
}
