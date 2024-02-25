<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { provideClient } from './compsables/client';
import { provideAgenda } from './compsables/agenda';
import { provideNews } from './compsables/news';

const client = provideClient()
provideAgenda(client)
provideNews(client)

</script>
