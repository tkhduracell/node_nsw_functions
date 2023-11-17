import { writeFile as _writeFile } from 'fs'
import { Browser, Page, Protocol } from 'puppeteer'
import { mapKeys, pick, sortBy } from 'lodash'
import { getMessaging, Message } from 'firebase-admin/messaging'
import { FieldValue, Firestore } from 'firebase-admin/firestore'
import { addDays, differenceInDays, differenceInMinutes, format, parseISO } from 'date-fns'
import { Bucket } from '@google-cloud/storage'
import { sv } from 'date-fns/locale'
import { GCloudOptions, IDOActivityOptions } from '../env'

import { ICalCalendar, ICalEvent } from 'ical-generator'
import { ListedActivities } from './types'
import { fetchActivities } from './booking'

const navigate = <T>(page: Page, action: () => Promise<T>): Promise<T> => Promise.all([ page.waitForNavigation(), action() ]).then(results => results[1] as T);

export async function login(browser: Browser, db?: Firestore) {
    const {
        ACTIVITY_ORG_ID,
        ACTIVITY_BASE_URL,
        ACTIVITY_USERNAME,
        ACTIVITY_PASSWORD,
    } = IDOActivityOptions.parse(process.env)

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(1000 * 60 * 5);
    page.setDefaultTimeout(1000 * 60 * 1);
    await page.setViewport({ height: 720, width: 1280, hasTouch: false, isMobile: false })

    // Login
    await page.goto(ACTIVITY_BASE_URL + '/');
    await page.type('#userName', ACTIVITY_USERNAME)
    await page.type('#loginForm > div:nth-child(4) > input', ACTIVITY_PASSWORD)
    await navigate(page, () => page.click('#loginForm > button'));

    // Select org
    await page.waitForSelector('#OrganisationSelect2')
    await page.select('#OrganisationSelect2', ACTIVITY_ORG_ID)
    await navigate(page, () => page.click('#login-button'));

    // Verify login state
    await page.waitForSelector('#PageHeader_Start > h1')

    const cookies = await page.cookies()

    if (db) {
        await db.collection('browser')
        .doc(`org-${ACTIVITY_ORG_ID}`)
        .set({ data: cookies, updated_at: FieldValue.serverTimestamp() }, { merge: false })
    }

    return cookies
}

export async function fetchCookies(db: Firestore) {
    const { ACTIVITY_ORG_ID } = IDOActivityOptions.parse(process.env)

    const document = await db.collection('browser')
        .doc(`org-${ACTIVITY_ORG_ID}`)
        .get()

    if (!document.exists) {
        console.warn('No cookies in database')
    }

    const { data: cookies } = document.data()! as { data: Protocol.Network.CookieParam[] }

    console.info(`Restored ${cookies.length} cookies`)

    return cookies
}

async function fetchCalendars(page: Page) {
    const {
        ACTIVITY_ORG_ID,
        ACTIVITY_BASE_URL,
    } = IDOActivityOptions.parse(process.env)

    await page.goto(`${ACTIVITY_BASE_URL}/Calendars/Index/${ACTIVITY_ORG_ID}`)

    console.log('Waiting for search button')
    await page.waitForSelector('#btnSearchKalender')
    await sleep(5000)

    console.log('Locating calendars in table')
    const calendarTds = await page.$$('td[data-title="Kalender"]')
    const calendars = calendarTds.map(d => d.$eval('a', a => ({
        name: a.innerText,
        id: a.attributes.getNamedItem('href')?.textContent?.replace('/Calendars/View/', '') ?? '(not found)'
    })))

    return Promise.all(calendars)
}

export async function calendar(browser: Browser, bucket?: Bucket, db?: Firestore, useSavedCookies = false, cals?: { id: string, name: string }[]) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(1000 * 60 * 5);
    page.setDefaultTimeout(1000 * 60 * 1);

    await page.setViewport({ height: 720, width: 1280, hasTouch: false, isMobile: false })

    let cookies = null
    if (db && useSavedCookies) {
        console.log('Fetching previous cookies')
        cookies = await fetchCookies(db)
    } else {
        console.log('Logging in')
        cookies = await login(browser, db)
    }

    if (!cals || cals.length === 0) {
        console.log('Restroing old cookies')
        page.setCookie(...cookies)

        console.log('Finding calendars')
        cals = await fetchCalendars(page)
    }

    for (const cal of cals) {

        const today = new Date()
        const lastquater = new Date(today.getTime() - 1000 * 3600 * 24 * 90)
        const inayear = new Date(today.getTime() + 1000 * 3600 * 24 * 366)

        console.log(`Fetching - ${cal.name} (${cal.id})`)
        const {data, response} = await fetchActivities(lastquater, inayear, cal.id, cookies)

        const calendar = postprocess(response.url, data, cal)
        console.log(`Processed - ${cal.name}`)

        const metadata = {
            calendar_name: cal.name,
            calendar_id: cal.id,
            calendar_last_uid: '',
            calendar_last_date: '',
            last_notifications: [] as (Awaited<ReturnType<typeof notifyNewEvent>> & { at: string })[],
            updated_at: FieldValue.serverTimestamp()
        }

        if (db) {
            const previous = await db.collection('calendars')
                .doc(cal.id ?? '')
                .get()
                .then(d => d.data())
            const calendar_last_date = previous?.calendar_last_date
            const calendar_last_uid = previous?.calendar_last_uid
            const last_notifications = previous?.last_notifications

            const newEvents = sortBy(calendar.events(), e => e.uid())
                .filter(e => e.start() >= new Date()) // Must be in future
                .filter(e => e.start() < addDays(new Date(), 6)) // No more than 6 days ahead
                .filter(e => e.uid() > calendar_last_uid) // Larger than last uid

            const newEvent = newEvents.find(e => true) // Take first

            console.log(
                'Found', newEvents.length,
                JSON.stringify({
                    calendar_last_date,
                    calendar_last_uid,
                    next_event: pick(newEvent, 'id', 'start', 'end', 'summary'),
                    next_events: newEvents,
                }))
            if (newEvent) {
                const eventNotifiation = await notifyNewEvent(newEvent, cal.id, cal.name)
                metadata.calendar_last_date = newEvent.start() as string
                metadata.calendar_last_uid = newEvent.uid()
                const notification = {
                    at: new Date().toISOString(),
                    id: newEvent.id(),
                    start: newEvent.start(),
                    desc: newEvent.description(),
                    notification: eventNotifiation
                }
                metadata.last_notifications = [...last_notifications, notification].slice(0, 5)

                await db.collection('calendars')
                    .doc(cal.id ?? '')
                    .set(metadata, { merge: true })
            } else {
                console.warn("No next event found")

                await db.collection('calendars')
                    .doc(cal.id ?? '')
                    .set({ updated_at: FieldValue.serverTimestamp()}, { merge: true })
            }
        }

        if (bucket) {
            const {
                GCLOUD_FUNCITON_GET_URL
            } = GCloudOptions.parse(process.env)

            const destination = `cal_${cal.id}.ics`
            const calendar_self = GCLOUD_FUNCITON_GET_URL ?
                `webcal://${GCLOUD_FUNCITON_GET_URL.replace(/https:\/\//gi, '')}?id=${cal.id}` : undefined

            console.log(`Uploading - ${cal.name} (${cal.id}) to ${bucket.cloudStorageURI}/${destination}`)
            await bucket.file(destination)
                .save(calendar.toString(), { metadata: { metadata: { ...metadata, calendar_self  } }})
        }
    }

    if (bucket) {
        const [files] = await bucket.getFiles({ prefix: 'cal_' })
        const metadatas = await Promise.all(files.map(f => f.getMetadata()))
        const data = metadatas.map(([{ metadata }]) => mapKeys(metadata, (_, k) => k.replace('calendar_', '')))
        const payload = JSON.stringify(data, null, 2)
        await bucket.file('index.json').save(payload)
    }
}

function sleep(ms: number = 20000) {
    return new Promise((res, rej) => setTimeout(res, ms))
}

export function postprocess(url: string, activities: ListedActivities, subject: { name: string, id: string }): ICalCalendar {
    const calendar = new ICalCalendar()
    calendar.name(subject.name)
    calendar.prodId({
        company: 'DK Nackswinget',
        product: subject.name,
        language: 'SV'
    })
    calendar.url('https://nackswinget.se/Kalender')
    calendar.timezone('Europe/Stockholm')
    calendar.source(url)

    for (const { listedActivity } of activities) {
        const { shared, activityId, startTime, endTime, name, venueName, description } = listedActivity

        // Ignore shared events
        if (shared) continue

        calendar.createEvent({
            start: parseISO(startTime),
            end: parseISO(endTime),
            summary: name,
            description: description,
            location: venueName ?? '',
            id: activityId
        });
    }

    return calendar
}

async function notifyNewEvent(event: ICalEvent, calendar_id: string, calendar_name: string): Exclude<Promise<Message['notification']>, undefined> {

    const duration = differenceInMinutes(event.end() as Date, event.start() as Date)
    const topicName = `calendar-${calendar_id}`;

    const message: Message = {
        notification: {
            title: getNotificationTitle(calendar_name),
            body: getNotificationBody(event.start() as Date, event.end() as Date, duration),
        },
        webpush: {
            notification: {
                tag: 'nsw-' + topicName,
                icon: "https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg",
            }
        },
        topic: topicName,
    }
    console.log('New event!', JSON.stringify({ ...message.notification, ...pick(event, 'id', 'start') }))

    await getMessaging().send(message)

    return message.notification
}

function getNotificationTitle(calendar_name: string) {
    return calendar_name === 'Friträning' ?  'Ny friträning bokad!' : `${calendar_name} uppdaterad`
}
function getNotificationBody(start: Date, end: Date, durationMin: number | null) {
    const date = format(start, 'do MMMM', { locale: sv })
    const hhmm = format(start, 'HH:mm',  { locale: sv })
    const hhmm_end = format(end, 'HH:mm',  { locale: sv })
    const inDays = differenceInDays(start, new Date())
    const weekday = format(start, 'EEEE', { locale: sv }).replace(/^./, s => s.toUpperCase())

    const suffix = `kl ${hhmm}-${hhmm_end}, ${durationMin} min`
    if (inDays < 7) {
        return `${weekday}, ${suffix}`
    } else {
        return `${weekday}, ${date}\n${suffix}`
    }
}
