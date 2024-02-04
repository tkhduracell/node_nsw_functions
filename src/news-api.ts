import { logger, loggerMiddleware } from './logging'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { prettyJson } from './middleware'
import { cors } from './lib/cors'
import { parse } from 'rss-to-json'
import z from 'zod'

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
        const feed = await parse('https://nackswinget.se/feed?' + query.toString());
        res.header('Cache-Control', 'no-store')
        res.json(feed)
    } catch (err: any) {
        logger.error(err);
        res.status(500)
        res.json({ error: err.message });
    }
})

export default app
