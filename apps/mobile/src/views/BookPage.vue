<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <ion-page>
    <iframe src="https://nackswinget.se/boka" class="w-100 h-100" />
  </ion-page>
</template>

<style scoped>
.h-100 {
  height: 100%;
}

.w-100 {
  width: 100%;
}
</style>
<script setup lang="ts">
import {
  IonPage
} from '@ionic/vue';
</script>
