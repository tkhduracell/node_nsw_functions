import { addHours, addMinutes, parseISO, addDays } from 'date-fns'

import { HttpFetch, type ActivityCreateResponse, type ListedActivities } from './types'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { type Protocol } from 'puppeteer'
import { logger } from '../logging'
import z from 'zod'

export interface CookieProvider {
    get(): Protocol.Network.CookieParam[]
}

export type ActivityResult = Pick<ActivityCreateResponse['activities'][number], 'activityId'>

export class ActivityApi {
    constructor(private readonly orgId: string, private readonly baseUrl: string, private readonly cookies: CookieProvider, private readonly fetch: HttpFetch) {
        this.orgId = orgId
        this.cookies = cookies
        this.baseUrl = baseUrl
        this.fetch = fetch
    }

    async fetchActivitiesOnDate(date: string, calendarId: string) {
        const start = parseISO(date)
        const end = addDays(start, 1)
        return await this.fetchActivities(start, end, calendarId)
    }

    async fetchActivities(start: Date, end: Date, calendarId: string) {
        const suffix = encodeURIComponent('00:00:00')
        const startTime = `${formatInTimeZone(start, 'Europe/Stockholm', 'yyyy-MM-dd')}+${suffix}`
        const endTime = `${formatInTimeZone(end, 'Europe/Stockholm', 'yyyy-MM-dd')}+${suffix}`

        logger.info('Fetching activities: %o', { startTime, endTime, id: calendarId })
        const response = await this.fetch(`${this.baseUrl}/activities/getactivities?calendarId=${calendarId}&startTime=${startTime}&endTime=${endTime}`, {
            method: 'GET',
            headers: {
                'cookie': this.cookies.get().map(ck => ck.name + '=' + ck.value).join(';'),
                'Referer': `${this.baseUrl}/Calendars/View/${calendarId}`,
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'x-requested-with': 'XMLHttpRequest',
                'accept': 'application/json, text/javascript, */*; q=0.01'
            }
        })

        if (!response.ok) {
            throw new Error(`Error response ${response.status} ${response.statusText}: ${await response.text()}`)
        }

        const data = await response.json()

        const schema = z.array(z.object({}))

        const state = schema.safeParse(data)
        if (!state.success) {
            logger.warn(state.error, 'Invalid payload from API (%s %s): %o', response.status, response.statusText, data)
            throw new Error('No json response from API: ' + JSON.stringify(data))
        }

        return { data: data as ListedActivities, response }
    }

    async bookActivity(calendarId: string, { location, date, time, duration, title, description }: ActivityBooking): Promise<ActivityResult> {
        const startOfDate = parseDateString()
        const { start, end } = parseTimeString()

        logger.info('Calling bookActivityRaw %o', { activity: { startOfDate, start, end } })
        return await this.bookActivityRaw(calendarId, {
            name: title,
            description,
            venueName: location,
            start,
            end
        })

        function parseTimeString() {
            const [hours, minutes] = time.split(/[:$]/)
            const start = addMinutes(addHours(startOfDate, parseInt(hours)), parseInt(minutes))
            const end = addMinutes(start, duration)
            return { start, end }
        }

        function parseDateString() {
            if (date.match(/^\d{4}-\d{2}-\d{2}$/gi)) {
                return fromZonedTime(date, 'Europe/Stockholm')
            }
            return parseISO(date)
        }
    }

    async bookActivityRaw(calendarId: string, { venueName, start, end, name, description }: ActivityBookingRaw): Promise<ActivityResult> {
        const startDateTimeString = formatInTimeZone(start, 'Europe/Stockholm', 'yyyy-LL-dd HH:mm:ss')
        const endDateTimeString = formatInTimeZone(end, 'Europe/Stockholm', 'yyyy-LL-dd HH:mm:ss')
        const body = {
            activity: {
                calendarId,
                organisationId: parseInt(this.orgId),
                sportId: '63',
                shared: false,
                venue: { venueName },
                activityTypeId: '1',
                startDateTimeString, // '2023-11-12 17:21:00',
                endDateTimeString, // '2023-11-12 18:00:00',
                allDayActivity: false,
                name,
                description,
                spansMultipleDays: false
            },
            reSendSummon: false
        }

        if (description.toLowerCase().startsWith('test - ')) {
            logger.info('Testing of SaveActivity, ignoring %o', { activity: body.activity })
            return { activityId: 0 }
        }

        logger.info('Calling IDO SaveActivity %o', { activity: body.activity })

        const result = await this.fetch(`${this.baseUrl}/Activities/SaveActivity`, {
            headers: {
                'Referer': `${this.baseUrl}/Activities/Create/?calendarId=null&isFromActivity=true`,
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'en-US,en;q=0.9,sv-SE;q=0.8,sv;q=0.7',
                'content-type': 'application/json',
                'x-requested-with': 'XMLHttpRequest',
                'cookie': this.cookies.get().map(ck => ck.name + '=' + ck.value).join(';')
            },
            body: JSON.stringify(body),
            method: 'POST'
        })

        const { url, ok, status, statusText } = result
        if (ok) {
            const json = await result.json() as ActivityCreateResponse
            if (json.success) {
                const [out] = json.activities
                return out
            }
            logger.error({ json }, 'Unable to create activity: %o', { json })
            throw new Error('Unable to create activity')
        }
        logger.warn('Unable to create activity due to IDO error: %o', { url, ok, status, statusText })
        throw new Error('Unable to create activity')
    }
}

export interface ActivityBooking {
    location: string
    /* 2023-11-15T23:00:00.000Z */
    date: string
    time: string
    duration: number
    title: string
    description: string
}

export interface ActivityBookingRaw {
    venueName: string
    start: Date
    end: Date
    name: string
    description: string
}
