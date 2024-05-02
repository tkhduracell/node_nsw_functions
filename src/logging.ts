import pino from 'pino'

import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'

import { type Request, type NextFunction, type Response } from 'express'

const asyncLocalStorage = new AsyncLocalStorage<{ requestId: string}>()

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['X-Cloud-Trace-Context'] ?? req.headers['x-cloud-trace-context'] ?? randomUUID()
    asyncLocalStorage.run({requestId: requestId as string}, () => next())
}

const transport = process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
        colorize: true
    },
} : undefined

export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport,
    base: null,
    timestamp: false,
    messageKey: 'message',
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
    },
    mixin () {
        const requestId = asyncLocalStorage.getStore()?.requestId ?? randomUUID()
        return {
            requestId,
            'logging.googleapis.com/spanId': requestId,
            'logging.googleapis.com/trace': `projects/${process.env.GCLOUD_PROJECT}/traces/${requestId}`,
            'logging.googleapis.com/trace_sampled': true
         }
    }
})