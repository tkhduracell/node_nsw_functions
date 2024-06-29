import { logger, loggerMiddleware } from './logging'
import { fetchCompetitions, getCompetitions } from './lib/competitions'
import z from 'zod'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { prettyJson } from './middleware'
import { GCloudOptions } from './env'

const app = express()
app.use(express.json())
app.use(prettyJson)
app.use(loggerMiddleware)

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => { logger.info('🚀 Listening on port %s', port) })
}

app.get('/', async (req, res) => {
    const opts = 
        z.object({
            classTypes:  z.enum(['X', 'N', 'R', '']).optional(),
            force: z.boolean().optional(),
            debug: z.boolean().optional()
        })
        .parse(req.query)

    const cal = await getCompetitions(opts.classTypes, opts.force, opts.debug)

    res
        .header('Content-Type', 'text/calendar')
        .header('Content-Disposition', `attachment; filename="dans.se_competitions_${opts.classTypes ?? 'all'}.ics"`)
        .send(cal.toString())
})

export default app
