import { Profile, parseProfile } from './profile';
import { ListsTimeline } from './timeline-list';
import {
  QueryProfilesResponse,
  QueryTweetsResponse,
  QueryListsResponse,
} from './timeline-v1';
import { SearchEntryRaw, parseLegacyTweet } from './timeline-v2';
import { Tweet } from './tweets';

export interface SearchTimeline {
  data?: {
    search_by_raw_query?: {
      search_timeline?: {
        timeline?: {
          instructions?: {
            entries?: SearchEntryRaw[];
            entry?: SearchEntryRaw;
            type?: string;
          }[];
        };
      };
    };
  };
}

export function parseSearchTimelineTweets(
  timeline: SearchTimeline,
): QueryTweetsResponse {
  let bottomCursor: string | undefined;
  let topCursor: string | undefined;
  const tweets: Tweet[] = [];
  const instructions =
    timeline.data?.search_by_raw_query?.search_timeline?.timeline
      ?.instructions ?? [];
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

      const entries = instruction.entries ?? [];
      for (const entry of entries) {
        const itemContent = entry.content?.itemContent;
        if (itemContent?.tweetDisplayType === 'Tweet') {
          const tweetResultRaw = itemContent.tweet_results?.result;
          const tweetResult = parseLegacyTweet(
            tweetResultRaw?.core?.user_results?.result?.legacy,
            tweetResultRaw?.legacy,
          );

          if (tweetResult.success) {
            if (!tweetResult.tweet.views && tweetResultRaw?.views?.count) {
              const views = parseInt(tweetResultRaw.views.count);
              if (!isNaN(views)) {
                tweetResult.tweet.views = views;
              }
            }

            tweets.push(tweetResult.tweet);
          }
        } else if (entry.content?.cursorType === 'Bottom') {
          bottomCursor = entry.content.value;
        } else if (entry.content?.cursorType === 'Top') {
          topCursor = entry.content.value;
        }
      }
    }
  }

  return { tweets, next: bottomCursor, previous: topCursor };
}

export function parseSearchTimelineUsers(
  timeline: SearchTimeline,
): QueryProfilesResponse {
  let bottomCursor: string | undefined;
  let topCursor: string | undefined;
  const profiles: Profile[] = [];
  const instructions =
    timeline.data?.search_by_raw_query?.search_timeline?.timeline
      ?.instructions ?? [];

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

      const entries = instruction.entries ?? [];
      for (const entry of entries) {
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

export function parseSearchTimelineLists(
  timeline: SearchTimeline,
): QueryListsResponse {
  let bottomCursor: string | undefined;
  let topCursor: string | undefined;
  const lists: ListsTimeline[] = [];
  const instructions =
    timeline.data?.search_by_raw_query?.search_timeline?.timeline
      ?.instructions ?? [];

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
      const entries = instruction.entries ?? [];
      for (const entry of entries) {
        const items = entry.content?.items;
        for (const itemContent of items ?? []) {
          const item = itemContent?.item?.itemContent;
          if (item?.displayType === 'ListWithSubscribe') {
            const listsResultRaw = item.list;
            const userResultRaw = item.list?.user_results?.result;
            const createdAt =
              new Date(Date.parse(listsResultRaw?.created_at ?? '0')) ??
              new Date();
            const listsTimeline: ListsTimeline = {
              id: listsResultRaw?.id ?? '',
              id_str: listsResultRaw?.id_str ?? '',
              created_at: createdAt,
              name: listsResultRaw?.name ?? '',
              description: listsResultRaw?.description ?? '',
              member_count: listsResultRaw?.member_count ?? 0,
              subscriber_count: listsResultRaw?.subscriber_count ?? 0,
              profile: {} as Profile,
            };
            if (userResultRaw?.legacy) {
              listsTimeline.profile = parseProfile(
                userResultRaw.legacy,
                userResultRaw.is_blue_verified,
              );

              if (!listsTimeline.profile.userId) {
                listsTimeline.profile.userId = userResultRaw.rest_id;
              }
            }
            lists.push(listsTimeline);
          }
        }
        if (entry.content?.cursorType === 'Bottom') {
          bottomCursor = entry.content.value;
        } else if (entry.content?.cursorType === 'Top') {
          topCursor = entry.content.value;
        }
      }
    }
  }

  return { lists, next: bottomCursor, previous: topCursor };
}
