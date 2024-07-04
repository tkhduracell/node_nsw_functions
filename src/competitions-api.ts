import { logger, loggerMiddleware } from './logging'
import { updateCompetitions } from './lib/competitions'
import z from 'zod'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { prettyJson } from './middleware'

const app = express()
app.use(express.json())
app.use(prettyJson)
app.use(loggerMiddleware)

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => { logger.info('🚀 Listening on port %s', port) })
}

app.post('/update', async (req, res) => {
    const opts = 
        z.object({
            classTypes:  z.enum(['X', 'N', 'R', '']).optional(),
            debug: z.boolean().optional()
        })
        .parse(req.query)

    const { data, size, url } = await updateCompetitions(opts.classTypes, opts.debug)
    console.log('Updated cometitions', { url, size })

    res.json({ data, size, url })
})

export default app
