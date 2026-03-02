<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<style>
/* Google Places Autocomplete dropdown — must appear above Vuetify drawers */
.pac-container {
  z-index: 9999 !important;
}
</style>
