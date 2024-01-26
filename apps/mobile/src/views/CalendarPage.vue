<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-img slot="start" src="./nsw-logo.png" style="margin-start: 1em; height: 32px;"></ion-img>
        <ion-title>Kalender</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Tab 1</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content class="ion-padding">
        <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
          <ion-refresher-content></ion-refresher-content>
        </ion-refresher>
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
        <ion-card v-if="data.isLoading">
          <ion-grid>
            <ion-row class="ion-justify-content-center">
              <ion-col size="auto">
                <ion-spinner name="dots" color="danger"></ion-spinner>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card>
        <ion-card v-for="day in data.agenda" :key="day.date">
          <ion-card-header>
            <ion-card-title>{{ day.name }}</ion-card-title>
            <ion-card-subtitle>{{ day.date }}</ion-card-subtitle>
          </ion-card-header>

          <ion-card-content>
            <ion-list lines="full">
              <ion-item v-if="day.events.length === 0">
                <ion-label>
                  <h2>Inga träningar denna dag</h2>
                </ion-label>
              </ion-item>
              <ion-item v-for="event in day.events" :key="day.date + event.name + event.startTime"
                :data-calendar="event.calendarId">
                <ion-grid>
                  <ion-row :key="event.id">
                    <ion-col size="auto">
                      <ion-label style="display: flex; flex-direction: column;">
                        <div>{{ event.startTime }}</div>
                        <ion-icon style="margin-left: auto; margin-right: auto;" :icon="caretDownOutline"></ion-icon>
                        <div>{{ event.endTime }}</div>
                      </ion-label>
                    </ion-col>
                    <ion-col class="ion-align-self-center">
                      <ion-label>
                        <h2>
                          {{ event.name }} ({{ event.duration }} minuter)
                        </h2>
                        <h3 v-if="event.description" v-html="event.description"></h3>
                      </ion-label>
                    </ion-col>
                  </ion-row>
                </ion-grid>
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

ion-item[data-calendar] p.div {
  margin: 0;
  line-height: 0.6em;
  font-size: 0.6em;
}

ion-item[data-calendar] p {
  color: var(--ion-text-color);
}

/* Huvud */
ion-item[data-calendar="333077"] {
  --background: rgba(128, 0, 128, 0.9);
  --color: var(--ion-text-color)
}

/* Kurs */
ion-item[data-calendar="333892"] {
  --background: rgba(247, 186, 121, 0.9);
  --color: var(--ion-text-color)
}

/* Friträning */
ion-item[data-calendar="337667"] {
  --background: rgba(0, 128, 0, 0.9);
  --color: var(--ion-text-color)
}

/* Tävling */
ion-item[data-calendar="358978"] {
  --background: rgba(41, 128, 185, 0.9);
  --color: var(--ion-text-color)
}

/* Eventkalender */
ion-item[data-calendar="358979"] {
  --background: rgba(252, 113, 132, 0.9);
  --color: var(--ion-text-color)
}

ion-spinner {
  width: 100px;
  height: 100px;
}
</style>
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonRow, IonList, IonItem, IonLabel, IonCard, IonCardContent, IonCardHeader,
  IonCardSubtitle, IonCardTitle, IonCol, IonGrid, IonIcon, IonImg, IonSpinner,
  IonRefresher, IonRefresherContent
} from '@ionic/vue';
import { caretDownOutline } from 'ionicons/icons'
import { onMounted, reactive } from 'vue';
import { addDays, format, parseISO } from 'date-fns'
import { sv } from 'date-fns/locale'
import { FCM } from "@capacitor-community/fcm"
import { PushNotifications } from "@capacitor/push-notifications"

type AgendaEvent = {
  name: string, startTime: string, endTime: string,
  duration: number, calendarId: string, description: string, id: string
}
const _agenda: {
  name: string, date: string, events: AgendaEvent[]
}[] = []

const data = reactive({
  agenda: _agenda,
  isSubscribed: null as boolean | null,
  isSupported: false,
  isLoading: true,
  error: null as any
})
const titleCase = (str: string): string =>
  str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const handleRefresh = (event: { target: { complete: () => void } }) => {
  load().finally(() => event.target.complete())
};

async function load() {
  data.isLoading = true
  const dates = createDatesArray(7)
    .map(date => fetch('/api/calendars-api/book/search?date=' + date)
      .then(res => res.json())
      .then(json => ({ json, date })))
  const results = await Promise.all(dates)
    .catch((err: any) => {
      console.error('Failed to fetch calendar', err)
      data.error = err
      return []
    })
    .finally(() => data.isLoading = false)

  data.agenda = results.map(res => ({
    name: titleCase(format(parseISO(res.date), 'EEEE', { locale: sv })),
    date: format(parseISO(res.date), 'dd MMMM, yyyy', { locale: sv }),
    events: res.json.map((event: any) => ({
      name: event.name,
      startTime: format(parseISO(event.startTime), 'HH:mm'),
      endTime: format(parseISO(event.endTime), 'HH:mm'),
      duration: event.duration,
      calendarId: event.calendarId,
      description: event.description,
      id: event.id
    }))
  }))

}

onMounted(async () => {
  load()

  isSubscribed()
    .then(subscribed => data.isSubscribed = subscribed)
    .catch(() => {
      data.isSupported = false
      console.error('Notification not supported on web')
    })
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
