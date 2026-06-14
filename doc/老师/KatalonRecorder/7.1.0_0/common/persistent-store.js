const persistentCache = {};

const PERSISTENT_STORE_URL = "http://katalon-persistent-domain.com/";
const PERSISTENT_STORE_DOMAIN = ".katalon-persistent-domain.com";
function getPersistentCookieName(key) {
  key = key.toLowerCase();
  return `katalon_persistent_value_${key}`;
}

/**
 * Local storage > Cookies > Profile Storage
 */
async function getPersistentValue(key, defaultValueProvider = () => "") {
  if (persistentCache[key]) {
    return persistentCache[key];
  }

  const localValue = await browser.storage.local.get(key).catch(() => {});
  if (localValue?.[key]) {
    return localValue[key];
  }

  const syncValue = await browser.storage.sync.get(key).catch(() => {});
  if (syncValue?.[key]) {
    return syncValue[key];
  }

  const cookieName = getPersistentCookieName(key);
  const cookies = await browser.cookies.getAll({
    name: cookieName,
  });
  const cookieValue = cookies.find((cookie) => cookie.value)?.value;
  if (cookieValue) {
    return JSON.parse(decodeURIComponent(cookieValue));
  }

  const defaultValue = await defaultValueProvider();
  await setPersistentValue(key, defaultValue);
  return defaultValue;
}

async function setPersistentValue(key, value) {
  persistentCache[key] = value;
  await Promise.allSettled([
    browser.storage.local.set({ [key]: value }),
    browser.storage.sync.set({ [key]: value }),
    browser.cookies.set({
      url: PERSISTENT_STORE_URL,
      domain: PERSISTENT_STORE_DOMAIN,
      name: getPersistentCookieName(key),
      value: encodeURIComponent(JSON.stringify(value)),
      expirationDate: new Date("9999-12-31").getTime() / 1000,
    }),
  ]);
  return value;
}

async function removePersistentValue(key) {
  delete persistentCache[key];
  await Promise.allSettled([
    browser.storage.local.remove(key),
    browser.storage.sync.remove(key),
    browser.cookies.remove({
      url: PERSISTENT_STORE_URL,
      name: getPersistentCookieName(key),
    }),
  ]);
}
