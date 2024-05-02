import { logger, loggerMiddleware } from './logging'
import { fetchCompetitions } from './lib/competitions'
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

app.get('/', async (req, res) => {
    const classTypes = z.enum(['X', 'N', 'R', '']).default('').parse(req.query.classTypes)

    const cal = await fetchCompetitions(classTypes)

    res
        .header('Content-Type', 'text/calendar')
        .header('Content-Disposition', `attachment; filename="comp_${classTypes ?? 'all'}.ics"`)
        .send(cal.toString())
})

export default app
