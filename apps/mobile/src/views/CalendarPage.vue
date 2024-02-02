<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-img src="./nsw-logo.png" style="margin-start: 1em; height: 32px;"></ion-img>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <ion-card v-if="subscription.isSubscribed">
        <ion-card-header>
          <ion-card-title>Bevaka</ion-card-title>
          <ion-card-subtitle>Du bevakar friträningar på denna enhet</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-button @click="unsubscribe">
            <ion-spinner slot="icon-only" name="circles" v-if="subscription.isLoading"></ion-spinner>
            <span v-if="!subscription.isLoading">Avsluta bevakning</span>
          </ion-button>
        </ion-card-content>
      </ion-card>

      <ion-card v-else-if="subscription.isSupported">
        <ion-card-header>
          <ion-card-title>Bevaka</ion-card-title>
          <ion-card-subtitle>Du kan bevaka friträning och få notiser när någon bokar ny träning</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-button @click="subscribe">
            <ion-spinner slot="icon-only" name="circles" v-if="subscription.isLoading"></ion-spinner>
            <span v-if="!subscription.isLoading">Bevaka friträningar</span>
          </ion-button>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="subscription.error">
        <ion-grid>
          <ion-row>
            <ion-col size="auto">
              <p>Kunde ej ladda prenumeration</p>
              <ion-label>{{ subscription.error }}</ion-label>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card>

      <ion-card v-if="agenda.error">
        <ion-grid>
          <ion-row>
            <ion-col size="auto">
              <ion-label>
                <p>Kunde ej ladda kalender</p>
                {{ agenda.error }}
              </ion-label>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card>

      <ion-card v-if="agenda.isLoading">
        <ion-grid>
          <ion-row class="ion-justify-content-center">
            <ion-col size="auto">
              <ion-spinner name="dots" color="danger" class="big"></ion-spinner>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card>

      <ion-card v-for="day in agenda.items" :key="day.date">
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
  </ion-page>
</template>
<style scoped>
@media (prefers-color-scheme: dark) {
  ion-item[data-calendar] {
    color: var(--ion-text-color);
  }

  ion-item[data-calendar="333892"] {
    --background: rgba(247, 186, 121, 0.9);
  }

  ion-item[data-calendar="358979"] {
    --background: rgba(252, 113, 132, 0.9);
  }
}

ion-item[data-calendar] {
  --border-radius: 6px;
  margin-bottom: 4px;
  color: var(--ion-color-dark);
}

ion-item[data-calendar] p.div {
  margin: 0;
  line-height: 0.6em;
  font-size: 0.6em;
}

/* Huvud */
ion-item[data-calendar="333077"] {
  --background: rgba(128, 0, 128, 0.9);
}

/* Kurs */
ion-item[data-calendar="333892"] {
  --background: rgba(244, 153, 56, 0.9);
}

/* Friträning */
ion-item[data-calendar="337667"] {
  --background: rgba(0, 128, 0, 0.9);
}

/* Tävling */
ion-item[data-calendar="358978"] {
  --background: rgba(41, 128, 185, 0.9);
}

/* Eventkalender */
ion-item[data-calendar="358979"] {
  --background: rgba(255, 70, 94, 0.9);
}

ion-spinner.big {
  width: 100px;
  height: 100px;
}
</style>
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonContent, IonButton,
  IonRow, IonList, IonItem, IonLabel, IonCard, IonCardContent, IonCardHeader,
  IonCardSubtitle, IonCardTitle, IonCol, IonGrid, IonIcon, IonImg, IonSpinner,
  IonRefresher, IonRefresherContent
} from '@ionic/vue';

import { caretDownOutline } from 'ionicons/icons'
import { useAgenda } from '@/compsables/agenda';
import { useSubscription } from '@/compsables/subscription';

const { data: agenda, load: loadAgenda } = useAgenda()
const { data: subscription, unsubscribe, subscribe } = useSubscription()

const handleRefresh = (event: { target: { complete: () => void } }) => {
  loadAgenda()
    .finally(() => event.target.complete())
};

</script>
