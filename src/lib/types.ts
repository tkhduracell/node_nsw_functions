import { type Timestamp } from 'firebase-admin/firestore'

export type ListedActivities = Array<{ listedActivity: ListedActivity }>

export interface ListedActivity {
    activityId: number
    calendarId: number
    name: string
    startTime: string
    endTime: string
    allDayActivity: boolean
    venueName: string
    activityTypeId: number
    activityTypeName: string
    activityTypeColor: string
    isRecurring: boolean
    recurrenceId: null | number
    meetingTime: null | string
    meetingPlace: null | string
    description: string
    shared: boolean
    hasSummons: boolean
    attendanceIsRegistered: boolean
    attendanceIsLok: boolean
    attendanceWillBeRegistered: boolean
    activityIsInApplication: boolean
    externalDataSourceId: null | number
    externalDataSourceActivityId: null | number
    localCopySource: number
    notFromThisCalendar: boolean
    modifiedProperties: {
        startTime: boolean
        endTime: boolean
        venueName: boolean
    }
    contactInformation: {
        personName: null | string
        website: null | string
        phone: null | string
        email: null | string
        hasValue: boolean
    }
    groupIds: null | number[]
    recurrence: {
        recurrenceId: null | number
        start: string
        end: null | string
        count: null | number
        actualCount: null | number
        timeUnit: number
        interval: number
        weekdays: number[]
        day: null | number
        month: null | number
        week: null | number
        description: string
    }
    organisationName: string
    sportsName: string
    summonId: number
    indexInRecurrence: null | number
}

export interface ActivityCreateResponse {
    success: boolean
    type: string
    activities: Array<{
        activityId: number
        allDayActivity: boolean
        parentActivity: null | number
        organisationId: number
        calendarId: number
        sportId: number
        localCopySource: number
        externalDataSourceId: null | number
        externalDataSourceActivityId: null | number
        externalDataSourceUnlocked: null | boolean
        attendance: {
            registeredByPersonId: null | number
            registrationTime: null | string
            registrationSystem: null | string
            willBeRegistered: boolean
            registrationResultLok: number
            registrationResult: number
        }
        recurrenceId: null | number
        recurrence: null // If more structure is known, it can be detailed here
        indexInRecurrence: null | number
        entry: {
            deadline: null | string
            target: null | string
            maxNumberOfParticipants: null | number
        }
        venue: {
            venueId: null | number
            venueName: string
        }
        shared: boolean
        startTime: string
        endTime: string
        name: string
        meetingPlace: null | string
        meetingTimeOffset: null | string
        description: string
        contactInformation: {
            personName: null | string
            website: null | string
            phone: null | string
            email: null | string
            hasValue: boolean
        }
        sharingRules: any[] // Replace `any` with more specific type if structure is known
        participants: any[] // Replace `any` with more specific type if structure is known
        externalDataSourcePropertyValues: any[] // Replace `any` with more specific type if structure is known
        groups: any[] // Replace `any` with more specific type if structure is known
        summons: any[] // Replace `any` with more specific type if structure is known
        hasSummons: boolean
        activityTypeId: number
        activityType: {
            activityTypeId: number
            name: string
            pluralName: string
            color: string
            order: number
            parentActivityTypeId: null | number
            parentActivityType: null // If more structure is known, it can be detailed here
            subActivityTypes: any[] // Replace `any` with more specific type if structure is known
        }
        modificationsFromParent: {
            startTime: boolean
            endTime: boolean
            venueName: boolean
        }
        batchGuid: null | string
        batchNo: null | number
        mobileAppActivityId: null | number
        recurrenceDescription: string
        changeTracking: {
            createdBy: number
            createdTime: string
            modifiedBy: number
            modifiedTime: string
        }
    }>
}

export type Calendars = Array<{ id: string, name: string, orgId: string }>

export type CalendarMetadataData = Omit<CalendarMetadata, 'updated_at'> & { updated_at: Timestamp }

export interface CalendarNotification {
    at: string
    start: string
    body: string
    id: string
    title: string
    creator: string
    contact: string
}

export interface CalendarMetadata {
    calendar_id: string
    calendar_last_date: string
    calendar_last_uid: string
    calendar_name: string
    calendar_org_id: string
    last_notifications: CalendarNotification[]
    updated_at: Date
}
