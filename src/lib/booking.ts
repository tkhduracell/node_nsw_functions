import { Firestore } from 'firebase-admin/firestore';
import { fetchCookies } from "./calendars";
import {addHours, startOfDay, addMinutes, format, parseISO, formatISO} from 'date-fns'

import { IDOActivityOptions } from '../env';
import { ActivityCreateResponse, ListedActivities } from './types';
import { zonedTimeToUtc } from 'date-fns-tz';
import { Protocol } from 'puppeteer';
import { fetch } from 'cross-fetch'

export async function fetchActivities(start: Date, end: Date, calendarId: string, cookies: Protocol.Network.CookieParam[]) {
    const { ACTIVITY_BASE_URL } = IDOActivityOptions.parse(process.env)

    const startFmt = `${formatISO(zonedTimeToUtc(start, 'Europe/Stockholm'), { representation: 'date' })}+${encodeURIComponent('00:00:00')}`
    const endFmt = `${formatISO(zonedTimeToUtc(end, 'Europe/Stockholm'), { representation: 'date' })}+${encodeURIComponent('00:00:00')}`

    console.log({
        start, startZoned: zonedTimeToUtc(start, 'Europe/Stockholm'), startFmt,
        end, endZoned: zonedTimeToUtc(end, 'Europe/Stockholm'), endFmt
    })

    const response = await fetch(`${ACTIVITY_BASE_URL}/activities/getactivities?calendarId=${calendarId}&startTime=${startFmt}&endTime=${endFmt}`, {
        method: 'GET',
        headers: {
            "cookie": cookies.map(ck => ck.name + '=' + ck.value).join(';'),
            "Referer": `${ACTIVITY_BASE_URL}/Calendars/View/${calendarId}`,
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "x-requested-with": "XMLHttpRequest",
            "accept": "application/json, text/javascript, */*; q=0.01",
        }
    })

    if (!response.ok) {
        throw new Error(`Error response ${response.status} ${response.statusText}`, { cause: await response.text() })
    }

    const data = await response.json()
    if (!(typeof data === 'object')) {
        throw new Error("No json response from API:", { cause: response.statusText })
    }

    return { data: data as ListedActivities, response }
}

export type ActivityBooking = {
    location: string,
    /* 2023-11-15T23:00:00.000Z */
    date: string,
    time: string,
    duration: number,
    title: string,
    description: string
}

export async function bookActivity(db: Firestore, calendarId: string = "337667", { location, date, time, duration, title, description }: ActivityBooking): Promise<ActivityCreateResponse['activities'][0]> {
    const [hh, mm] = time.split(/[:$]/)

    const start = addMinutes(addHours(startOfDay(parseISO(date)), parseInt(hh)), parseInt(mm))
    const end = addMinutes(start, duration)

    return bookActivityRaw(db, calendarId, {
        name: title,
        description,
        venueName: location,
        start,
        end
    })
}

export type ActivityBookingRaw = {
    venueName: string,
    start: Date,
    end: Date,
    name: string,
    description: string

}

export async function bookActivityRaw(db: Firestore, calendarId: string = "337667", { venueName, start, end, name, description }: ActivityBookingRaw): Promise<ActivityCreateResponse['activities'][0]> {
    const {
        ACTIVITY_ORG_ID,
        ACTIVITY_BASE_URL,
    } = IDOActivityOptions.parse(process.env)


    const cookies = await fetchCookies(db);
    const cookie = cookies.map(ck => ck.name + '=' + ck.value).join(';')

    const body = {
        activity: {
          calendarId,
          organisationId: parseInt(ACTIVITY_ORG_ID),
          sportId: '63',
          shared: false,
          venue: { venueName },
          activityTypeId: '1',
          startDateTimeString: format(zonedTimeToUtc(start, 'Europe/Stockholm'), "yyyy-LL-dd HH:mm:ss"), // '2023-11-12 17:21:00',
          endDateTimeString: format(zonedTimeToUtc(end, 'Europe/Stockholm'), "yyyy-LL-dd HH:mm:ss"), // '2023-11-12 18:00:00',
          allDayActivity: false,
          name,
          description,
          spansMultipleDays: false,
        },
        reSendSummon: false,
    }

    const result = await fetch(`${ACTIVITY_BASE_URL}/Activities/SaveActivity`, {
        "headers": {
            "Referer": `${ACTIVITY_BASE_URL}/Activities/Create/?calendarId=null&isFromActivity=true`,
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9,sv-SE;q=0.8,sv;q=0.7",
            "content-type": "application/json",
            "x-requested-with": "XMLHttpRequest",
            cookie,
        },
        body: JSON.stringify(body),
        method: "POST"
    });

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