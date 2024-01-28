import setupCors, { CorsOptions } from 'cors';

const options: CorsOptions = {
    origin: [
        'capacitor://localhost',
        'ionic://localhost',
        'http://localhost',
        'https://localhost',
        'https://nackswinget.se'
    ]
}

export const cors = setupCors(options)
