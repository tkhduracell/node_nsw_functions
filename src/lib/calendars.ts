import { type Browser, type Page, type Protocol } from 'puppeteer'
import { mapKeys, pick, sortBy } from 'lodash'
import { getMessaging, type Message } from 'firebase-admin/messaging'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { addDays, formatDistance } from 'date-fns'
import { type Bucket } from '@google-cloud/storage'
import { sv } from 'date-fns/locale'
import { IDOActivityOptions } from '../env'

import { type ICalEvent } from 'ical-generator'
import { fetchActivities } from './booking'
import { fetchCookies } from './cookies'
import { getNotificationBody, getNotificationTitle } from './notification-builder'
import { buildCalendar } from './ical-builder'
import { type CalendarMetadataData, type CalendarMetadata, type Calendars, type CalendarNotification } from './types'
import { logger } from '../logging'

const navigate = async <T>(page: Page, action: () => Promise<T>): Promise<T> => await Promise.all([page.waitForNavigation(), action()]).then(results => results[1] as T)

export async function login (browser: Browser, db: Firestore, orgId: string) {
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

async function fetchCalendars (page: Page, orgId: string): Promise<Calendars> {
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

export async function update (browser: Browser, bucket: Bucket, db: Firestore, orgId: string) {
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

        await updateCalendarContent(cals, cookies, bucket, db)
    } catch (err) {
        throw new Error('Unable to do a full update', { cause: err })
    }
}

export async function updateLean (bucket: Bucket, db: Firestore, orgId: string) {
    try {
        logger.info('Fetching previous cookies', { orgId })
        const cookies = await fetchCookies(db, orgId)

        const cals = await fetchPreviousCalendars(db, orgId)
        await updateCalendarContent(cals, cookies, bucket, db)
    } catch (err) {
        throw new Error('Unable to do a lean update', { cause: err })
    }
}

export async function status (db: Firestore, orgId: string) {
    const calendars = await db.collection('calendars')
        .where('calendar_org_id', '==', orgId)
        .get()

    const data = calendars.docs.map(d => d.data() as CalendarMetadataData)

    return data.map(cal => {
        return {
            ...cal,
            calendar_last_uid: undefined,
            calendar_last_date: undefined,
            updated_at: cal.updated_at.toDate(),
            updated_ago: formatDistance(cal.updated_at.toDate(), new Date(), { locale: sv, addSuffix: true })
        }
    })
}

export async function updateCalendarContent (cals: Calendars, cookies: Protocol.Network.CookieParam[], bucket: Bucket, db: Firestore) {
    const today = new Date()
    const lastquater = new Date(today.getTime() - 1000 * 3600 * 24 * 90)
    const inayear = new Date(today.getTime() + 1000 * 3600 * 24 * 366)

    for (const cal of cals) {
        logger.info('Fetching activities', {cal, lastquater, inayear})
        const { data, response } = await fetchActivities(lastquater, inayear, cal.id, cookies)

        const calendar = buildCalendar(response.url, data, cal)
        logger.info('Built ICalendar successfully', { cal })

        const metadata: CalendarMetadata = {
            calendar_name: cal.name,
            calendar_id: cal.id,
            calendar_org_id: cal.orgId,
            calendar_last_uid: '',
            calendar_last_date: '',
            last_notifications: [] as CalendarMetadata['last_notifications'],
            updated_at: FieldValue.serverTimestamp() as unknown as Date
        }

        const previous = await db.collection('calendars')
            .doc(cal.id ?? '')
            .get()
            .then(d => d.data()) as CalendarMetadata
        logger.info('Read old metadata', {cal, previous})

        const calendar_last_uid = previous?.calendar_last_uid
        const last_notifications = previous?.last_notifications ?? []

        logger.info('Findning new events', { cal })
        const now = new Date()
        const nextWeekEvents = sortBy(calendar.events(), e => e.uid())
            .filter(e => e.start() >= now) // Must be in future
            .filter(e => e.start() < addDays(now, 6)) // No more than 6 days ahead

        const newEvents = nextWeekEvents
            .filter(e => e.uid() > calendar_last_uid) // Larger than last uid

        const newEvent = newEvents.find(e => true) // Take first

        logger.info(
            `Found ${newEvents.length} new events`,
            {
                cal,
                metadata,
                newEvent: pick(newEvent, 'id', 'start', 'end'),
                newEvents: newEvents.map(e => pick(e, 'id', 'start', 'end', 'summary')),
                nextWeekEvents: nextWeekEvents.map(e => pick(e, 'id', 'start', 'end', 'summary'))
            }
        )

        if (newEvent) {
            const description = newEvent.description()?.plain ?? ''
            let creator = null as string | null
            let contact = null as string | null
            if (description.match(/.* - \+?[0-9 ]+/gi)) {
                [creator, contact] = description.split(' - ')
            }
            const eventNotifiation = await notifyNewEvent(newEvent, cal.id, cal.name)
            metadata.calendar_last_date = newEvent.start() as string
            metadata.calendar_last_uid = newEvent.uid()
            const notification: CalendarNotification = {
                at: new Date().toISOString(),
                id: newEvent.id(),
                start: (newEvent.start() as Date).toISOString(),
                body: eventNotifiation?.body ?? '',
                title: eventNotifiation?.title ?? '',
                creator: creator?.trim() ?? '',
                contact: contact?.trim() ?? ''
            }

            metadata.last_notifications = [notification, ...last_notifications].slice(0, 5)
        } else {
            logger.warn('No next event found', { cal, metadata })
        }

        logger.info('Saving metadata', { cal, metadata })
        await db.collection('calendars')
            .doc(cal.id ?? '')
            .set({ ...metadata, updated_at: FieldValue.serverTimestamp() }, { merge: true })

        const destination = `cal_${cal.id}.ics`
        const file = bucket.file(destination)
        logger.info(`Uploading to ${file.cloudStorageURI.toString()}`,  { cal, metadata })
        await file
            .save(calendar.toString(), { metadata: { metadata } })
    }

    const [files] = await bucket.getFiles({ prefix: 'cal_' })
    const metadatas = await Promise.all(files.map(async f => await f.getMetadata()))
    const data = metadatas.map(([{ metadata }]) => mapKeys(metadata, (_, k) => k.replace('calendar_', '')))
    const payload = JSON.stringify(data, null, 2)
    await bucket.file('index.json').save(payload)
}

async function fetchPreviousCalendars (db: Firestore, orgId: string): Promise<Calendars> {
    const results = await db.collection('calendars')
        .where('calendar_org_id', '==', orgId)
        .get()

    if (results.size === 0) {
        throw new Error('No calendars in database')
    }

    return results.docs.map(d => d.data() as CalendarMetadata)
        .map(({ calendar_id: id, calendar_name: name }) => ({ name, id, orgId }))
}

async function sleep (ms: number = 20000) {
    return await new Promise((resolve, reject) => setTimeout(resolve, ms))
}

async function notifyNewEvent (event: ICalEvent, calendar_id: string, calendar_name: string): Exclude<Promise<Message['notification']>, undefined> {
    const topicName = `calendar-${calendar_id}`

    const message: Message = {
        notification: {
            title: getNotificationTitle(calendar_name),
            body: getNotificationBody(event.start() as Date, event.end() as Date)
        },
        webpush: {
            notification: {
                tag: 'nsw-' + topicName,
                icon: 'https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg'
            }
        },
        topic: topicName
    }
    logger.info('Sending notification for new event!', { message: message.notification, event: pick(event, 'id', 'start') })

    await getMessaging().send(message)

    return message.notification
}
