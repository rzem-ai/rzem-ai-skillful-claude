import { createApp } from "vue";

import App from "./App.vue";
import "./styles/main.css";

// Minimal mount. Pinia, Vue Router, PrimeVue and the Iconify icon set are
// still installed as dependencies, ready to be wired back in as the new
// version takes shape — they're intentionally left out of this skeleton.
createApp(App).mount("#app");
