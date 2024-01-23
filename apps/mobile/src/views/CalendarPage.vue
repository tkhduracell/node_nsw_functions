<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Nackswinget - Kalender</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Tab 1</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content class="ion-padding">
        <ion-card v-if="data.isSubscribed">
          <ion-card-header>
            <ion-card-title>Bevaka</ion-card-title>
            <ion-card-subtitle>Du bevakar friträningar på denna enhet</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-button @click="unsubscribe">Avsluta bevakning</ion-button>
          </ion-card-content>
        </ion-card>
        <ion-card v-else-if="data.isSupported">
          <ion-card-header>
            <ion-card-title>Bevaka</ion-card-title>
            <ion-card-subtitle>Du kan bevaka friträning och få notiser när någon bokar ny träning</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-button @click="subscribe">Bevaka friträningar</ion-button>
          </ion-card-content>
        </ion-card>
        <ion-card v-for="day in data.agenda" :key="day.date">
          <ion-card-header>
            <ion-card-title>{{ day.name }}</ion-card-title>
            <ion-card-subtitle>{{ day.date }}</ion-card-subtitle>
          </ion-card-header>

          <ion-card-content>
            <ion-list lines="full">
              <ion-item v-if="day.events.length === 0">
                <ion-label>Inga träningar denna dag</ion-label>
              </ion-item>
              <ion-item v-for="event in day.events" :key="day.date + event.name + event.startTime"
                :data-calendar="event.calendarId">
                <ion-label>{{ event.startTime }} - {{ event.name }} ({{ event.duration }} minuter)</ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

      </ion-content>
    </ion-content>
  </ion-page>
</template>
<style scoped>
ion-button {
  --background: rgba(249, 6, 75, 1);
}

ion-item[data-calendar] {
  --border-radius: 6px;
  margin-bottom: 4px;
}

/* Huvud */
ion-item[data-calendar="333077"] {
  --background: rgba(128, 0, 128, 1);
}

/* Kurs */
ion-item[data-calendar="333892"] {
  --background: rgba(247, 186, 121, 1);
}

/* Friträning */
ion-item[data-calendar="337667"] {
  --background: rgba(0, 128, 0, 1);
}

/* Tävling */
ion-item[data-calendar="358978"] {
  --background: rgba(41, 128, 185, 1);
}

/* Eventkalender */
ion-item[data-calendar="358979"] {
  --background: rgba(252, 113, 132, 1);
}
</style>
<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/vue';
import { onMounted, reactive } from 'vue';
import { addDays, format, parseISO } from 'date-fns'
import { sv } from 'date-fns/locale'
import { FCM } from "@capacitor-community/fcm"
import { PushNotifications } from "@capacitor/push-notifications"

const _agenda: {
  name: string, date: string, events: { name: string, startTime: string, endTime: string, duration: number, calendarId: string }[]
}[] = []

const data = reactive({
  agenda: _agenda,
  isSubscribed: null as boolean | null,
  isSupported: true
})
const titleCase = (str: string): string =>
  str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

onMounted(async () => {
  const dates = createDatesArray(7)
    .map(date => fetch('/api/calendars-api/book/search?date=' + date)
      .then(res => res.json())
      .then(json => ({ json, date })))

  isSubscribed()
    .then(subscribed => data.isSubscribed = subscribed)
    .catch(() => {
      data.isSupported = false
      console.error('Notification not supported on web')
    })

  const results = await Promise.all(dates)

  data.agenda = results.map(res => ({
    name: titleCase(format(parseISO(res.date), 'EEEE', { locale: sv })),
    date: format(parseISO(res.date), 'dd MMMM, yyyy', { locale: sv }),
    events: res.json.map((event: any) => ({
      name: event.name,
      startTime: format(parseISO(event.startTime), 'HH:mm'),
      endTime: format(parseISO(event.endTime), 'HH:mm'),
      duration: event.duration,
      calendarId: event.calendarId
    }))
  }))

})

const createDatesArray = (days: number): string[] => {
  const base = addDays(new Date(), 0)
  return Array.from({ length: days }, (_, index) =>
    format(addDays(base, index), 'yyyy-MM-dd')
  );
};


const baseUrl = 'api/notifications-api'

async function doSubscribe(token: string) {
  const query = new URLSearchParams()
  query.append('token', token)
  query.append('topic', 'calendar-337667')

  const resp = await fetch(baseUrl + '/subscribe?' + query.toString(), { method: 'POST' })
  if (resp.ok) {
    console.log('subscribed!')
  } else {
    console.log('failed to subscribe', resp)
  }
}

async function doUnsubscribe(token: string) {
  const query = new URLSearchParams()
  query.append('token', token)
  query.append('topic', 'calendar-337667')

  const resp = await fetch(baseUrl + '/unsubscribe?' + query.toString(), { method: 'POST' })
  if (resp.ok) {
    console.log('unsubscribed!')
  } else {
    console.log('failed to subscribe', resp)
  }
}

async function isSubscribed() {
  const { token } = await FCM.getToken()
  const query = new URLSearchParams()
  query.append('token', token)

  const resp = await fetch(baseUrl + '/status?' + query.toString())
  if (resp.ok) {
    const json = await resp.json()
    return json.subscribed
  } else {
    console.log('failed to check subscription', resp)
    return false
  }
}

async function unsubscribe() {
  const { token } = await FCM.getToken()

  doUnsubscribe(token)
}


async function subscribe() {
  try {
    await PushNotifications.requestPermissions();
    await PushNotifications.register();
    const { token } = await FCM.getToken()
    doSubscribe(token)
  } catch (err: any) {
    data.isSupported = false
    console.error('Notification not supported', err)
  }

}

</script>
