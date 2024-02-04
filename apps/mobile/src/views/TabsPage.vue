<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">

        <ion-tab-button tab="tab1" href="/tabs/calendar">
          <ion-icon aria-hidden="true" :icon="calendar" />
          <ion-label>Kalender</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="tab2" href="/tabs/news">
          <ion-icon aria-hidden="true" :icon="newspaper" />
          <ion-label>Nyheter</ion-label>
        </ion-tab-button>

      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { calendar, newspaper } from 'ionicons/icons';
</script>
