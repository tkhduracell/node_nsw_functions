import { fetchCompetitions } from './lib/competitions'
import z from 'zod'
import express from 'express'

const app = express()

app.get('/', async (req, res) => {
    const classTypes = z.enum(['X', 'N', 'R', '']).default('').parse(req.query.classTypes)

    const cal = await fetchCompetitions(classTypes)

    res
        .header('Content-Type', 'text/calendar')
        .header('Content-Disposition', `attachment; filename="comp_${classTypes || 'all'}.ics"`)
        .send(cal.toString())
})

export default app