import { createApp } from './app';
import { createStore } from './db/index';
import { BUILD, PORT } from './config';

const store = createStore();
const app = createApp(store);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`@yumo/server ${BUILD} listening on :${PORT}`);
});
