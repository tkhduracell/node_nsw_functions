import { fetchCompetitions } from './comp'

console.log()

fetchCompetitions()
    .then(() => console.log())
    .catch((err: any) => console.error('ERROR', err))
    .then(() => process.exit(0))