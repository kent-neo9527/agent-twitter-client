import { addApiFeatures, requestApi, bearerToken } from './api';
import { Headers } from 'headers-polyfill';
import { TwitterAuth } from './auth';
import { Profile, getUserIdByScreenName } from './profile';
import { QueryProfilesResponse } from './timeline-v1';
import { getUserTimeline } from './timeline-async';
import {
  RelationshipTimeline,
  parseRelationshipTimeline,
} from './timeline-relationship';
import stringify from 'json-stable-stringify';
import { Console } from 'node:console';
import { json } from 'node:stream/consumers';

export function getFollowing(
  userId: string,
  maxProfiles: number,
  auth: TwitterAuth,
): AsyncGenerator<Profile, void> {
  return getUserTimeline(userId, maxProfiles, (q, mt, c) => {
    return fetchProfileFollowing(q, mt, auth, c);
  });
}

export function getFollowers(
  userId: string,
  maxProfiles: number,
  auth: TwitterAuth,
): AsyncGenerator<Profile, void> {
  return getUserTimeline(userId, maxProfiles, (q, mt, c) => {
    return fetchProfileFollowers(q, mt, auth, c);
  });
}

export async function fetchProfileFollowing(
  userId: string,
  maxProfiles: number,
  auth: TwitterAuth,
  cursor?: string,
): Promise<QueryProfilesResponse> {
  const timeline = await getFollowingTimeline(
    userId,
    maxProfiles,
    auth,
    cursor,
  );

  return parseRelationshipTimeline(timeline);
}

export async function fetchProfileFollowers(
  userId: string,
  maxProfiles: number,
  auth: TwitterAuth,
  cursor?: string,
): Promise<QueryProfilesResponse> {
  const timeline = await getFollowersTimeline(
    userId,
    maxProfiles,
    auth,
    cursor,
  );

  return parseRelationshipTimeline(timeline);
}

async function getFollowingTimeline(
  userId: string,
  maxItems: number,
  auth: TwitterAuth,
  cursor?: string,
): Promise<RelationshipTimeline> {
  if (!auth.isLoggedIn()) {
    throw new Error('Scraper is not logged-in for profile following.');
  }

  if (maxItems > 50) {
    maxItems = 50;
  }

  const variables: Record<string, any> = {
    userId,
    count: maxItems,
    includePromotedContent: false,
  };

  const features = addApiFeatures({
    responsive_web_twitter_article_tweet_consumption_enabled: false,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
      true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_media_download_video_enabled: false,
  });

  if (cursor != null && cursor != '') {
    variables['cursor'] = cursor;
  }

  const params = new URLSearchParams();
  params.set('features', stringify(features) ?? '');
  params.set('variables', stringify(variables) ?? '');

  const res = await requestApi<RelationshipTimeline>(
    `https://twitter.com/i/api/graphql/iSicc7LrzWGBgDPL0tM_TQ/Following?${params.toString()}`,
    auth,
  );

  if (!res.success) {
    throw res.err;
  }

  return res.value;
}

async function getFollowersTimeline(
  userId: string,
  maxItems: number,
  auth: TwitterAuth,
  cursor?: string,
): Promise<RelationshipTimeline> {
  if (!auth.isLoggedIn()) {
    throw new Error('Scraper is not logged-in for profile followers.');
  }

  if (maxItems > 50) {
    maxItems = 50;
  }

  const variables: Record<string, any> = {
    userId,
    count: maxItems,
    includePromotedContent: false,
  };

  const features = addApiFeatures({
    responsive_web_twitter_article_tweet_consumption_enabled: false,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
      true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_media_download_video_enabled: false,
  });

  if (cursor != null && cursor != '') {
    variables['cursor'] = cursor;
  }

  const params = new URLSearchParams();
  params.set('features', stringify(features) ?? '');
  params.set('variables', stringify(variables) ?? '');

  const res = await requestApi<RelationshipTimeline>(
    `https://twitter.com/i/api/graphql/rRXFSG5vR6drKr5M37YOTw/Followers?${params.toString()}`,
    auth,
  );

  if (!res.success) {
    throw res.err;
  }

  return res.value;
}

export async function followUser(
  username: string,
  auth: TwitterAuth,
): Promise<Response> {
  // Check if the user is logged in
  if (!(await auth.isLoggedIn())) {
    throw new Error('Must be logged in to follow users');
  }
  // Get user ID from username
  const userIdResult = await getUserIdByScreenName(username, auth);

  if (!userIdResult.success) {
    throw new Error(`Failed to get user ID: ${userIdResult.err.message}`);
  }

  const userId = userIdResult.value;

  // Prepare the request body
  const requestBody = {
    include_profile_interstitial_type: '1',
    skip_status: 'true',
    user_id: userId,
  };

  // Prepare the headers
  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: `https://twitter.com/${username}`,
    'X-Twitter-Active-User': 'yes',
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'X-Twitter-Client-Language': 'en',
    Authorization: `Bearer ${bearerToken}`,
  });

  // Install auth headers
  await auth.installTo(
    headers,
    'https://api.twitter.com/1.1/friendships/create.json',
  );
  // Make the follow request using auth.fetch
  const res = await auth.fetch(
    'https://api.twitter.com/1.1/friendships/create.json',
    {
      method: 'POST',
      headers,
      body: new URLSearchParams(requestBody).toString(),
      credentials: 'include',
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to follow user: ${res.statusText}`);
  }

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function unfollowUser(username: string, auth: TwitterAuth) {
  const userIdResult = await getUserIdByScreenName(username, auth);

  if (!userIdResult.success) {
    throw new Error(`Failed to get user ID: ${userIdResult.err.message}`);
  }

  const unFollowUserUrl = 'https://x.com/i/api/1.1/friendships/destroy.json';
  const requestBody = {
    include_profile_interstitial_type: '1',
    include_blocking: '1',
    include_blocked_by: '1',
    include_followed_by: '1',
    include_want_retweets: '1',
    include_mute_edge: '1',
    include_can_dm: '1',
    include_can_media_tag: '1',
    include_ext_is_blue_verified: '1',
    include_ext_verified_type: '1',
    include_ext_profile_image_shape: '1',
    skip_status: '1',
    user_id: userIdResult.value,
  };
  //
  const meProfile = await auth.me();
  // Prepare the headers
  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: `https://x.com/${meProfile?.username}/followers`,
    'X-Twitter-Active-User': 'yes',
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'X-Twitter-Client-Language': 'en',
    Authorization: `Bearer ${bearerToken}`,
  });

  await auth.installTo(headers, unFollowUserUrl);
  // Make the follow request using auth.fetch
  const res = await auth.fetch(unFollowUserUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(requestBody).toString(),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Failed to unfollow user: ${res.statusText}`);
  }

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
