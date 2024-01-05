import { type Bucket } from '@google-cloud/storage'
import { type Browser } from 'puppeteer'
import { logger } from '../logging'

export async function dumpScreenshots(browser: Browser, bucket: Bucket, prefix: string) {
    let i = 0
    const date = new Date()
    date.setMilliseconds(0)

    for (const page of await browser.pages()) {
        const img = await page.screenshot({ fullPage: true, type: 'png' })
        const imageName = `errors/${prefix}/${date.toISOString()}-page-${i++}.png`
        const file = bucket.file(imageName)

        logger.info(`Writing error screenshot ${i} to ${file.cloudStorageURI.toString()}`)
        await file.save(img, { contentType: 'image/png' })

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 3600 * 1000
        })
        logger.info('Screenshot uploaded ' + url, { date, i, uri: file.cloudStorageURI.toString() })
    }
}
