import { writeFile as _writeFile } from 'fs'
import { launch, Page } from 'puppeteer'
import { promisify } from 'util'
import { max, mapKeys } from 'lodash'
import { getMessaging } from 'firebase-admin/messaging'
import { getFirestore } from 'firebase-admin/firestore'
import { differenceInMinutes, format, formatDistance, parseISO } from 'date-fns'
import { Bucket } from '@google-cloud/storage'
import { sv } from 'date-fns/locale'
import { GCloudOptions, IDOActivityOptions } from './env'
import { initializeApp } from 'firebase-admin/app'

const writeFile = promisify(_writeFile)

initializeApp()
const db = getFirestore()

export async function login(page: Page) {
    const {
        ACTIVITY_ORG_ID,
        ACTIVITY_BASE_URL,
        ACTIVITY_USERNAME,
        ACTIVITY_PASSWORD,
    } = IDOActivityOptions.parse(process.env)

    await page.goto(ACTIVITY_BASE_URL + '/');
    await page.type('#userName', ACTIVITY_USERNAME)
    await page.type('#loginForm > div:nth-child(4) > input', ACTIVITY_PASSWORD)

    await page.click('#loginForm > button')

    await page.waitForSelector('#OrganisationSelect2')
    await page.waitForSelector('#select2-OrganisationSelect2-container')
    // await page.click('#select2-OrganisationSelect2-container')
    await page.select('#OrganisationSelect2', ACTIVITY_ORG_ID)

    await page.click('#login-button')
    await page.waitForSelector('#PageHeader_Start > h1')

    const cookies = await page.cookies()
    await sleep(1000)
    return cookies
}

async function calendars(page: Page) {
    const {
        ACTIVITY_ORG_ID,
        ACTIVITY_BASE_URL,
    } = IDOActivityOptions.parse(process.env)

    await page.goto(`${ACTIVITY_BASE_URL}/Calendars/Index/${ACTIVITY_ORG_ID}`)

    await page.waitForSelector('#btnSearchKalender')
    await sleep(5000)

    const calendarTds = await page.$$('td[data-title="Kalender"]')
    const calendars = calendarTds.map(d => d.$eval('a', a => ({
        name: a.innerText,
        link: a.attributes.getNamedItem('href')?.textContent,
        id: a.attributes.getNamedItem('href')?.textContent?.replace('/Calendars/View/', '')
    })))

    return Promise.all(calendars)
}

export async function calendar(bucket: Bucket, headless = true, useCGS = false) {
    const {
        ACTIVITY_BASE_URL,
    } = IDOActivityOptions.parse(process.env)

    const browser = await launch({ headless });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(1000 * 60 * 5);
    page.setDefaultTimeout(1000 * 60 * 1);

    await page.setViewport({ height: 720, width: 1280, hasTouch: false, isMobile: false })

    console.log('Logging in')
    await login(page)

    console.log('Finding calendars')
    const cals = await calendars(page)

    const cookies = await page.cookies();
    const cookie = cookies.map(ck => ck.name + '=' + ck.value).join(';');

    try { await bucket.create() } catch (e) {}

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
        const { text, latest_date, latest_uid } = postprocess(await response.text(), cal)
        console.log(`Processed - ${cal.name}`, {latest_date, latest_uid})

        console.log(`Saving - ${cal.name}`)
        await writeFile(file, text)
        console.log(`Wrote -  ${cal.name} to ${file}`)

        const object = bucket.file(`cal_${cal.id}.ics`)
        const defaultMetadata = [{ metadata: { calendar_last_uid: '' } }]
        const [{ metadata: { calendar_last_uid } }] = await object.exists()
            ? await object.getMetadata() : defaultMetadata

        if ((latest_uid ?? '') > calendar_last_uid) {

            const event = [...text.matchAll(/BEGIN:VEVENT[\s\S]+?UID:(\d+)[\s\S]+?END:VEVENT/ig)]
                .map(s => s[0])
                .filter(evt => evt.includes(`UID:${latest_uid}`))
                .find(() => true)

            const start = (event ?? '').match(/DTSTART:(.*)/)?.reverse().map(s => parseISO(s)).find(() => true)
            const end = (event ?? '').match(/DTEND:(.*)/)?.reverse().map(s => parseISO(s)).find(() => true)
            const summary = (event ?? '').match(/SUMMARY:(.*)/)?.reverse().find(() => true)
            const duration = end && start ? differenceInMinutes(end, start) : null

            console.log('New event discovered!', { start, end, duration, summary })

            const topicName = `calendar-${cal.id}`;
            const body = start && end ? `${format(start, 'yyyy-MM-dd')} kl ${format(start, 'HH:mm')} (${formatDistance(start, end, { locale: sv })}) ${summary}` : summary
            const message = {
              notification: {
                title: cal.name === 'Friträning' ?  'Ny friträning inlagd' : `${cal.name} uppdaterad`,
                body
              },
              topic: topicName,
            }

            await getMessaging().send(message)
        }

        const metadata = {
            calendar_name: cal.name,
            calendar_id: cal.id,
            calendar_last_uid: latest_uid,
            calendar_last_data: latest_date,
        }

        if (useCGS) {
            const {
                GCLOUD_FUNCITON_GET_URL
            } = GCloudOptions.parse(process.env)

            const destination = `cal_${cal.id}.ics`
            const calendar_self = GCLOUD_FUNCITON_GET_URL ?
                `webcal://${GCLOUD_FUNCITON_GET_URL}?id=${cal.id}` : undefined

            console.log(`Uploading - ${cal.name} (${cal.id}) to ${bucket.cloudStorageURI}/${destination}`)
            await bucket.upload(file, { destination, metadata: { metadata: { ...metadata, calendar_self  }  } })
        }

        await db.collection('calendars').doc(cal.id ?? '').set(metadata, { merge: true })
    }

    await browser.close();

    if (useCGS) {
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
    const latest_date = max([...text.matchAll(/DTSTAMP:.*/gi)].map(s => s[0].replace('DTSTAMP:', ''))) ?? null
    const latest_uid = max([...text.matchAll(/UID:.*/gi)].map(s => s[0].replace('UID:', ''))) ?? null
    return { text, latest_date: latest_date ? parseISO(latest_date) : null, latest_uid }
}
