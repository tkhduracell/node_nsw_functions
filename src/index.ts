import 'source-map-support/register'

import { http } from '@google-cloud/functions-framework'
import { config } from 'dotenv'

import { initializeApp } from 'firebase-admin/app'

config()
initializeApp()

import calendars from './calendars-api'
http('calendars-api', calendars)

import calendarsUpdate from './calendars-update-api'
http('calendars-update-api', calendarsUpdate)

import notifications from './notifications-api'
http('notifications-api', notifications)

import competitions from './competitions-api'
http('competitions-api', competitions);
