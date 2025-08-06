import { type Bucket } from '@google-cloud/storage'
import { type Browser } from 'puppeteer'
import { logger } from '../logging'
import { formatInTimeZone } from 'date-fns-tz'

export async function dumpScreenshots(browser: Browser, bucket: Bucket, prefix: string) {
    let i = 0
    const date = new Date()
    date.setMilliseconds(0)

    for (const page of (await browser.pages()).filter(p => p.url() !== 'about:blank')) {
        const img = await page.screenshot({ fullPage: true, type: 'png' })
        const date = formatInTimeZone(Date.now(), 'Europe/Stockholm', 'yyyy-MM-dd')
        const time = formatInTimeZone(Date.now(), 'Europe/Stockholm', 'HH:mm:ss')
        const imageName = `errors/${prefix}/${date}/Screen-${time}-page-${i++}.png`
        const file = bucket.file(imageName)

        const uri = file.cloudStorageURI.toString()
        logger.info(`Writing error screenshot ${i} to ${uri}`)
        await file.save(img, { contentType: 'image/png' })

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 3600 * 1000
        })
        logger.info(`Screenshot uploaded for page ${i - 1}`, { i, uri, url })
    }
}
