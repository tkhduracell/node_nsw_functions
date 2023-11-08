export type ListedActivities = { listedActivity: ListedActivity } []

export type ListedActivity = {
    activityId: number;
    calendarId: number;
    name: string;
    startTime: string;
    endTime: string;
    allDayActivity: boolean;
    venueName: string;
    activityTypeId: number;
    activityTypeName: string;
    activityTypeColor: string;
    isRecurring: boolean;
    recurrenceId: null | number;
    meetingTime: null | string;
    meetingPlace: null | string;
    description: string;
    shared: boolean;
    hasSummons: boolean;
    attendanceIsRegistered: boolean;
    attendanceIsLok: boolean;
    attendanceWillBeRegistered: boolean;
    activityIsInApplication: boolean;
    externalDataSourceId: null | number;
    externalDataSourceActivityId: null | number;
    localCopySource: number;
    notFromThisCalendar: boolean;
    modifiedProperties: {
      startTime: boolean;
      endTime: boolean;
      venueName: boolean;
    };
    contactInformation: {
      personName: null | string;
      website: null | string;
      phone: null | string;
      email: null | string;
      hasValue: boolean;
    };
    groupIds: null | number[];
    recurrence: {
      recurrenceId: null | number;
      start: string;
      end: null | string;
      count: null | number;
      actualCount: null | number;
      timeUnit: number;
      interval: number;
      weekdays: number[];
      day: null | number;
      month: null | number;
      week: null | number;
      description: string;
    };
    organisationName: string;
    sportsName: string;
    summonId: number;
    indexInRecurrence: null | number;
};