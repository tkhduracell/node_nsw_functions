<!-- eslint-disable vue/no-v-text-v-html-on-component -->
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

      <ion-card v-if="subscription.isDenied">
        <ion-card-header>
          <ion-card-title>Bevaka</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Du har valt att inte tillåta notifiktioner.</p>
          <p>Du kan ändra detta under Inställningar &gt; Nackswinget &gt; Notiser.</p>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="subscription.isSubscribed">
        <ion-card-header>
          <ion-card-title>Bevaka</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Du bevakar nyheter på denna enhet.</p>
          <ion-button @click="unsubscribe">
            <ion-spinner slot="icon-only" name="circles" v-if="subscription.isLoading"></ion-spinner>
            <span v-if="!subscription.isLoading">Avsluta bevakning</span>
          </ion-button>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="subscription.isSupported && !subscription.isSubscribed">
        <ion-card-header>
          <ion-card-title>Bevaka</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Du kan bevaka nyheter och få notiser.</p>
          <ion-button @click="subscribe">
            <ion-spinner slot="icon-only" name="circles" v-if="subscription.isLoading"></ion-spinner>
            <span v-if="!subscription.isLoading">Bevaka nyheter</span>
          </ion-button>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="subscription.error">
        <ion-card-header>
          <ion-card-title>Ett fel inträffade</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Kunde ej ladda prenumeration.</p>
          <ion-label>{{ subscription.error }}</ion-label>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="error">
        <ion-card-header>
          <ion-card-title>Ett fel inträffade</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Kunde ej ladda nyheter</p>
          <ion-label>{{ error }}</ion-label>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="isFetching">
        <ion-grid>
          <ion-row class="ion-justify-content-center">
            <ion-col size="auto">
              <ion-spinner name="dots" color="danger" class="big"></ion-spinner>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card>

      <ion-card v-for="item in (news?.items ?? [])" :key="item.id" :href="item.link" target="_blank">
        <img :src="item.media.thumbnail.url" v-if="item.media?.thumbnail?.url" class="w-100" />
        <ion-card-header>
          <ion-card-title v-html="item.title"></ion-card-title>
          <ion-card-subtitle>
            {{ titleCase(format(item.published, 'EEEE d MMMM yyyy, HH:mm', { locale: sv })) }}, {{ item.author }}
          </ion-card-subtitle>
        </ion-card-header>

        <ion-card-content v-html="item.description">
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<style scoped>
ion-spinner.big {
  width: 100px;
  height: 100px;
}

.w-100 {
  width: 100%;
}
</style>
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonContent,
  IonRow, IonLabel, IonCard, IonCardContent, IonCardHeader,
  IonCardSubtitle, IonCardTitle, IonCol, IonGrid, IonImg, IonSpinner,
  IonRefresher, IonRefresherContent, IonButton
} from '@ionic/vue';

import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useNews } from '@/compsables/news';
import { useSubscription } from '@/compsables/subscription';

const { data: news, error, isFetching, execute } = useNews()
const { data: subscription, unsubscribe, subscribe } = useSubscription('news-nackswinget.se')

const handleRefresh = (event: { target: { complete: () => void } }) => {
  execute()
    .finally(() => event.target.complete())
};

const titleCase = (str: string): string =>
  str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
</script>
