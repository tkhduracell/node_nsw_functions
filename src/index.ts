import 'source-map-support/register'

import { http } from '@google-cloud/functions-framework'
import { Storage } from '@google-cloud/storage'
import { launch, Page } from 'puppeteer'
import { writeFile as _writeFile } from 'fs'
import { promisify } from 'util'
import { max, mapKeys, zip } from 'lodash'
import { differenceInMinutes, format, formatDistance, parseISO } from 'date-fns'
import { sv } from 'date-fns/locale'

import { initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

import fetch from 'cross-fetch'
import z from 'zod'

import {config} from 'dotenv'

config()

const {
    ACTIVITY_ORG_ID,
    ACTIVITY_BASE_URL,
    ACTIVITY_USERNAME,
    ACTIVITY_PASSWORD,
    GCLOUD_PROJECT,
    GCLOUD_BUCKET,
    GCLOUD_FUNCITON_GET_URL
} = z.object({
    ACTIVITY_ORG_ID: z.string().min(1),
    ACTIVITY_BASE_URL: z.string().url(),
    ACTIVITY_USERNAME: z.string().min(1),
    ACTIVITY_PASSWORD: z.string().min(1),
    GCLOUD_PROJECT: z.string().min(1),
    GCLOUD_BUCKET: z.string().min(1),
    GCLOUD_FUNCITON_GET_URL: z.string().url().optional()
}).parse(process.env)

const app = initializeApp({ projectId: GCLOUD_PROJECT });

const storage = new Storage({ projectId: GCLOUD_PROJECT });
const bucket = storage.bucket(GCLOUD_BUCKET)

const writeFile = promisify(_writeFile)

// Register an HTTP function with the Functions Framework that will be executed
// when you make an HTTP request to the deployed function's endpoint.
http('get', async (req, res) => {
    if (!req.query.id) {
        const [file] = await bucket.file('index.json').download()

        return res.header('Content-Type', 'application/json').send(file).end()
    }

    const id = z.string().regex(/\d+/).parse(req.query.id)

    const [{metadata}] = await bucket.file(`cal_${id}.ics`).getMetadata()

    res
        .setHeader('Content-Type', 'text/calendar')
        .setHeader('Content-Disposition', `attachment; filename="${metadata['CalendarName']}.ics"`)
        .status(200)

    bucket
        .file(`cal_${id}.ics`)
        .createReadStream()
        .pipe(res, { end: true })
});

http('competitions', async (req, res) => {
    const classTypes = z.enum(['X', 'N', 'R', '']).default('').parse(req.query.classTypes)

    await competitions(classTypes)

    res
        .setHeader('Content-Type', 'text/calendar')
        .setHeader('Content-Disposition', `attachment; filename="comp_${classTypes || 'all'}.ics"`)
        .status(200)
        .sendFile('/tmp/comp.ics')
});

http('update', async (req, res) => {
    const { dryrun } = z.object({ dryrun: z.enum(['true', 'false']) }).parse(req.query)
    if (dryrun === 'true') {

        const topicName = `calendar-337667`;
        const start = new Date();
        const end = new Date(new Date().getTime() + 3600000 * 3)
        const summary = "Friträning"
        const message = {
          notification: {
            title: 'Ny friträning inlagd',
            body: start && end ? `${format(start, 'yyyy-MM-dd')} kl ${format(start, 'HH:mm')} (${formatDistance(start, end, { locale: sv })}) ${summary}` : summary
          },
          topic: topicName,
        }
        console.log({ message })
        const resp = await getMessaging(app).send(message)

        console.log({ resp })
        return
    }
    await calendar(true, true)

    res.sendStatus(200)
});

http('subscribe', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
    const { token, topic } = z.object({ token: z.string(), topic: z.string() }).parse(req.query)
    const response = await getMessaging().subscribeToTopic(token, topic)
    console.log('Successfully subscribed to topic:', response)
    return res.status(200).send(response)
})

http('unsubscribe', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
    const { token, topic } = z.object({ token: z.string(), topic: z.string() }).parse(req.query)
    const response = await getMessaging().unsubscribeFromTopic(token, topic)
    console.log('Successfully unsubscribed from topic:', response)
    return res.status(200).send(response)
})


async function login(page: Page) {
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

    await sleep(1000)
}

async function calendars(page: Page) {
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

export async function calendar(headless = true, useCGS = false) {

    const out = await getMessaging().send({ // Try dl fb svc key and use it locally.
        notification: {
            title: 'Ny friträning inlagd',
            body: '2023-05-31 kl 01:00 (ungefär två timmar) Filip test 2'
        },
        topic: 'cal-337667'
      }, true)
    console.log(out)
    if (out) return;

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
        const [{ metadata }] = await object.exists() ? await object.getMetadata() : [{ metadata: {} }]
        console.log({ metadata })

        if ((latest_uid ?? '') > (metadata['calendar_last_uid'] ?? '')) {

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

            const message = {
              notification: {
                title: cal.name === 'Friträning' ?  'Ny friträning inlagd' : `${cal.name} uppdaterad`,
                body: start && end ? `${format(start, 'yyyy-MM-dd')} kl ${format(start, 'HH:mm')} (${formatDistance(start, end, { locale: sv })}) ${summary}` : summary
              },
              topic: topicName,
            }
            console.log({message})
            const resp = await getMessaging(app).send(message)
        }

        if (useCGS) {
            const destination = `cal_${cal.id}.ics`
            const metadata = {
                metadata: {
                    'calendar_name': cal.name,
                    'calendar_id': cal.id,
                    'calendar_last_uid': latest_uid,
                    'calendar_last_data': latest_date,
                    'calendar_self': GCLOUD_FUNCITON_GET_URL ? `webcal://${GCLOUD_FUNCITON_GET_URL}?id=${cal.id}` : undefined
                }
            }
            console.log(`Uploading - ${cal.name} (${cal.id}) to ${bucket.cloudStorageURI}/${destination}`)
            await bucket.upload(file, { destination, metadata })
        }
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
import { load } from 'cheerio'
import ical from 'ical-generator';

export async function competitions(classTypes?: 'R' | 'N' | 'X' | '') {
    const body = new URLSearchParams([
        [ 'cwi_db_FilterTemplate[filterName]', '' ],
        [ 'cwi_db_FilterTemplate[id]', '0' ],
        [ 'cwi_db_FilterTemplate[isDefault_sent]', '1' ],
        [ 'cwi_event_Events[branch]', 'mainBranchId_1001' ],
        [ 'cwi_event_Events[classTypes]', classTypes ?? '' ],
        [ 'cwi_event_Events[dateInterval][interval]', 'future' ],
        [ 'cwi_event_Events[dateInterval][maxDate]', '' ],
        [ 'cwi_event_Events[dateInterval][minDate]', '2023-01-01' ],
        [ 'cwi_event_Events[fedId]', '0' ],
        [ 'cwi_event_Events[firstRow]', '1' ],
        [ 'cwi_event_Events[isCanceled]', '' ],
        [ 'cwi_event_Events[lastSelectedArea]', 'filter' ],
        [ 'cwi_event_Events[maxRows]', '' ],
        [ 'cwi_event_Events[maxRowsEnum]', '50' ],
        [ 'cwi_event_Events[nailedTabs][compact_sent]"', '1' ],
        [ 'cwi_event_Events[nailedTabs][compact]"', '1' ],
        [ 'cwi_event_Events[nailedTabs][filter_sent]"', '1' ],
        [ 'cwi_event_Events[nailedTabs][lastSelected_sent]"', '1' ],
        [ 'cwi_event_Events[nailedTabs][lastSelected]"', '1' ],
        [ 'cwi_event_Events[nailedTabs][listActions_sent]"', '1' ],
        [ 'cwi_event_Events[orgId]', '0' ],
        [ 'cwi_event_Events[paymentReceiver]', '' ],
        [ 'cwi_event_Events[show][aggregations_sent]', '1' ],
        [ 'cwi_event_Events[show][aggregations]', '1' ],
        [ 'cwi_event_Events[show][attachedForms_sent]', '1' ],
        [ 'cwi_event_Events[show][classTypes_sent]', '1' ],
        [ 'cwi_event_Events[show][classTypes]', '1' ],
        [ 'cwi_event_Events[show][eventCode_sent]', '1' ],
        [ 'cwi_event_Events[show][eventFed_sent]', '1' ],
        [ 'cwi_event_Events[show][eventFed]', '1' ],
        [ 'cwi_event_Events[show][eventOrg_sent]', '1' ],
        [ 'cwi_event_Events[show][eventOrg]', '1' ],
        [ 'cwi_event_Events[show][gameOrganizers_sent]', '1' ],
        [ 'cwi_event_Events[show][hideEmptyColumns_sent]', '1' ],
        [ 'cwi_event_Events[show][hideEmptyColumns]', '1' ],
        [ 'cwi_event_Events[show][langCode_sent]', '1' ],
        [ 'cwi_event_Events[show][payCompFeesTo_sent]', '1' ],
        [ 'cwi_event_Events[show][profileImage_sent]', '1' ],
        [ 'cwi_event_Events[show][rowNumber_sent]', '1' ],
        [ 'cwi_event_Events[show][startFeeData_sent]', '1' ],
        [ 'cwi_event_Events[show][subHeadings_sent]', '1' ],
        [ 'cwi_event_Events[show][subHeadings]', '1' ],
        [ 'cwi_event_Events[subType]', '0' ],
        [ 'cwi_event_Events[textSearch]', '' ],
        [ 'filter[filterCode]', 'comp.GameEventSel' ],
        [ 'filter[selClassName]', 'cwc_comp_GameEventSel' ],
        [ 'filterId', '42106380' ],
        [ 'moveto', '' ],
        [ 'submitSearchButton', 'Apply and search' ],
    ])

    const page = await fetch("https://dans.se/catch/filter/", {
        "headers": {
            "content-type": "application/x-www-form-urlencoded",
        },
        "body": body.toString(),
        "method": "POST"
    });
    const sid = page.headers.get('Set-Cookie')?.replace(/sid=([A-Fa-f0-9]+);.*/gi, '$1')

    const res = await fetch("https://dans.se/comp/games/", {
        "headers": {
            "cookie": "sid=" + sid,
        }
    });

    const com = z.object({
        name: z.string(),
        start_date: z.string(),
        branch: z.string(),
        classes: z.string(),
        type: z.string(),
        city: z.string(),
        organizer: z.string(),
        federation: z.string(),
        last_regestration_date: z.string(),
        game_regs: z.string().optional(),
        open: z.boolean().optional(),
        cancelled: z.boolean().optional()
    })

    const doc = load(await res.text())
    const tbl = doc('table.dynamicTable')

    const rows = tbl.find('tr.cwEven, tr.cwOdd')

    const cols = [
        'name', 'start_date', 'branch', 'classes', 'type', 'city', 'organizer',
        'federation', 'last_regestration_date', 'game_regs'
    ]

    const calendar = ical({name: ('Tävlingar ' + (classTypes ?? '')).trim()});

    for (const row of rows) {
        const tr = load(row)
        const text = tr.text().trim().split(/\n */)
        const raw = Object.fromEntries(zip(cols, text))
        if (!raw.name) continue

        const result = com.safeParse(raw)

        if (!result.success) {
            console.warn(raw, result.error.flatten())
            continue
        }
        const { data } = result

        // Enrichment
        data.last_regestration_date = data.last_regestration_date?.replace(/Senast +/gi, '') ?? null
        data.open = data.type?.toLocaleLowerCase() === 'öppen' || data.type?.toLocaleLowerCase() === 'gp'
        data.cancelled = data.name.toLocaleLowerCase().includes('inställd!')
        data.name = data.name.replace(/ *Inställd! */g, '')

        if (!data.open) continue

        calendar.createEvent({
            start: new Date(data.start_date),
            end: new Date(data.start_date),
            summary: data.name,
            description: JSON.stringify(data, null, 2),
            location: data.city,
        });

        console.log([data.name, data.start_date, data.classes, data.city].join(' '))
    }

    await calendar.save('/tmp/comp.ics')
}

function sleep(ms: number = 20000) {
    return new Promise((res, rej) => setTimeout(res, ms))
}

function postprocess(content: string, calendar: { name: string }) {
    const new_fields = [
        'URL:https://nackswinget.se/Kalender',
        `NAME:${calendar.name}`,
    ]
    const text = content.replace(/(X-WR-CALNAME):.*/gi, `\$1:${calendar.name}\n${new_fields.join('\n')}`)
    const latest_date = max([...text.matchAll(/DTSTAMP:.*/gi)].map(s => s[0].replace('DTSTAMP:', ''))) ?? null
    const latest_uid = max([...text.matchAll(/UID:.*/gi)].map(s => s[0].replace('UID:', ''))) ?? null
    return { text, latest_date: latest_date ? parseISO(latest_date) : null, latest_uid }
}