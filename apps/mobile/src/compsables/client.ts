import { getPlatforms } from "@ionic/vue"
import { addDays, format } from "date-fns"
import { InjectionKey, inject, provide } from "vue"

const clientKey = Symbol() as InjectionKey<NswApiClient>
const baseUrlKey = Symbol() as InjectionKey<string>

export function provideClient() {
    const platforms = getPlatforms()
    // eslint-disable-next-line no-extra-boolean-cast
    const baseUrlAlt = !!(platforms.includes('ios') || platforms.includes('android'))
    ? 'https://europe-north1-nackswinget-af7ef.cloudfunctions.net'
    : '/api'
    const baseUrl = import.meta.env.VITE_API_BASE_URL || baseUrlAlt

    const client = new NswApiClient(baseUrl)
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

    constructor(baseUrl: string) {
      this.baseUrl = baseUrl
    }

    async searchByDate(date: string): Promise<Activity[]> {
      const query = new URLSearchParams()
      query.append('date', date)
      return await fetch(`${this.baseUrl}/calendars-api/book/search?${query.toString()}`)
        .then(resp => resp.json() as Promise<Activity[]>)
    }

    async searchByDateRange(date: Date, days: number): Promise<{ date: string, json: Activity[] }[]> {
      const dates = Array.from({ length: days }, (_, index) =>
        format(addDays(date, index), 'yyyy-MM-dd')
      );
      const results = dates.map(date => this.searchByDate(date)
        .then(json => ({ json, date }))
      )
      return await Promise.all(results)
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
