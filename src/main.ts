import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';

import App from './App.vue';
import { router } from './router';
import { initTheme } from './composables/useTheme';
import './styles/tailwind.css';
import './styles/app.css';

// Ship Font Awesome's CSS via the bundler instead of letting the core inject it
// at runtime — avoids a flash of unstyled (oversized) icons on first paint.
config.autoAddCss = false;

// Apply persisted (or default dark) theme before mount so there's no flash.
initTheme();

createApp(App) //
    .use(createPinia()) //
    .use(router) //
    .mount('#app');
