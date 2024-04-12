import winston from 'winston'
import { AsyncLocalStorage } from 'node:async_hooks'
import { type Request, type NextFunction, type Response } from 'express'

const asyncLocalStorage = new AsyncLocalStorage()

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['X-Cloud-Trace-Context'] ?? req.headers['x-cloud-trace-context'] ?? 'N/A'
    asyncLocalStorage.run(requestId, () => next())
}

export const logger = winston.createLogger({
    level: 'debug',
    transports: [new winston.transports.Console({ handleExceptions: true, handleRejections: true })],
    format: process.env.NODE_ENV === 'production'
        ? winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format(info => {
                const traceId = asyncLocalStorage.getStore() as string
                return traceId
                    ? {
                        ...info,
                        'logging.googleapis.com/spanId': traceId,
                        'logging.googleapis.com/trace': `projects/${process.env.GCLOUD_PROJECT}/traces/${traceId}`,
                        'logging.googleapis.com/trace_sampled': true
                    }
                    : info
            })(),
            winston.format.json()
        )
        : winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format(info => {
                const traceId = asyncLocalStorage.getStore() as string
                return traceId
                ? { ...info, traceId }
                : info
            })(),
            winston.format.json(),
            winston.format.timestamp(),
            winston.format.colorize({ message: true, level: true })
        )
})
