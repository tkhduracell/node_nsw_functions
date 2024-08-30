import { getPlatforms } from "@ionic/vue"
import { App } from '@capacitor/app'
import { format } from "date-fns"
import { groupBy, sortBy } from "lodash"
import { InjectionKey, inject, provide } from "vue"
import { News } from "./news"
import axios from "axios"

export const Keys = {
  Client: Symbol() as InjectionKey<NswApiClient>,
  BaseUrl: Symbol() as InjectionKey<string>
}

export function provideClient() {
    const platforms = getPlatforms()
    // eslint-disable-next-line no-extra-boolean-cast
    const baseUrlAlt = !!(platforms.includes('ios') || platforms.includes('android'))
    ? 'https://europe-north1-nackswinget-af7ef.cloudfunctions.net'
    : '/api'

    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? baseUrlAlt
    const bucket = import.meta.env.VITE_BUCKET ?? 'nackswinget-af7ef.appspot.com'
    const client = new NswApiClient(baseUrl, bucket)
    provide(Keys.BaseUrl, baseUrl)
    provide(Keys.Client, client)
    return client
}

export function useBaseUrl() {
  const baseUrl = inject(Keys.BaseUrl)
  if (!baseUrl) {
      throw new Error('No baseUrl provided')
  }
  return { baseUrl }
}

export function useClient() {
    const client = inject(Keys.Client)
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

export type ActivityInit = {
  title: string;
  description: string;
  location: string;
  calendarId: string;
  date:  string;
  time: string;
  duration: number;
  password: string;
}

export class NswApiClient {
    readonly baseUrl: string
    readonly bucketUrl: string
    readonly headers: Record<string, string> = {}

    constructor(baseUrl: string, bucket: string) {
      this.baseUrl = baseUrl
      this.bucketUrl = `https://storage.googleapis.com/${bucket}`
      this.retrieveAppInfo().then((metadata) => {
        Object.assign(this.headers, metadata)
      })

      axios.interceptors.request.use(request => {
        // log resuest method url
        console.info('REQ', request.method?.toUpperCase(), request.url, request.params) 
        return request
      })
      axios.interceptors.response.use(response => {
        // log response method, url, status, status text
        console.info('RESP', response.config.method?.toUpperCase(), response.config.url, response.config.params, '⏩️',
          response.status, response.statusText)
        return response
      })
    }

    async retrieveAppInfo() {
      const info = await App.getInfo()
      return { 
        'x-app-version': info.version, 
        'x-app-id': info.id, 
        'x-app-build': info.build, 
        'x-app-name': info.name 
      }
    }

    async news(): Promise<News> {
      const url = `${this.bucketUrl}/news.json`
      return await axios.get<News>(url, { 
        headers: this.headers, 
      }).then(resp => resp.data)
    }

    async searchByDateRange(calendarId = '337667', days = 30): Promise<{ date: string, json: Activity[] }[]> {
      const url = `${this.bucketUrl}/${calendarId}.${days}d.json`
      const all = await axios.get<Activity[]>(url, { 
        headers: this.headers,
      }).then(resp => resp.data)

      const grouped = groupBy(all, a => format(new Date(a.startTime), 'yyyy-MM-dd'))

      return sortBy(Object.keys(grouped), i => i)
        .map(date => ({ json: grouped[date], date }))
    }

    async searchByDate(date: string): Promise<Activity[]> {
      const url = `${this.baseUrl}/calendars-api/book/search`
      return await axios.get<Activity[]>(url, { 
        params: { date },
        headers: this.headers 
      })
        .then(response => {
          if (!Array.isArray(response.data)) {
            throw new Error(response.data)
          }
          return response.data
        })
    }

    async book(activity: ActivityInit) {
      return axios.post<{ success: boolean }>(`${this.baseUrl}/calendars-api/book`, activity, { headers: this.headers })
        .then(resp => resp.data)
    }

    async isSubscribed(token: string, topic: string): Promise<boolean> {
      const resp = await axios.post<{ subscribed: boolean }>(`${this.baseUrl}/notifications-api/status`, undefined, { 
        params: { token, topic },
        headers: this.headers 
      })
      if (resp.status === 200) {
        return resp.data.subscribed
      } else {
        throw new Error(`Failed to fetch status ${resp.config.url}: ${resp.status} ${resp.statusText}`)
      }
    }

    async subscribe(token: string, topic: string) {
      const resp = await axios.post(`${this.baseUrl}/notifications-api/subscribe`, undefined, { 
        params: { token, topic }, 
        headers: this.headers 
      })
      if (resp.status === 200) {
        return true
      } else {
        throw new Error(`Failed to subscribe ${resp.config.url}: ${resp.status} ${resp.statusText}`)
      }
    }

    async unsubscribe(token: string, topic: string) {
      const resp = await axios.post(`${this.baseUrl}/notifications-api/unsubscribe`, undefined, {
        params: { token, topic }, 
        headers: this.headers 
      })
      if (resp.status === 200) {
        return true
      } else {
        throw new Error(`Failed to unsubscribe ${resp.config.url}: ${resp.status} ${resp.statusText}`)
      }
    }
  }
