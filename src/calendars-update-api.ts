import { Storage } from '@google-cloud/storage'

import { GCloudOptions } from './env'
import { calendar } from './lib/calendars'
import { getFirestore } from 'firebase-admin/firestore'

import { launch } from 'puppeteer'
import express from 'express'

const app = express()

app.post('/update', async (req, res) => {
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