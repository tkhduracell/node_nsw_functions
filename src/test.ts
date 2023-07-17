import { competitions } from './index'

console.log()

competitions()
    .then(() => console.log())
    .catch((err: any) => console.error('ERROR', err))
    .then(() => process.exit(0))