/**
 * Duplicate from src/panel/js/UI/services/tracking-service/segment-tracking-service.js
 * From manifest v3, we can't use dynamic import in background script
 */

async function trackingSegmentAPI(data) {
  if (!data.properties) {
    data.properties = {};
  }
  data.properties.browser_name = await getBrowserName();
  const browserIds = await getTrackingBrowserIds();
  Object.assign(data.properties, browserIds);

  return browser.storage.local.get("setting").then((settingData) => {
    if (
      data.event === "kru_install_application" ||
      settingData.setting.tracking
    ) {
      let fetchData = {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-type": "application/json; charset=UTF-8" },
      };
      return fetch(
        `${getSegmentEndpoint()}/segment-kr/tracking`,
        fetchData
      ).then((data) => data);
    }
  });
}

function getLoggedInUserAPI() {
  return fetch(`${getKatalonEndpoint()}wp-json/restful_api/v1/auth/kr/me`)
    .then((response) => response.json())
    .then((data) => {
      let user;
      if (data.user_info) {
        user = { email: data.user_info };
      } else {
        user = {};
      }
      return Promise.resolve(user);
    })
    .catch((error) => {
      console.log(error);
      return Promise.resolve({});
    });
}

function getKatalonEndpoint() {
  let manifestData = browser.runtime.getManifest();
  return manifestData.homepage_url;
}

function getSegmentEndpoint() {
  let manifestData = browser.runtime.getManifest();
  return manifestData.segment_url;
}

async function trackingInstallApp() {
  const cookies = await browser.cookies.getAll({
    name: "kr_campaign_source",
  });
  const campaignSource = cookies.find((cookie) => cookie.value)?.value;
  let data = {
    userId: await getAnonymousId(),
    event: "kru_install_application",
    properties: {
      kr_campaign_source: campaignSource,
    },
  };
  browser.storage.local.get("segment").then(async function (result) {
    result = !result.segment
      ? {
          segment: {
            userId: data.userId,
            user: "",
          },
        }
      : {
          segment: result.segment,
        };
    let user = await getLoggedInUserAPI();
    if (Object.keys(user).length !== 0) {
      result.segment.user = user.email.email;
      data.properties.user = user.email.email;
    }
    await browser.storage.local.set(result);
    return trackingSegmentAPI(data);
  });
}
