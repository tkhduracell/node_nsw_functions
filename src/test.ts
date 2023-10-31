/*
*   npx ts-node -T src/test.ts
*/

import { Browser, launch } from 'puppeteer';
import { calendar, login } from './calendar'
import { config } from 'dotenv'
import { initializeApp } from 'firebase-admin/app'

config();

initializeApp({ projectId: 'nackswinget-af7ef' });

(async () => {

    const browser = await launch({ headless: false });

    await calendar(browser)
    await browser.close()

    process.exit(0)
})();
