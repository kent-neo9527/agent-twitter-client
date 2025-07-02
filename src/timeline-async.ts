import { Profile } from './profile';
import { Tweet } from './tweets';
import {ListsTimeline} from './timeline-list'

export interface FetchProfilesResponse {
  profiles: Profile[];
  next?: string;
}

export type FetchProfiles = (
  query: string,
  maxProfiles: number,
  cursor: string | undefined,
) => Promise<FetchProfilesResponse>;

export interface FetchTweetsResponse {
  tweets: Tweet[];
  next?: string;
}

export type FetchTweets = (
  query: string,
  maxTweets: number,
  cursor: string | undefined,
) => Promise<FetchTweetsResponse>;

export interface FetchListsResponse {
  lists: ListsTimeline[];
  next?: string;
}

export type FetchLists = (
  query: string,
  maxProfiles: number,
  cursor: string | undefined,
) => Promise<FetchListsResponse>;

export async function* getListsTimeline(
  query: string,
  maxLists: number,
  fetchFunc: FetchLists,
): AsyncGenerator<ListsTimeline, void> {
  let nList = 0;
  let cursor: string | undefined = undefined;
  while (nList < maxLists) {
    const batch: FetchListsResponse = await fetchFunc(query, maxLists, cursor);

    const { lists, next } = batch;

    if (lists.length === 0) {
      break;
    }

    for (const list of lists) {
      if (nList < maxLists) {
        cursor = next;
        yield list;
      } else {
        break;
      }

      nList++;
    }
  }
}
export async function* getUserTimeline(
  query: string,
  maxProfiles: number,
  fetchFunc: FetchProfiles,
): AsyncGenerator<Profile, void> {
  let nProfiles = 0;
  let cursor: string | undefined = undefined;
  let consecutiveEmptyBatches = 0;
  while (nProfiles < maxProfiles) {
    const batch: FetchProfilesResponse = await fetchFunc(
      query,
      maxProfiles,
      cursor,
    );

    const { profiles, next } = batch;
    cursor = next;

    if (profiles.length === 0) {
      consecutiveEmptyBatches++;
      if (consecutiveEmptyBatches > 5) break;
    } else consecutiveEmptyBatches = 0;

    for (const profile of profiles) {
      if (nProfiles < maxProfiles) yield profile;
      else break;
      nProfiles++;
    }

    if (!next) break;
  }
}

export async function* getTweetTimeline(
  query: string,
  maxTweets: number,
  fetchFunc: FetchTweets,
): AsyncGenerator<Tweet, void> {
  let nTweets = 0;
  let cursor: string | undefined = undefined;
  while (nTweets < maxTweets) {
    const batch: FetchTweetsResponse = await fetchFunc(
      query,
      maxTweets,
      cursor,
    );

    const { tweets, next } = batch;

    if (tweets.length === 0) {
      break;
    }

    for (const tweet of tweets) {
      if (nTweets < maxTweets) {
        cursor = next;
        yield tweet;
      } else {
        break;
      }

      nTweets++;
    }
  }
}
