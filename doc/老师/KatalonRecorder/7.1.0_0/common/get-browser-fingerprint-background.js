let fingerprintPromise = null;
async function getBrowserFingerprint2() {
  try {
    if (fingerprintPromise) {
      return fingerprintPromise;
    }
    fingerprintPromise = getPersistentValue("visitor", async () => {
      return sendMessageToOffscreenDocument("get-fingerprint-visitor");
    }).then((visitor) => {
      return { browserId: visitor.visitorId, score: visitor.confidence.score };
    }).finally(() => {
      fingerprintPromise = null;
    });
    const data = await fingerprintPromise;
    return data;
  } catch (error) {
    console.warn(error);
    return {};
  }
}

async function getAllFingerprints() {
  const { browserId: browserId2, score: browserId2Confidence } =
    await getBrowserFingerprint2();
  return {
    browserId2,
    browserId2Confidence,
  };
}

async function getTrackingBrowserIds() {
  const {
    browserId2: browser_id_2,
    browserId2Confidence: browser_id_2_confidence,
  } = await getAllFingerprints();
  return { browser_id_2, browser_id_2_confidence };
}
