import { Storage } from '@google-cloud/storage'

import { GCloudOptions } from './env'
import { update } from './lib/calendars'
import { getFirestore } from 'firebase-admin/firestore'

import { launch } from 'puppeteer'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { dumpScreenshots } from './screenshots'

const app = express()

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => console.log(`Listening on port ${port}`))
}

export async function launchBrowser() {
    const args = [
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--no-first-run',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-notifications',
        '--disable-extensions',
        '--mute-audio',
        '--force-gpu-mem-available-mb=500'
    ]
    return await launch({
        headless: 'new',
        timeout: 180_000,
        protocolTimeout: 240_000,
        devtools: false,
        args: [...args, `--js-flags="--max-old-space-size=500"`]
    });
}

app.post('/', async (req, res) => {
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

    console.log('Launching browser')
    const browser = await launchBrowser()

    try {
        console.log('Updating calendar')
        await update(browser, bucket, db)
    } catch (err) {
        console.error(err)
        await dumpScreenshots(browser, bucket, 'update')
        throw new Error("Error in /update", { cause: err })
    } finally {
        await browser.close()
    }

    res.sendStatus(200)
});

export default app
