<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Nackswinget - Friträningar</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Tab 1</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content class="ion-padding">
        <ion-button @click="subscribe">Bevaka fritärningar</ion-button>
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
              <ion-item v-for="event in day.events" :key="day.date + event.name + event.startTime" :class="[event]">
                <ion-label>{{ event.startTime }} - {{ event.name }} ({{ event.duration }} minuter)</ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

      </ion-content>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/vue';
import { onMounted, reactive } from 'vue';
import { addDays, format, parseISO } from 'date-fns'
import { sv } from 'date-fns/locale'
import { FCM } from "@capacitor-community/fcm"
import { PushNotifications } from "@capacitor/push-notifications"

const _agenda: {
  name: string, date: string, events: { name: string, startTime: string, endTime: string, duration: number }[]
}[] = []

const data = reactive({
  agenda: _agenda
})
const titleCase = (str: string): string =>
  str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

onMounted(async () => {
  const dates = createDatesArray(7)
    .map(date => fetch('/api/book/search?date=' + date)
      .then(res => res.json())
      .then(json => ({ json, date })))

  const results = await Promise.all(dates)

  data.agenda = results.map(res => ({
    name: titleCase(format(parseISO(res.date), 'EEEE', { locale: sv })),
    date: format(parseISO(res.date), 'dd MMMM, yyyy', { locale: sv }),
    events: res.json.map((event: any) => ({
      name: event.name,
      startTime: format(parseISO(event.startTime), 'HH:mm'),
      endTime: format(parseISO(event.endTime), 'HH:mm'),
      duration: event.duration,
      calendar: event.calendar
    }))
  }))

})

const createDatesArray = (days: number): string[] => {
  return Array.from({ length: days }, (_, index) =>
    format(addDays(new Date(), index), 'yyyy-MM-dd')
  );
};


async function doSubscribe(token: string) {
  const baseUrl = 'https://europe-north1-nackswinget-af7ef.cloudfunctions.net/notifications-api'
  const query = new URLSearchParams()
  query.append('token', token)
  query.append('topic', 'calendar-337667')

  const resp = await fetch(baseUrl + '/subscribe?' + query.toString(), { method: 'POST' })
  if (resp.ok) {
    console.log('subscribed')
  } else {
    console.log('failed to subscribe', resp)
  }
}

async function subscribe() {
  await PushNotifications.requestPermissions();
  await PushNotifications.register();

  const { token } = await FCM.getToken()

  doSubscribe(token)
}

</script>
