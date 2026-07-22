import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import App from './App.vue'
import router from './router'

const savedTheme = localStorage.getItem('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
// Only 'light'/'dark' are registered themes — ignore any stale/invalid value
// so Vuetify never resolves an undefined theme (crashes on `.current.value.dark`).
const defaultTheme =
  savedTheme === 'light' || savedTheme === 'dark'
    ? savedTheme
    : prefersDark
      ? 'dark'
      : 'light'

const vuetify = createVuetify({
  icons: { defaultSet: 'mdi' },
  theme: {
    defaultTheme,
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')
