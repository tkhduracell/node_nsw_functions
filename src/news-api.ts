import { logger, loggerMiddleware } from './logging'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { prettyJson } from './middleware'
import { cors } from './lib/cors'
import { parse } from 'rss-to-json'

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

app.get('/', async (req, res) => {
    try {
        const feed = await parse('https://nackswinget.se/feed');
        res.header('Cache-Control', 'public, max-age=300')
        res.json(feed)
    } catch (err: any) {
        logger.error(err);
        res.status(500)
        res.json({ error: err.message });
    }
})

export default app
