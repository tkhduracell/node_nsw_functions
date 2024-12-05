import { logger } from './logging'
import type { NextFunction, Request, Response } from 'express'

export const prettyJson = (req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.headers['user-agent']

    if (!req.xhr && userAgent && (userAgent.includes('Chrome') || userAgent.includes('Mozilla'))) {
        res.set('Content-Type', 'application/json; charset=utf-8')
        res.json = (body: any) => {
            const json = JSON.stringify(body, null, 2)
            return res.send(json)
        }
    }
    next()
}

export const errorHandling = (err: Error, req: Request, res: Response) => {
    logger.error(err, 'Uncaught error, sending "internal error" as response')
    if (res) {
        res.status((err as any).status ?? 500).json({
            error: err.message,
            success: false,
        })
    }
    else {
        throw err
    }
}
