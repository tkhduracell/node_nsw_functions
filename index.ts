import { http } from '@google-cloud/functions-framework'
import { Storage } from '@google-cloud/storage'
import { launch, Page } from 'puppeteer'
import { writeFile as _writeFile } from 'fs'
import { promisify } from 'util'

import fetch from 'cross-fetch'
import z from 'zod'

import {config} from 'dotenv'

config()

const { 
    ACTIVITY_ORG_ID, ACTIVITY_BASE_URL, ACTIVITY_USERNAME, ACTIVITY_PASSWORD, 
    GCLOUD_PROJECT, GCLOUD_BUCKET, GCLOUD_REGION 
} = process.env as { 
    ACTIVITY_ORG_ID: string; ACTIVITY_BASE_URL: string; ACTIVITY_USERNAME: string; ACTIVITY_PASSWORD: string; 
    GCLOUD_PROJECT: string; GCLOUD_BUCKET: string; GCLOUD_REGION: string; 
}

const storage = new Storage({ projectId: GCLOUD_PROJECT });
const bucket = storage.bucket(GCLOUD_BUCKET)

const writeFile = promisify(_writeFile)

// Register an HTTP function with the Functions Framework that will be executed
// when you make an HTTP request to the deployed function's endpoint.
http('get', async (req, res) => {
    if (!req.query.id) {
        const [file] = await bucket.file('all.json').download()

        return res.header('content-type', 'application/json').send(file).end()
    }
    
    const id = z.string().regex(/\d+/).parse(req.query.id)

    res
        .setHeader('content-type', 'text/calendar')
        .status(200)

    bucket
        .file(`${id}.ics`)
        .createReadStream()
        .pipe(res, { end: true })
});

http('update', async (req, res) => {
    await calendar(true, true)

    res.sendStatus(200)
});



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
        
        const start = `${lastquater.toISOString().replace(/(.*)T.*/, '$1')}+00%3A00%3A00`
        const end = `${inayear.toISOString().replace(/(.*)T.*/, '$1')}+00%3A00%3A00`
        
        console.log(`Downloading - ${cal.name} (${cal.id})`)
        const response = await fetch(`${ACTIVITY_BASE_URL}/activities/exportactivitiestoical?calendarId=${cal.id}&startTime=${start}&endTime=${end}&freeText=&activityTypes=`, {
            method: 'GET',
            headers: { cookie }
        })
        const text = postprocess(await response.text(), cal)

        const file = `/tmp/${cal.id}.ics`

        console.log(`Saving - ${cal.name} (${cal.id})`)
        await writeFile(file, text)
        console.log(`Wrote - ${cal.name} (${cal.id}) to ${file}`)

        if(useCGS) {
            const destination = `${cal.id}.ics`
            const metadata = { 
                'x-goog-meta-calendar-name': cal.name, 
                'x-goog-meta-calendar-id': cal.id
            }
            console.log(`Uploading - ${cal.name} (${cal.id}) to ${bucket.cloudStorageURI}/${destination}`)
            await bucket.upload(file, { destination, metadata: { customMetadata: metadata } })
        }
    }

    await browser.close();

    if (useCGS) {
        const data = cals.map(cal => ({...cal, self: `webcal://${GCLOUD_REGION}-${GCLOUD_PROJECT}.cloudfunctions.net/nsw-calendar-export-get?id=${cal.id}` }))
        const payload = JSON.stringify(data, null, 2)
        const file = `/tmp/all.json`
        await writeFile(file, payload)
        await bucket.upload(file, { destination: 'all.json' })
    }
}

function sleep(ms: number = 20000) {
    return new Promise((res, rej) => setTimeout(res, ms))
}

function postprocess(text: string, calendar: { name: string }) {
    const new_fields = [
        'URL:https://nackswinget.se/Kalender',
        `NAME:${calendar.name}`,
    ]
    return text.replace(/(X-WR-CALNAME):.*/gi, `\$1:${calendar.name}\n${new_fields.join('\n')}`)
}