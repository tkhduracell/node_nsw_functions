import { competitions } from './comp'

console.log()

competitions()
    .then(() => console.log())
    .catch((err: any) => console.error('ERROR', err))
    .then(() => process.exit(0))