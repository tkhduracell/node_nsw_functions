import { logger, loggerMiddleware } from './logging'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { prettyJson } from './middleware'
import { cors } from './lib/cors'
import { parse } from 'rss-to-json'
import z from 'zod'
import { getFirestore } from 'firebase-admin/firestore'
import { maxBy } from 'lodash'
import { Message, getMessaging } from 'firebase-admin/messaging'

const app = express()
app.use(express.json())
app.use(prettyJson)
app.use(loggerMiddleware)
app.use(cors)

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => { logger.info(`Listening on port ${port}`) })
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
})

app.get('/update', async (req, res) => {
    const db = getFirestore()

    const docRef = db.collection('news').doc('nackswinget.se')
    const doc = await docRef.get()

    if (!doc.exists) return

    const feed: News = await parse('https://nackswinget.se/feed?cat=-5');
    const newest = maxBy(feed.items, i => i.published)

    const data = doc.data() as { last: { published: number } }

    if (newest && newest.published > data.last.published) {
        logger.info('New news item', { newest, last: data.last })
        await docRef.update({ last: newest })

        const message: Message = {
            notification: {
                title: newest.title,
                imageUrl: newest.media.thumbnail.url,
            },
            webpush: {
                notification: {
                    title: newest.title,
                    icon: 'https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg',
                    image: newest.media.thumbnail.url,
                }
            },
            topic: 'news-nackswinget.se',
        }
        logger.info('Sent notification', { message })

        await getMessaging().send(message)

        await docRef.update({ message })
    }
})

export default app
