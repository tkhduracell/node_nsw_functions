import { Bucket, Storage } from '@google-cloud/storage'

import { GCloudOptions } from './env'
import { calendar } from './lib/calendars'
import { getFirestore } from 'firebase-admin/firestore'

import { Browser, launch } from 'puppeteer'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'

const app = express()

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => console.log(`Listening on port ${port}`))
}

export async function launchBrowser() {
    const args = [
        '--no-sandbox',
        '--no-zygote',
        '--single-process',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--no-first-run',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-notifications',
        '--disable-extensions',
        '--mute-audio',
        '--force-gpu-mem-available-mb=1024'
    ]
    return await launch({
        headless: 'new',
        timeout: 180_000,
        protocolTimeout: 240_000,
        devtools: false,
        args: [...args, `--js-flags="--max-old-space-size=500"`]
    });
}

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

    console.log('Launching browser')
    const browser = await launchBrowser()

    console.log('Closing pages')
    // await tryClosePages(browser)

    try {
        console.log('Updating calendar')
        await calendar(browser, bucket, db, false)
    } catch (err) {
        console.error(err)
        await dumpScreenshots(browser, bucket, 'update')
        throw new Error("Error in /update", { cause: err })
    } finally {
        await browser.close()
    }

    res.sendStatus(200)
});

app.post('/update-lean', async (req, res) => {
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
    const browser = await launchBrowser()

    // await tryClosePages(browser)

    try {
        await calendar(browser, bucket, db, true)
    } catch (err) {
        console.error(err)
        await dumpScreenshots(browser, bucket, 'update-lean')
        throw new Error("Error in /update-lean", { cause: err })
    } finally {
        await browser.close()
    }

    res.sendStatus(200)
});

export default app

async function dumpScreenshots(browser: Browser, bucket: Bucket, prefix: string) {
    let i = 0
    const date = new Date()
    date.setMilliseconds(0)

    for (const page of await browser.pages()) {
        const img = await page.screenshot({ fullPage: true, type: 'png'  })
        const imageName = `errors/${prefix}/${date.toISOString()}-page-${i++}.png`
        const file = bucket.file(imageName)
        console.info('Writing error screenshot to', file.publicUrl())
        await file.save(img, { contentType: 'image/png' })
    }
}

async function tryClosePages(browser: Browser): Promise<void> {
    try {
        while ((await browser.pages()).length > 0) {
            (await browser.pages())[0].close()
        }
    } catch (error) {
        console.warn('Failed to close pages')
    }
}
