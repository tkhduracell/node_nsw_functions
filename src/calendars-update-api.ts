import { Bucket, Storage } from '@google-cloud/storage'

import { GCloudOptions } from './env'
import { calendar } from './lib/calendars'
import { getFirestore } from 'firebase-admin/firestore'

import { Browser, TimeoutError, launch } from 'puppeteer'
import express from 'express'

const app = express()

app.post('/update', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET,
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT });
    const bucket = storage.bucket(GCLOUD_BUCKET)

    if (!(await bucket.exists())) {
        await bucket.create()
    }

    const db = getFirestore()
    const browser = await launch({ headless: 'new' });

    try {
        await calendar(browser, bucket, db, true)
    } catch (err) {
        console.error(err)
        await dumpScreenshots(browser, bucket)
        throw err
    }

    await browser.close()

    res.sendStatus(200)
});

app.post('/update-lean', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET,
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT });
    const bucket = storage.bucket(GCLOUD_BUCKET)

    const db = getFirestore()
    const browser = await launch({ headless: 'new' });
    await calendar(browser, bucket, db, true)
    await browser.close()

    res.sendStatus(200)
});

export default app

async function dumpScreenshots(browser: Browser, bucket: Bucket) {
    for (const page of await browser.pages()) {
        const img = await page.screenshot({ fullPage: true, type: 'png' })
        const imageName = '/errors/' + new Date().getTime() + '.png'
        const file = bucket.file(imageName)
        console.info('Writing error screenshot to', file.publicUrl())
        await file.save(img, { contentType: 'image/png' })
    }
}
