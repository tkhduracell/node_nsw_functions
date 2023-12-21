import { logger, loggerMiddleware } from './logging'
import { Storage } from '@google-cloud/storage'

import { GCloudOptions, IDOActivityOptions } from './env'
import { update } from './lib/calendars'
import { getFirestore } from 'firebase-admin/firestore'

import { launch } from 'puppeteer'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { dumpScreenshots } from './lib/screenshots'
import { prettyJson } from './middleware'

const app = express()
app.use(loggerMiddleware)
app.use(express.json())
app.use(prettyJson)

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => logger.info(`Listening on port ${port}`))
}

export async function launchBrowser () {
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
        args: [...args, '--js-flags="--max-old-space-size=500"']
    })
}

app.post('/', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT })
    const bucket = storage.bucket(GCLOUD_BUCKET)

    if (!(await bucket.exists())) {
        await bucket.create()
    }

    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)
    const db = getFirestore()

    logger.info('Launching browser', { orgId })
    const browser = await launchBrowser()

    try {
        logger.info('Updating calendar', { orgId })
        await update(browser, bucket, db, orgId)
    } catch (err: any) {
        logger.error('Error in update()', { orgId }, err)

        await dumpScreenshots(browser, bucket, `org-${orgId}-update`)

        return res.status(500)
            .send({ message: `Unable to perform update: ${err?.message}` })
            .end()
    } finally {
        await browser.close()
    }

    res.status(200).end()
})

export default app
