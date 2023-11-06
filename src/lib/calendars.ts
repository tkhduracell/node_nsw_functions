import { writeFile as _writeFile } from 'fs'
import { Browser, Page, Protocol } from 'puppeteer'
import { promisify } from 'util'
import { mapKeys, sortBy, zip } from 'lodash'
import { getMessaging, Message } from 'firebase-admin/messaging'
import { FieldValue, Firestore } from 'firebase-admin/firestore'
import { addDays, differenceInDays, differenceInMinutes, format, parseISO } from 'date-fns'
import { Bucket } from '@google-cloud/storage'
import { sv } from 'date-fns/locale'
import { GCloudOptions, IDOActivityOptions } from '../env'

import fetch from 'cross-fetch'

const writeFile = promisify(_writeFile)

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

export async function restoreCookies(page: Page, db: Firestore) {
    const { ACTIVITY_ORG_ID } = IDOActivityOptions.parse(process.env)

    const document = await db.collection('browser')
        .doc(`org-${ACTIVITY_ORG_ID}`)
        .get()

    if (!document.exists) {
        console.warn('No cookies in database')
    }

    const { data: cookies } = document.data()! as { data: Protocol.Network.CookieParam[] }

    console.info(`Restored ${cookies.length} cookies`)

    await page.setCookie(...cookies)
}

async function calendars(page: Page) {
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
        link: a.attributes.getNamedItem('href')?.textContent ?? '(not found)',
        id: a.attributes.getNamedItem('href')?.textContent?.replace('/Calendars/View/', '') ?? '(not found)'
    })))

    return Promise.all(calendars)
}

export async function calendar(browser: Browser, bucket?: Bucket, db?: Firestore, useSavedCookies = false) {
    const { ACTIVITY_BASE_URL } = IDOActivityOptions.parse(process.env)

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(1000 * 60 * 5);
    page.setDefaultTimeout(1000 * 60 * 1);

    await page.setViewport({ height: 720, width: 1280, hasTouch: false, isMobile: false })

    if (db && useSavedCookies) {
        console.log('Fetching previous cookies')
        await restoreCookies(page, db)
    } else {
        console.log('Logging in')
        const coookies = await login(browser, db)
        page.setCookie(...coookies)
    }

    console.log('Finding calendars')
    const cals = await calendars(page)

    console.log('Extracting cookies')
    const cookies = await page.cookies();
    const cookie = cookies.map(ck => ck.name + '=' + ck.value).join(';');

    for (const cal of cals) {
        // link: '/Calendars/View/333892'
        const today = new Date()
        const lastquater = new Date(today.getTime() - 1000 * 3600 * 24 * 90)
        const inayear = new Date(today.getTime() + 1000 * 3600 * 24 * 366)

        const file = `/tmp/cal_${cal.id}.ics`
        const start = `${lastquater.toISOString().replace(/(.*)T.*/, '$1')}+00%3A00%3A00`
        const end = `${inayear.toISOString().replace(/(.*)T.*/, '$1')}+00%3A00%3A00`

        console.log(`Downloading - ${cal.name} (${cal.id})`)
        const response = await fetch(`${ACTIVITY_BASE_URL}/activities/exportactivitiestoical?calendarId=${cal.id}&startTime=${start}&endTime=${end}&freeText=&activityTypes=`, {
            method: 'GET',
            headers: { cookie }
        })
        const { text, events } = postprocess(await response.text(), cal)
        console.log(`Processed - ${cal.name}`)

        console.log(`Saving - ${cal.name}`)
        await writeFile(file, text)
        console.log(`Wrote -  ${cal.name} to ${file}`)

        const compactISO = (d: Date) => d.toISOString().replace(/[-:]|\.[0-9]+/g, '')

        const metadata = {
            calendar_name: cal.name,
            calendar_id: cal.id,
            calendar_last_uid: '',
            calendar_last_date: '',
            updated_at: FieldValue.serverTimestamp()
        }

        if (db && cal.id === '337667') {
            const prev = await db.collection('calendars')
                .doc(cal.id ?? '')
                .get()
            const calendar_last_date = prev.data()?.calendar_last_date
            const calendar_last_uid = prev.data()?.calendar_last_uid

            const newEvents = sortBy(events, e => e.uid)
                .filter(e => e.date >= compactISO(new Date())) // Must be in future
                .filter(e => e.date < compactISO(addDays(new Date(), 14))) // No more than 2 weeks

            const nextEvent = newEvents.find(e => e.uid > calendar_last_uid) // Anyone larger than current

            console.log(
                'Found', newEvents.length,
                JSON.stringify({
                    calendar_last_date,
                    calendar_last_uid,
                    next_event: nextEvent,
                    next_events: newEvents,
                }))
            if (nextEvent) {
                await notifyNewEvent(text, nextEvent, cal.id, cal.name)
            } else {
                console.warn("No next event found")
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
            await bucket.upload(file, { destination, metadata: { metadata: { ...metadata, calendar_self  }  } })
        }

        if (db) {
            await db.collection('calendars')
                .doc(cal.id ?? '')
                .set(metadata, { merge: true })
        }
    }

    if (bucket) {
        const [files] = await bucket.getFiles({ prefix: 'cal_' })

        const metadatas = await Promise.all(files.map(f => f.getMetadata()))
        const data = metadatas.map(([{ metadata }]) => mapKeys(metadata, (_, k) => k.replace('calendar_', '')))
        const payload = JSON.stringify(data, null, 2)

        const file = `/tmp/index.json`
        await writeFile(file, payload)
        await bucket.upload(file, { destination: 'index.json' })
    }
}

function sleep(ms: number = 20000) {
    return new Promise((res, rej) => setTimeout(res, ms))
}

export function postprocess(content: string, calendar: { name: string }) {
    const new_fields = [
        'URL:https://nackswinget.se/Kalender',
        `NAME:${calendar.name}`,
    ]
    const text = content.replace(/(X-WR-CALNAME):.*/gi, `\$1:${calendar.name}\n${new_fields.join('\n')}`)

    const dates = [...text.matchAll(/DTSTART:.*/gi)].map(s => s[0].replace('DTSTART:', ''))
    const uids = [...text.matchAll(/UID:.*/gi)].map(s => s[0].replace('UID:', ''))

    const events = zip(dates, uids).map(([date, uid]) => ({ date, uid })) as { date: string, uid: string }[]
    return { text, events }
}

async function notifyNewEvent(text: string, e: { date: string, uid: string }, calendar_id: string, calendar_name: string){

    const event = [...text.matchAll(/BEGIN:VEVENT[\s\S]+?UID:(\d+)[\s\S]+?END:VEVENT/ig)]
        .map(s => s[0])
        .filter(evt => evt.includes(`UID:${e.uid}`))
        .find(() => true)

    const start = (event ?? '').match(/DTSTART:(.*)/)?.reverse().map(s => parseISO(s)).find(() => true)
    const end = (event ?? '').match(/DTEND:(.*)/)?.reverse().map(s => parseISO(s)).find(() => true)
    const summary = (event ?? '').match(/SUMMARY:(.*)/)?.reverse().find(() => true)
    const duration = end && start ? differenceInMinutes(end, start) : null

    if (!start || !end) {
        console.log('Event without start & end', { start, end, duration, summary })
        return
    }

    const topicName = `calendar-${calendar_id}`;

    const message: Message = {
        notification: {
            title: getNotificationTitle(calendar_name),
            body: getNotificationBody(start, end, duration),
        },
        webpush: {
            notification: {
                tag: 'nsw-' + topicName,
                icon: "https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg",
            }
        },
        topic: topicName,
    }
    console.log('New event!', JSON.stringify({ ...message.notification, summary }))

    await getMessaging().send(message)
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
