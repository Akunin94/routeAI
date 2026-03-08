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

/* Hide InfoWindow close button — windows close on mouseout */
.gm-ui-hover-effect {
  display: none !important;
}

/* Reset InfoWindow default padding so content controls spacing */
.gm-style-iw-ch,
.gm-style-iw-d,
.gm-style-iw-c {
  padding: 0 !important;
}
.gm-style-iw-d {
  overflow: hidden !important;
}

/* Dark mode for Google Maps InfoWindow */
.v-theme--dark .gm-style-iw-c {
  background-color: #1e293b !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5) !important;
}
.v-theme--dark .gm-style-iw-t::after {
  background-color: #1e293b !important;
}
.v-theme--dark .map-iw-label {
  color: #f1f5f9 !important;
}
.v-theme--dark .map-iw-address {
  color: #94a3b8 !important;
}
</style>
