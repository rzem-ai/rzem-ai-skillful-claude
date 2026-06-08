import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { router } from './router';
import { initTheme } from './composables/useTheme';
import './styles/app.css';

// Apply persisted (or default dark) theme before mount so there's no flash.
initTheme();

createApp(App) //
    .use(createPinia()) //
    .use(router) //
    .mount('#app');
