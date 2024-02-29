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

<style>
@keyframes tilt-shaking {
  0% {
    transform: translate(0, 0) rotate(0deg);
  }

  25% {
    transform: translate(5px, 5px) rotate(2deg);
  }

  50% {
    transform: translate(0, 0) rotate(0eg);
  }

  75% {
    transform: translate(-5px, 5px) rotate(-2deg);
  }

  100% {
    transform: translate(0, 0) rotate(0deg);
  }
}

.text-bold {
  font-weight: bold;
}
</style>