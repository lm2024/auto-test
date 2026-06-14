async function getBrowserFingerprint2() {
  try {
    const visitor = await getPersistentValue("visitor", async () => {
      return (await FingerprintJS.load({ region: "ap" })).get();
    });
    return { browserId: visitor.visitorId, score: visitor.confidence.score };
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

