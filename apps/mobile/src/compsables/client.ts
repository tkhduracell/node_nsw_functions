import { getPlatforms } from "@ionic/vue"
import { format } from "date-fns"
import { groupBy, sortBy } from "lodash"
import { InjectionKey, inject, provide } from "vue"

const clientKey = Symbol() as InjectionKey<NswApiClient>
const baseUrlKey = Symbol() as InjectionKey<string>

export function provideClient() {
    const platforms = getPlatforms()
    // eslint-disable-next-line no-extra-boolean-cast
    const baseUrlAlt = !!(platforms.includes('ios') || platforms.includes('android'))
    ? 'https://europe-north1-nackswinget-af7ef.cloudfunctions.net'
    : '/api'
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? baseUrlAlt
    const bucket = import.meta.env.VITE_BUCKET ?? 'nackswinget-af7ef.appspot.com'
    const client = new NswApiClient(baseUrl, bucket)
    provide(baseUrlKey, baseUrl)
    provide(clientKey, client)
    return client
}

export function useBaseUrl() {
  const baseUrl = inject(baseUrlKey)
  if (!baseUrl) {
      throw new Error('No baseUrl provided')
  }
  return { baseUrl }
}

export function useClient() {
    const client = inject(clientKey)
    if (!client) {
        throw new Error('No client provided')
    }
    return { client }
}

export interface Activity {
  id: number;
  calendarId: number;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  duration: number;
}

export class NswApiClient {
    readonly baseUrl: string
    readonly bucket: string

    constructor(baseUrl: string, bucket: string) {
      this.baseUrl = baseUrl
      this.bucket = bucket
    }

    async searchByDateRange(calendarId = '337667', days = 30): Promise<{ date: string, json: Activity[] }[]> {
      const all = await fetch(`https://storage.googleapis.com/${this.bucket}/${calendarId}.${days}d.json`)
        .then(resp => resp.json() as Promise<Activity[]>)
      const grouped = groupBy(all, a => format(a.startTime, 'yyyy-MM-dd'))

      return sortBy(Object.keys(grouped), i => i)
        .map(date => ({ json: grouped[date], date }))
    }

    async isSubscribed(token: string, topic: string): Promise<boolean> {
      const query = new URLSearchParams()
      query.append('token', token)
      query.append('topic', topic)

      const resp = await fetch(`${this.baseUrl}/notifications-api/status?${query.toString()}`, { method: 'POST' })
      if (resp.ok) {
        const { subscribed } = await resp.json() as { subscribed: boolean }
        return subscribed
      } else {
        throw new Error(`Failed to fetch status ${resp.url}: ${resp.status}`)
      }
    }

    async subscribe(token: string, topic: string) {
      const query = new URLSearchParams()
      query.append('token', token)
      query.append('topic', topic)

      const resp = await fetch(`${this.baseUrl}/notifications-api/subscribe?${query.toString()}`, { method: 'POST' })
      if (resp.ok) {
        return true
      } else {
        throw new Error('Failed to subscribe ' + resp.url + ': ' + resp.status)
      }
    }

    async unsubscribe(token: string, topic: string) {
      const query = new URLSearchParams()
      query.append('token', token)
      query.append('topic', topic)

      const resp = await fetch(`${this.baseUrl}/notifications-api/unsubscribe?${query.toString()}`, { method: 'POST' })
      if (resp.ok) {
        return true
      } else {
        throw new Error('Failed to unsubscribe ' + resp.url + ': ' + resp.status)
      }
    }
  }
