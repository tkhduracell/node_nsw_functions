import { logger, loggerMiddleware } from './logging'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { errorHandling, prettyJson } from './middleware'
import { cors } from './lib/cors'
import { parse } from 'rss-to-json'
import z from 'zod'
import { DocumentReference, DocumentData, FieldValue, getFirestore } from 'firebase-admin/firestore'
import { maxBy } from 'lodash'
import { Message, getMessaging } from 'firebase-admin/messaging'
import { decodeXMLStrict } from "entities"
import { getStorage } from 'firebase-admin/storage'
import { GCloudOptions } from './env'
import { ALLOWED_ORIGINS } from './lib/cors'

const app = express()
app.use(express.json())
app.use(prettyJson)
app.use(loggerMiddleware)
app.use(errorHandling)

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => { logger.info(`Listening on port ${port}`) })
    initializeBucketCors()
}

export interface News {
    title: string;
    description: string;
    link: string;
    image: string;
    category: string[];
    items: {
      id: string;
      title: string;
      description: string;
      link: string;
      author: string;
      published: number;
      created: number;
      category: string | string[];
      content: undefined;
      enclosures: {
        url: string;
        medium: string;
      }[];
      media: {
        thumbnail: {
          url: string;
          medium: string;
        };
      };
    }[];
}

export type NewsItem = News['items'][number]

app.get('/', async (req, res) => {

    const params = await z.object({ exclude: z.enum(['competitions']).optional() }).safeParseAsync(req.query)

    if (!params.success) {
        logger.error('Invalid query parameters', params.error)
        res.status(400)
        res.json({ error: 'Invalid query parameters' })
        return
    }

    const query = new URLSearchParams()

    if (params.data.exclude === 'competitions') {
        query.append('cat', '-5') // Magic id for 'Tävlingar' kategory
    }

    try {
        const feed: News = await parse('https://nackswinget.se/feed?' + query.toString());
        res.header('Cache-Control', 'no-store')
        res.json(feed)
    } catch (err: any) {
        logger.error(err);
        res.status(500)
        res.json({ error: err.message });
    }
}, cors)

type NewsState = { last_news_item: { published: number } }

app.post('/update', async (req, res) => {
    const { force } = req.query
    const db = getFirestore()
    const docRef = db.collection('news').doc('nackswinget.se')
    const doc = await docRef.get()

    if (!doc.exists) return res.status(404).json({ error: 'Document not found' })

    const feed: News = await parse('https://nackswinget.se/feed?cat=-5');
    await uploadToStorage(feed)

    const data = doc.data() as NewsState
    try {
        await notify(docRef, data, feed, !!force)
        return res.json({ message: 'New items' })
    } catch (err: any) {
        logger.error('Unable to notify', err)
        return res.status(500).json({ error: err.message ?? 'Internal Server Error' })
    }
})

async function notify(docRef: DocumentReference, data: NewsState, feed: News, force = false) {
    const newest = maxBy(feed.items, i => i.published)
    if (newest) {
        delete newest.content
    }

    if (newest && (!data.last_news_item || newest.published > data.last_news_item?.published || force)) {
        logger.info('New news item', { newest, last: data.last_news_item })

        await docRef.update({ last_news_item: newest, updated_at: FieldValue.serverTimestamp(), })
        const imageUrl = newest.media.thumbnail.url
        const message: Message = {
            notification: {
                title: 'Nyhet ifrån Nackswinget',
                body: decodeXMLStrict(newest.title),
                imageUrl,
            },
            android: {
                notification: {
                    imageUrl,
                }
            },
            apns: {
                fcmOptions: {
                    imageUrl,
                }
            },
            webpush: {
                notification: {
                    icon: 'https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg',
                    image: imageUrl,
                }
            },
            topic: 'news-nackswinget.se',
            data: {
                nsw_topic: 'news-nackswinget.se',
                nsw_subject_id: newest.id
            }
        }
        logger.info('Sent notification', { message })

        await getMessaging().send(message)

        await docRef.update({ last_message: message })
    }
}

async function uploadToStorage(feed: News) {
    const {
        GCLOUD_BUCKET
    } = GCloudOptions.parse(process.env)
    const storage = getStorage()
    const bucket = storage.bucket(GCLOUD_BUCKET)

    const destination = `news.json`
    const file = bucket.file(destination)

    logger.info(`Uploading news dump to ${file.cloudStorageURI.toString()}`)
    await file.save(JSON.stringify(feed), { metadata: {
        metadata: {},
        cacheControl: 'public, max-age=30',
        contentDisposition: `attachment; filename="news.json"`,
        contentLanguage: 'sv-SE',
        contentType: 'application/json; charset=utf-8',
    } })

    logger.info(`Ensuring public access of ${file.cloudStorageURI.toString()} as ${file.publicUrl()}`)
    await file.makePublic()
}

export default app

function initializeBucketCors() {
    logger.info('Initializing bucket CORS')
    const { GCLOUD_BUCKET } = GCloudOptions.parse(process.env)
    return getStorage()
        .bucket(GCLOUD_BUCKET)
        .setCorsConfiguration([
            {
                origin: ALLOWED_ORIGINS,
                method: ['GET'],
                responseHeader: ['Content-Type'],
                maxAgeSeconds: 30,
            }
        ])
}
