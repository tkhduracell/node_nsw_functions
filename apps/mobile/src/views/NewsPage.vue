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

      <ion-card v-for="item in (news?.items ?? [])" :key="item.id">
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
  IonRefresher, IonRefresherContent
} from '@ionic/vue';

import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useNews } from '@/compsables/news';

const { data: news, error, isFetching, execute } = useNews()

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
