import { TwitterAuth } from './auth';

export interface IpInfoResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}
export async function fetchIpInfo(auth: TwitterAuth): Promise<IpInfoResponse> {
  const response = await auth.fetch(`http://ip-api.com/json`);
  if (!response.ok) {
    console.error('Failed to fetch IP information:', await response.text());
    throw new Error('Failed to fetch IP information');
  }
  return response.json();
}
