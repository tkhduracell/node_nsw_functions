/* eslint-disable @typescript-eslint/no-unused-expressions */
/*
*   npm run demo
*/

import { formatInTimeZone } from 'date-fns-tz'
import { login } from './lib/calendars'

import { config } from 'dotenv'
import { initializeApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { addDays, addMinutes, formatDistanceStrict, parseISO, startOfDay } from 'date-fns'
import { fetchCookies } from './lib/cookies'
import { launchBrowser } from './calendars-update-api'
import { orderBy } from 'lodash'
import { IDOActivityOptions } from './env'
import { logger } from './logging'
import type { CalendarMetadata } from './lib/types'
import { ActivityApi } from './lib/booking'

config()

initializeApp({ projectId: 'nackswinget-af7ef' })

async () => {
    const date = '2023-11-18T23:00:00.000Z'

    const start = startOfDay(parseISO(date))
    const end = startOfDay(addDays(start, 1))

    logger.info({ start, end }, 'Start and end dates')
    logger.info({
        start: formatInTimeZone(start, 'Europe/Stockholm', 'yyyy-MM-dd HH:mm:ss'),
        end: formatInTimeZone(end, 'Europe/Stockholm', 'yyyy-MM-dd HH:mm:ss')
    })
};

(async () => {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)
    const db = getFirestore()
    const cookies = await fetchCookies(db, orgId)

    for (const cookie of orderBy(cookies, c => c.expires)) {
        if ((cookie as any).session) continue
        logger.info(new Date((cookie.expires ?? 0) * 1000).toISOString(), cookie.name, cookie.value)
    }
})()

async () => {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)

    const browser = await launchBrowser()
    const db = getFirestore()
    try {
        await login(browser, db, orgId)
    }
    catch (err) {
        logger.error(err)
    }
    finally {
        await browser.close()
    }

    process.exit(0)
}

async () => {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)

    const start = new Date('2023-11-09 14:00:00')
    const end = addMinutes(start, 60)

    const db = getFirestore()
    const cookies = await fetchCookies(db, orgId)

    const actApi = new ActivityApi(orgId, 'https://www.idrottonline.se', { get: () => cookies }, fetch)

    const result = await actApi.bookActivityRaw('337667', {
        name: 'Friträning',
        description: 'Filip 0702683230',
        start,
        end,
        venueName: 'Ceylon'
    })

    logger.debug('%o', result)
    process.exit(0)
}

async () => {
    const db = getFirestore()

    const list = await db.collection('calendars')
        .where('updated_at', '>=', new Date(0))
        .get()

    list.forEach((d) => {
        const data = d.data() as CalendarMetadata

        const updatedAt: Date = (data.updated_at as unknown as Timestamp).toDate()
        const calendarLastDate = parseISO(data.calendar_last_date ?? '')

        logger.info({
            ...data,
            // @ts-ignore
            updated_at: formatDistanceStrict(updatedAt, new Date(), { unit: 'hour' }),
            calendar_last_date: formatDistanceStrict(calendarLastDate, new Date(), { unit: 'hour' })
        })
    })
}
