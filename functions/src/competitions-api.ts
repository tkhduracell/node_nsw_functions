import { logger, loggerMiddleware } from './logging'
import { updateCompetitions } from './lib/competitions'
import z from 'zod'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { prettyJson } from './middleware'
import { tr } from 'date-fns/locale'

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
    const opts
        = z.object({
            system: z.enum(['BRR']).optional(),
            debug: z.boolean().optional()
        })
            .safeParse(req.query)

    if (!opts.success) {
        console.error('Invalid query parameters:', opts.error)
        return res.status(400).json({ error: 'Invalid query parameters' })
    }
    
    const { system, debug } = opts.data

    try {
        const { data, size, url } = await updateCompetitions(system, debug)
        logger.info('Competitions updated successfully', { system, size, url })
        return res.json({ data, size, url })
    } catch (error) {
        console.error('Error updating competitions:', error)
        return res.status(500).json({ error: 'Failed to update competitions' })
    }
})

export default app
