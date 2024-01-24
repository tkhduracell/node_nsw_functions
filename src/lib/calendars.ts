import { type Browser, type Page } from 'puppeteer'
import { mapKeys, pick, sortBy } from 'lodash'
import { getMessaging, type Message } from 'firebase-admin/messaging'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { addDays, formatDistance, subDays } from 'date-fns'
import { type Bucket } from '@google-cloud/storage'
import { sv } from 'date-fns/locale'
import { IDOActivityOptions } from '../env'

import { type ICalEvent } from 'ical-generator'
import { ActivityApi } from './booking'
import { fetchCookies } from './cookies'
import { Notifications } from './notifications'
import { buildCalendar } from './ical-builder'
import { type CalendarMetadata, type Calendars, type CalendarNotification, type CalendarMetadataUpdate } from './types'
import { logger } from '../logging'
import { Clock } from './clock'

const navigate = async <T>(page: Page, action: () => Promise<T>): Promise<T> => await Promise.all([page.waitForNavigation(), action()]).then(results => results[1] as T)

export async function login(browser: Browser, db: Firestore, orgId: string) {
    const {
        ACTIVITY_BASE_URL,
        ACTIVITY_USERNAME,
        ACTIVITY_PASSWORD
    } = IDOActivityOptions.parse(process.env)

    const page = await browser.newPage()
    page.setDefaultNavigationTimeout(1000 * 60 * 5)
    page.setDefaultTimeout(1000 * 60 * 1)
    await page.setViewport({ height: 720, width: 1280, hasTouch: false, isMobile: false })

    // Login
    await page.goto(ACTIVITY_BASE_URL + '/')
    await page.type('#userName', ACTIVITY_USERNAME)
    await page.type('#loginForm > div:nth-child(4) > input', ACTIVITY_PASSWORD)
    await navigate(page, async () => { await page.click('#loginForm > button') })

    // Select org
    await page.waitForSelector('#OrganisationSelect2')
    await page.select('#OrganisationSelect2', orgId)
    await navigate(page, async () => { await page.click('#login-button') })

    // Verify login state
    await page.waitForSelector('#PageHeader_Start > h1')

    // Add a delay to ensure the login process is completed
    await sleep(2000)

    const cookies = await page.cookies()

    await db.collection('browser')
        .doc(`org-${orgId}`)
        .set({ data: cookies, updated_at: FieldValue.serverTimestamp() }, { merge: false })

    await page.close()

    return cookies
}

async function fetchCalendars(page: Page, orgId: string): Promise<Calendars> {
    const {
        ACTIVITY_BASE_URL
    } = IDOActivityOptions.parse(process.env)

    await page.goto(`${ACTIVITY_BASE_URL}/Calendars/Index/${orgId}`)

    logger.info('Waiting for search button')
    await page.waitForSelector('#btnSearchKalender')
    await sleep(5000)

    logger.info('Locating calendars in table')
    const calendarTds = await page.$$('td[data-title="Kalender"]')
    const calendars = calendarTds.map(async d => await d.$eval('a', a => ({
        id: a.attributes.getNamedItem('href')?.textContent?.replace('/Calendars/View/', '') ?? '(not found)',
        name: a.innerText
    })))

    return await Promise.all(calendars).then(cals => cals.map(cal => ({ ...cal, orgId })))
}

export async function update(browser: Browser, bucket: Bucket, db: Firestore, clock: Clock, orgId: string) {
    const { ACTIVITY_BASE_URL: baseUrl } = IDOActivityOptions.parse(process.env)
    try {
        const cookies = await login(browser, db, orgId)

        const page = await browser.newPage()
        page.setDefaultNavigationTimeout(1000 * 60 * 5)
        page.setDefaultTimeout(1000 * 60 * 1)

        await page.setViewport({ height: 720, width: 1280, hasTouch: false, isMobile: false })

        logger.info('Restoring old cookies', { orgId })
        await page.setCookie(...cookies)

        logger.info('Finding calendars', { orgId })
        const cals = await fetchCalendars(page, orgId)

        const actApi = new ActivityApi(orgId, baseUrl, { get: () => cookies }, fetch)
        await updateCalendarContent(cals, actApi, clock, bucket, db)
    } catch (err) {
        throw new Error('Unable to do a full update', { cause: err })
    }
}

export async function updateLean(bucket: Bucket, db: Firestore, clock: Clock, orgId: string) {
    const { ACTIVITY_BASE_URL: baseUrl } = IDOActivityOptions.parse(process.env)
    try {
        logger.info('Fetching previous cookies', { orgId })
        const cookies = await fetchCookies(db, orgId)

        const actApi = new ActivityApi(orgId, baseUrl, { get: () => cookies }, fetch)
        const cals = await fetchPreviousCalendars(db, orgId)
        await updateCalendarContent(cals, actApi, clock, bucket, db)
    } catch (err) {
        throw new Error('Unable to do a lean update', { cause: err })
    }
}

export async function status(db: Firestore, orgId: string, clock: Clock) {
    const calendars = await db.collection('calendars')
        .where('calendar_org_id', '==', orgId)
        .get()

    const data = calendars.docs.map(d => d.data() as Partial<CalendarMetadata>)

    return data.map(cal => {
        return {
            calendar_last_uid: undefined,
            calendar_last_date: undefined,
            ...cal,
            updated_at: cal.updated_at?.toDate(),
            updated_ago: cal.updated_at ? formatDistance(cal.updated_at.toDate(), clock.now(), { locale: sv, addSuffix: true }) : undefined
        }
    })
}

export async function updateCalendarContent(cals: Calendars, actApi: ActivityApi, clock: Clock, bucket: Bucket, db: Firestore) {
    const today = clock.now()
    const lastquater = subDays(today, 90)
    const inayear = addDays(today, 366)
    const inaweek = addDays(today, 6)

    for (const cal of cals) {
        logger.info('Fetching activities', { cal, lastquater, inayear })
        const { data, response } = await actApi.fetchActivities(lastquater, inayear, cal.id)

        const calendar = buildCalendar(response.url, data, cal)
        logger.info(`Built ICalendar successfully with ${calendar.length()} events`, { cal })

        const metadata = await fetchMetadata(cal, db)

        logger.info('Sorting new events', { cal })
        const eventsByUid = sortBy(calendar.events(), e => e.uid())

        const futureEvents = eventsByUid
            .filter(e => e.start() >= today) // Must be in future
        logger.info(`Found ${futureEvents.length} future events`, { cal })

        const nextWeekEvents = futureEvents
            .filter(e => e.start() < inaweek)
        logger.info(`Found ${futureEvents.length} events within 6 days`, { cal })

        const newEvents = nextWeekEvents
            .filter(e => e.uid() > metadata.calendar_last_uid) // Larger than last uid
        logger.info(`Found ${futureEvents.length} new events`, { cal })

        const newEvent = newEvents.find(e => true) // Take first

        logger.info(
            `Found ${newEvents.length} new events`,
            {
                cal,
                newEvent: pick(newEvent?.toJSON(), 'id', 'start', 'end', 'summary'),
                nextWeekEvents: nextWeekEvents.map(e => pick(e?.toJSON(), 'id', 'start', 'end', 'summary'))
            }
        )

        if (newEvent) {
            const creator = newEvent.organizer()?.name ?? ''
            const data = await notifyNewEvent(clock, newEvent, creator, cal)
            metadata.calendar_last_date = newEvent.start() as string
            metadata.calendar_last_uid = newEvent.uid()

            const notification: CalendarNotification = {
                at: clock.now().toISOString(),
                ...data,
                event: {
                    id: newEvent.uid(),
                    start: (newEvent.start() as Date).toISOString(),
                    description: newEvent.description()?.plain ?? '',
                }
            }

            metadata.last_notifications = [notification, ...metadata.last_notifications].slice(0, 5)
        } else {
            logger.warn('No next event found', { cal, metadata })
        }

        const destination = `cal_${cal.id}.ics`
        const file = bucket.file(destination)

        logger.info(`Uploading to ${file.cloudStorageURI.toString()}`, { cal, metadata })
        await file.save(calendar.toString(), { metadata: {
            metadata,
            cacheControl: 'public, max-age=30',
            contentDisposition: `attachment; filename="${cal.name} - ${cal.id}.ics"`,
            contentLanguage: 'sv-SE',
            contentType: 'text/calendar; charset=utf-8',
        } })

        logger.info(`Ensuring public access of ${file.cloudStorageURI.toString()} as ${file.publicUrl()}`, { cal, metadata })
        await file.makePublic()

        logger.info('Saving metadata', { cal, metadata })
        await db.collection('calendars')
            .doc(cal.id ?? '')
            .set({
                ...metadata,
                size: calendar.length(),
                updated_at: FieldValue.serverTimestamp(),
                public_url: file.publicUrl()
            }, { merge: true })
    }

    const [files] = await bucket.getFiles({ prefix: 'cal_' })
    const metadatas = await Promise.all(files.map(async f => await f.getMetadata()))
    const data = metadatas.map(([{ metadata }]) => mapKeys(metadata, (_, k) => k.replace('calendar_', '')))
    const payload = JSON.stringify(data, null, 2)
    await bucket.file('index.json').save(payload)
}

async function fetchPreviousCalendars(db: Firestore, orgId: string): Promise<Calendars> {
    const results = await db.collection('calendars')
        .where('calendar_org_id', '==', orgId)
        .get()

    if (results.size === 0) {
        throw new Error('No calendars in database')
    }

    return results.docs.map(d => d.data() as CalendarMetadata)
        .map(({ calendar_id: id, calendar_name: name }) => ({ name, id, orgId }))
}

async function fetchMetadata(cal: Calendars[number], db: Firestore): Promise<CalendarMetadata> {
    const metadata: CalendarMetadata = {
        calendar_name: cal.name,
        calendar_id: cal.id,
        calendar_org_id: cal.orgId,
        calendar_last_uid: '',
        calendar_last_date: '',
        last_notifications: [] as CalendarMetadata['last_notifications'],
        updated_at: Timestamp.fromDate(new Date())
    }

    const previous = await db.collection('calendars')
        .doc(cal.id ?? '')
        .get()
        .then(d => d.data()) as CalendarMetadata

    Object.assign(metadata, previous)
    metadata.calendar_last_uid = metadata.calendar_last_uid ?? ''
    logger.info('Read old metadata', { cal, metadata })

    return metadata
}


async function sleep(ms: number = 20000) {
    return await new Promise((resolve, reject) => setTimeout(resolve, ms))
}

async function notifyNewEvent(clock: Clock, event: ICalEvent, creator: string | undefined, cal: Calendars[number]) {
    const builder = new Notifications(getMessaging());
    const message = await builder.send(clock, event, creator, cal)
    return message
}