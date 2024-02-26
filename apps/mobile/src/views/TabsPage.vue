<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">

        <ion-tab-button tab="tab1" href="/tabs/calendar" >
          <ion-icon aria-hidden="true" :icon="calendar" ref="htmlRefHook1" />
          <ion-label>Kalender</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab2" href="/tabs/news">
          <ion-icon aria-hidden="true" :icon="newspaper" ref="htmlRefHook2"/>
          <ion-label>Nyheter</ion-label>
        </ion-tab-button>

      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { calendar, newspaper } from 'ionicons/icons';
import { onLongPress } from '@vueuse/core'
import { ref } from 'vue'
import { Toast } from '@capacitor/toast';
import { FCM } from '@capacitor-community/fcm';

const showDeviceToken = () => {
  FCM.getToken().then(({ token }) => {
    console.log('Device:', { token })
    return `Device token: ${token}`
  }).then(text => Toast.show({ text }))
}

const htmlRefHook1 = ref<HTMLElement | null>(null)
onLongPress(htmlRefHook1, showDeviceToken, { delay: 1000 })

const htmlRefHook2 = ref<HTMLElement | null>(null)
onLongPress(htmlRefHook2, showDeviceToken, { delay: 1000 })
</script>
