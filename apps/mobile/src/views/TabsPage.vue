<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">

        <ion-tab-button tab="tab1" href="/tabs/calendar">
          <ion-icon aria-hidden="true" :icon="calendar" ref="calendarButtonRef" />
          <ion-label>Kalender</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab2" href="/tabs/book" v-if="dev || bookingEnabled">
          <ion-icon aria-hidden="true" :icon="accessibility" />
          <ion-label>Boka</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab3" href="/tabs/news">
          <ion-icon aria-hidden="true" :icon="newspaper" ref="newsButtonRef" />
          <ion-label>Nyheter</ion-label>
        </ion-tab-button>

      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { calendar, newspaper, accessibility } from 'ionicons/icons';
import { onLongPress, useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'
import { Toast } from '@capacitor/toast';
import { FCM } from '@capacitor-community/fcm';

const dev = process.env.NODE_ENV !== 'production'

const showDeviceToken = () => {
  FCM.getToken().then(({ token }) => {
    console.log('Device:', { token })
    return `Device token: ${token}`
  }).then(text => Toast.show({ text }))
}

const bookingEnabled = useLocalStorage('bookingEnabled', false)

const calendarButtonRef = ref<HTMLElement | null>(null)
onLongPress(calendarButtonRef, async () => {
  await Toast.show({ text: 'Du kan nu boka' })
  bookingEnabled.value = true
}, { delay: 1000 })

const newsButtonRef = ref<HTMLElement | null>(null)
onLongPress(newsButtonRef, showDeviceToken, { delay: 1000 })
</script>

<style>
ion-tab-button {
  /* Prevents long-press from selecting text */
  user-select: none;
  --user-select: none;
}
</style>