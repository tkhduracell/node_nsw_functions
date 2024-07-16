<template>
    <ion-header>
        <ion-toolbar>
            <ion-img :src="Logo"></ion-img>
        </ion-toolbar>
    </ion-header>
</template>

<script setup lang="ts">
import {
  IonHeader, IonToolbar, IonImg
} from '@ionic/vue';

import Logo from '@/assets/nsw-logo.png'
</script>

<style>
ion-header ion-toolbar ion-img::part(image) {
  height: 42px;
  padding-top: 8px;
  padding-bottom: 8px;
}
</style>