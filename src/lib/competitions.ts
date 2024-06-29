import { zip } from 'lodash'

import fetch from 'cross-fetch'
import z from 'zod'

import { load } from 'cheerio'
import ical, { ICalCalendar} from 'ical-generator'
import { logger } from '../logging'
import { Storage } from '@google-cloud/storage'
import { GCloudOptions } from '../env'
import { addDays, addHours } from 'date-fns'


const com = z.object({
    name: z.string(),
    start_date: z.string(),
    branch: z.string(),
    classes: z.string(),
    type: z.string(),
    city: z.string(),
    organizer: z.string(),
    federation: z.string(),
    last_regestration_date: z.string(),
    game_regs: z.string().optional(),
    open: z.boolean().optional(),
    cancelled: z.boolean().optional()
})

type Competition = z.infer<typeof com>

export async function updateCompetitions(classTypes?: 'R' | 'N' | 'X' | '', debug = false) {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT })
    const bucket = storage.bucket(GCLOUD_BUCKET)
    
    const fileName = `dans.se_competitions_${classTypes ?? 'all'}.ics`
    const file = bucket.file(fileName)
    
    console.log('Fetching competitions from dans.se')
    const cal = await fetchCompetitions(classTypes, debug)

    logger.info(cal, `Uploading to %s`, file.cloudStorageURI.toString())
    await file.save(cal.toString(), {
        metadata: {
            cacheControl: 'public, max-age=30',
            contentDisposition: `attachment; filename="${fileName}.ics"`,
            contentLanguage: 'sv-SE',
            contentType: 'text/calendar; charset=utf-8',
        }
    })

    logger.info(cal, `Ensuring public access of ${file.cloudStorageURI.toString()} as ${file.publicUrl()}`)
    await file.makePublic()
    
    return cal.toString()
}

export async function fetchCompetitions(classTypes?: 'R' | 'N' | 'X' | '', debug = false): Promise<ICalCalendar> {
    const body = new URLSearchParams([
        ['cwi_db_FilterTemplate[filterName]', ''],
        ['cwi_db_FilterTemplate[id]', '0'],
        ['cwi_db_FilterTemplate[isDefault_sent]', '1'],
        ['cwi_event_Events[branch]', 'mainBranchId_1001'],
        ['cwi_event_Events[classTypes]', classTypes ?? ''],
        ['cwi_event_Events[dateInterval][interval]', 'future'],
        ['cwi_event_Events[dateInterval][maxDate]', ''],
        ['cwi_event_Events[dateInterval][minDate]', '2023-01-01'],
        ['cwi_event_Events[fedId]', '0'],
        ['cwi_event_Events[firstRow]', '1'],
        ['cwi_event_Events[isCanceled]', ''],
        ['cwi_event_Events[lastSelectedArea]', 'filter'],
        ['cwi_event_Events[maxRows]', '50'],
        ['cwi_event_Events[maxRowsEnum]', '50'],
        ['cwi_event_Events[nailedTabs][compact_sent]"', '1'],
        ['cwi_event_Events[nailedTabs][compact]"', '1'],
        ['cwi_event_Events[nailedTabs][filter_sent]"', '1'],
        ['cwi_event_Events[nailedTabs][lastSelected_sent]"', '1'],
        ['cwi_event_Events[nailedTabs][lastSelected]"', '1'],
        ['cwi_event_Events[nailedTabs][listActions_sent]"', '1'],
        ['cwi_event_Events[orgId]', '0'],
        ['cwi_event_Events[paymentReceiver]', ''],
        ['cwi_event_Events[show][aggregations_sent]', '1'],
        ['cwi_event_Events[show][aggregations]', '1'],
        ['cwi_event_Events[show][attachedForms_sent]', '1'],
        ['cwi_event_Events[show][classTypes_sent]', '1'],
        ['cwi_event_Events[show][classTypes]', '1'],
        ['cwi_event_Events[show][eventCode_sent]', '1'],
        ['cwi_event_Events[show][eventFed_sent]', '1'],
        ['cwi_event_Events[show][eventFed]', '1'],
        ['cwi_event_Events[show][eventOrg_sent]', '1'],
        ['cwi_event_Events[show][eventOrg]', '1'],
        ['cwi_event_Events[show][gameOrganizers_sent]', '1'],
        ['cwi_event_Events[show][hideEmptyColumns_sent]', '1'],
        ['cwi_event_Events[show][hideEmptyColumns]', '1'],
        ['cwi_event_Events[show][langCode_sent]', '1'],
        ['cwi_event_Events[show][payCompFeesTo_sent]', '1'],
        ['cwi_event_Events[show][profileImage_sent]', '1'],
        ['cwi_event_Events[show][rowNumber_sent]', '1'],
        ['cwi_event_Events[show][startFeeData_sent]', '1'],
        ['cwi_event_Events[show][subHeadings_sent]', '1'],
        ['cwi_event_Events[show][subHeadings]', '1'],
        ['cwi_event_Events[subType]', '0'],
        ['cwi_event_Events[textSearch]', ''],
        ['filter[filterCode]', 'comp.GameEventSel'],
        ['filter[selClassName]', 'cwc_comp_GameEventSel'],
        ['filterId', '42106380'],
        ['moveto', ''],
        ['submitSearchButton', 'Apply and search']
    ])

    const page = await fetch('https://dans.se/catch/filter/', {
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body,
        method: 'POST'
    })
    const sid = page.headers.get('Set-Cookie')?.replace(/sid=([A-Fa-f0-9]+);.*/gi, '$1')

    const res = await fetch('https://dans.se/comp/games/', {
        headers: {
            cookie: 'sid=' + sid
        }
    })

    const doc = load(await res.text())
    const tbl = doc('table.dynamicTable')

    const rows = tbl.find('tr.cwEven, tr.cwOdd')

    const cols = [
        'name', 'start_date', 'branch', 'classes', 'type', 'city', 'organizer',
        'federation', 'last_regestration_date', 'game_regs'
    ]

    const calendar = ical({ name: ('Tävlingar ' + (classTypes ?? '')).trim() })

    for (const row of rows) {
        const tr = load(row)
        const text = tr.text().trim().split(/\n */)
        const raw = Object.fromEntries(zip(cols, text))
        if (!raw.name) continue

        const result = com.safeParse(raw)

        if (!result.success) {
            logger.warn(raw, result.error.flatten())
            continue
        }
        const { data } = result

        // Enrichment
        data.last_regestration_date = data.last_regestration_date?.replace(/(Senast|Stängd) +/gi, '') ?? null
        data.open = data.type?.toLocaleLowerCase() === 'öppen' || data.type?.toLocaleLowerCase() === 'gp'
        data.cancelled = data.name.toLocaleLowerCase().includes('inställd!')
        data.name = data.name.replace(/ *Inställd! */g, '')

        if (!data.open) continue

        const event = {
            start: new Date(data.start_date),
            end: new Date(data.start_date),
            allDay: true,
            timezone: 'CEST',
            summary: data.name,
            description: debug ? JSON.stringify(data, null, 2) : prettyDescription(data),
            location: data.city
        }

        try {
            calendar.createEvent(event)
        } catch (err) {
            logger.error(err, 'Invalid event: %o', event)
        }
    }
    return calendar
}

function prettyDescription(event: Competition): string  {
    const details = {
        "Organisatör": event.organizer,
        "Stad": event.city,
        "Klasser": event.classes,
        "Sista anmälningsdag": event.last_regestration_date
    }
    return Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('\n')
}

