function isObjectEmpty(obj) {
  return obj &&
    Object.keys(obj).length === 0 &&
    obj.constructor === Object
}

const getTrackingLeftSidePanelData = async () => {
  let data = await browser.storage.local.get("leftSidePanelTracking");
  if (isObjectEmpty(data)) {
    data = {
      saveTestCaseNum: 0,
      addTestData: 0,
      addDynamicTestSuite: 0,
    }
    await browser.storage.local.set({
      "leftSidePanelTracking": {
        saveTestCaseNum: 0,
        addTestData: 0,
        addDynamicTestSuite: 0,
      }
    });
    return data;
  }
  return data.leftSidePanelTracking;
}

async function trackingSaveTestCase() {
  const trackingData = await getTrackingLeftSidePanelData();
  trackingData.saveTestCaseNum += 1;
  await browser.storage.local.set({ "leftSidePanelTracking" : trackingData });
}

async function trackingAddTestData(){
  const trackingData = await getTrackingLeftSidePanelData();
  trackingData.addTestData += 1;
  await browser.storage.local.set({ "leftSidePanelTracking" : trackingData });
}

async function trackingAddDynamicTestSuite(){
  const trackingData = await getTrackingLeftSidePanelData();
  trackingData.addDynamicTestSuite += 1;
  await browser.storage.local.set({ "leftSidePanelTracking" : trackingData });
}

const setTrackingLeftSidePanelData = async (type, value) => {
  switch (type) {
    case "saveTestCase":
      await trackingSaveTestCase();
      break;
    case "addTestData":
      await trackingAddTestData();
      break;
    case "addDynamicTestSuite":
      await trackingAddDynamicTestSuite();
      break;
    default:
      throw `${type} is not supported`
  }
}

export { setTrackingLeftSidePanelData, getTrackingLeftSidePanelData }