import { addHours, addMinutes, parseISO, addDays } from 'date-fns'

import { IDOActivityOptions } from '../env'
import { type ActivityCreateResponse, type ListedActivities } from './types'
import { formatInTimeZone } from 'date-fns-tz'
import { type Protocol } from 'puppeteer'
import { fetch } from 'cross-fetch'

export async function fetchActivitiesOnDate (date: string, calendarId: string, cookies: Protocol.Network.CookieParam[]) {
    const start = parseISO(date)
    const end = addDays(start, 1)
    console.log('Calling fetchActivities', { start, end })
    return await fetchActivities(start, end, calendarId, cookies)
}

export async function fetchActivities (start: Date, end: Date, calendarId: string, cookies: Protocol.Network.CookieParam[]) {
    const { ACTIVITY_BASE_URL } = IDOActivityOptions.parse(process.env)

    const suffix = encodeURIComponent('00:00:00')
    const startTime = `${formatInTimeZone(start, 'Europe/Stockholm', 'yyyy-MM-dd')}+${suffix}`
    const endTime = `${formatInTimeZone(end, 'Europe/Stockholm', 'yyyy-MM-dd')}+${suffix}`

    console.log('Fetching activities', { startTime, endTime })
    const response = await fetch(`${ACTIVITY_BASE_URL}/activities/getactivities?calendarId=${calendarId}&startTime=${startTime}&endTime=${endTime}`, {
        method: 'GET',
        headers: {
            cookie: cookies.map(ck => ck.name + '=' + ck.value).join(';'),
            Referer: `${ACTIVITY_BASE_URL}/Calendars/View/${calendarId}`,
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'x-requested-with': 'XMLHttpRequest',
            accept: 'application/json, text/javascript, */*; q=0.01'
        }
    })

    if (!response.ok) {
        throw new Error(`Error response ${response.status} ${response.statusText}`, { cause: await response.text() })
    }

    const data = await response.json()
    if (!(typeof data === 'object')) {
        throw new Error('No json response from API:', { cause: response.statusText })
    }

    return { data: data as ListedActivities, response }
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

export async function bookActivity (orgId: string, calendarId: string, { location, date, time, duration, title, description }: ActivityBooking, cookies: Protocol.Network.CookieParam[]): Promise<ActivityCreateResponse['activities'][0]> {
    const [hh, mm] = time.split(/[:$]/)

    const startOfDate = parseISO(date)
    const start = addMinutes(addHours(startOfDate, parseInt(hh)), parseInt(mm))
    const end = addMinutes(start, duration)

    console.log('Calling bookActivityRaw', { startOfDate, start, end })
    return await bookActivityRaw(orgId, calendarId, {
        name: title,
        description,
        venueName: location,
        start,
        end
    }, cookies)
}

export interface ActivityBookingRaw {
    venueName: string
    start: Date
    end: Date
    name: string
    description: string

}

export async function bookActivityRaw (orgId: string, calendarId: string, { venueName, start, end, name, description }: ActivityBookingRaw, cookies: Protocol.Network.CookieParam[]): Promise<ActivityCreateResponse['activities'][0]> {
    const {
        ACTIVITY_BASE_URL
    } = IDOActivityOptions.parse(process.env)

    const startDateTimeString = formatInTimeZone(start, 'Europe/Stockholm', 'yyyy-LL-dd HH:mm:ss')
    const endDateTimeString = formatInTimeZone(end, 'Europe/Stockholm', 'yyyy-LL-dd HH:mm:ss')

    const body = {
        activity: {
            calendarId,
            organisationId: parseInt(orgId),
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
    console.info('Boking activity', body.activity)

    const result = await fetch(`${ACTIVITY_BASE_URL}/Activities/SaveActivity`, {
        headers: {
            Referer: `${ACTIVITY_BASE_URL}/Activities/Create/?calendarId=null&isFromActivity=true`,
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            accept: 'application/json, text/javascript, */*; q=0.01',
            'accept-language': 'en-US,en;q=0.9,sv-SE;q=0.8,sv;q=0.7',
            'content-type': 'application/json',
            'x-requested-with': 'XMLHttpRequest',
            cookie: cookies.map(ck => ck.name + '=' + ck.value).join(';')
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
        throw new Error('Unable to create activity', { cause: json })
    }
    throw new Error('Unable to create activity', { cause: { url, ok, status, statusText } })
}
