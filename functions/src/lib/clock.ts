export class ClockFactory {
    static native(): Clock {
        return { now: () => new Date() }
    }
}

export interface Clock {
    now(): Date
}
