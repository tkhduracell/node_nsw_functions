import { calendar } from './index'

calendar(true, true)
    .then(() => console.log('DONE'))
    .catch((err: any) => console.error('ERROR', err))
    .then(() => process.exit(0))