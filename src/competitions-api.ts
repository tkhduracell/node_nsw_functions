import { fetchCompetitions } from './comp'
import z from 'zod'
import express from 'express'

const app = express()

app.get('/', async (req, res) => {
    const classTypes = z.enum(['X', 'N', 'R', '']).default('').parse(req.query.classTypes)

    const cal = await fetchCompetitions(classTypes)

    await cal.save('/tmp/comp.ics')

    res.sendFile('/tmp/comp.ics', {
        headers: {
            'Content-Type': 'text/calendar',
            'Content-Disposition': `attachment; filename="comp_${classTypes || 'all'}.ics"`
        }
    })
})

export default app