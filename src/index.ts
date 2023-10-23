import 'source-map-support/register'

import { http } from '@google-cloud/functions-framework'
import { Storage } from '@google-cloud/storage'
import { config } from 'dotenv'

import z from 'zod'

import { GCloudOptions } from './env'
import { calendar } from './calendar'
import { initializeApp } from 'firebase-admin/app'

config()
initializeApp()

http('get', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET,
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT });
    const bucket = storage.bucket(GCLOUD_BUCKET)

    if (!req.query.id) {
        const [file] = await bucket.file('index.json').download()

        return res.header('Content-Type', 'application/json').send(file).end()
    }

    const id = z.string().regex(/\d+/).parse(req.query.id)

    const [{ metadata }] = await bucket.file(`cal_${id}.ics`).getMetadata()

    res
        .setHeader('Content-Type', 'text/calendar')
        .setHeader('Content-Disposition', `attachment; filename="${metadata['CalendarName']}.ics"`)
        .status(200)

    bucket
        .file(`cal_${id}.ics`)
        .createReadStream()
        .pipe(res, { end: true })
});

http('update', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET,
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT });
    const bucket = storage.bucket(GCLOUD_BUCKET)

    const { dryrun } = z.object({
        dryrun: z.enum(['true', 'false']).optional()
    }).parse(req.query)

    await calendar(bucket, true)

    res.sendStatus(200)
});

http('update-lean', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET,
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT });
    const bucket = storage.bucket(GCLOUD_BUCKET)

    await calendar(bucket, true, true)

    res.sendStatus(200)
});

import napi from './notifications-api'

http('notifications-api', napi)

import comp from './competitions-api'

http('competitions', comp);
