import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import Aura from "@primeuix/themes/aura";
import { addCollection } from "@iconify/vue";
import lucide from "@iconify-json/lucide/icons.json";

import App from "./App.vue";
import { router } from "./router";
import "./styles/main.css";

// Bundle the Lucide icon set so @iconify/vue resolves icons offline
// instead of fetching from api.iconify.design at runtime — the
// renderer's CSP (default-src 'self') blocks those requests.
addCollection(lucide);

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: ".dark",
      cssLayer: {
        name: "primevue",
        order: "theme, base, primevue",
      },
    },
  },
});

app.mount("#app");
