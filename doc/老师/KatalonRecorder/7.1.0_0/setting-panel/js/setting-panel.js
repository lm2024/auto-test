import { KSPortSettingTab } from "./setting-tabs/KS-port-setting-tab.js";
import { SelfHealingSettingTab } from "./setting-tabs/self-healing-setting-tab.js";
import { generateMenuTree } from "./UI/menu-tree.js";
import { displayConfirmCloseDialog } from "./UI/confirm-close-dialog.js";
import { Interface } from "../../interface/Interface.js";
import { ISettingTab } from "./setting-tabs/ISettingTab.js";
import { PrivacySettingTab } from "./setting-tabs/privacy-setting-tab.js";
import { TestExecutionTab } from "./setting-tabs/test-execution-setting-tab.js";

const container = $("#content");
const selfHealingSettingTab = new SelfHealingSettingTab(container);
const portSettingTab = new KSPortSettingTab(container);
const privacySettingTab = new PrivacySettingTab(container);
const testExecutionTab = new TestExecutionTab(container);

Interface.ensureImplement(portSettingTab, [ISettingTab]);
Interface.ensureImplement(selfHealingSettingTab, [ISettingTab]);
Interface.ensureImplement(privacySettingTab, [ISettingTab]);
Interface.ensureImplement(testExecutionTab, [ISettingTab]);

let isChange = false;

const setIsChange = (value) => {
  isChange = value;
}

async function generateUI() {
  generateMenuTree();
  container.append(selfHealingSettingTab.getContent());
  container.append(portSettingTab.getContent());
  container.append(await privacySettingTab.getContent());
  container.append(await testExecutionTab.getContent());
}

async function saveData() {
  portSettingTab.saveData();
  await selfHealingSettingTab.saveData();
  await privacySettingTab.saveData();
  await testExecutionTab.saveData();
}

function attachButtonEvent() {
  $("#save-btn").click(function () {
    setIsChange(false);
    saveData().then(() => {
      alert("Save successfully");
    });
  });

  $("#close-btn").click(function () {
    if (!isChange) {
      window.close();
      return;
    }
    displayConfirmCloseDialog().then(async (result) => {
      switch (result) {
        case "yes":
          await saveData();
          window.close();
          break;
        case "no":
          window.close();
      }
    });
  });
}

async function initialize() {
  portSettingTab.initialize();
  await selfHealingSettingTab.initialize();
  await privacySettingTab.initialize();
  await testExecutionTab.initialize();
}

function displayFirstTab() {
  const menuTree = $("#menu-tree-view");
  const node = menuTree.tree('getNodeById', "KSPort");
  menuTree.tree('selectNode', node);
  portSettingTab.display();
}

async function displayTab() {
  let tabId = await browser.storage.local.get("testExecutionTab");
  console.log("Panel: ", tabId.testExecutionTab);
  const menuTree = $("#menu-tree-view");

  if (tabId.testExecutionTab) {
    const node = menuTree.tree('getNodeById', "testExecution");
    menuTree.tree('selectNode', node);
    testExecutionTab.display();
  }
  else {
    const node = menuTree.tree('getNodeById', "KSPort");
    menuTree.tree('selectNode', node);
    portSettingTab.display();
  }

  // Reset to default
  browser.storage.local.set({ testExecutionTab: false });
}

$(document).ready(function () {
  generateUI().then(() => {
    attachButtonEvent();
    initialize().then(displayTab);
  });

});

export { setIsChange }
export { selfHealingSettingTab, portSettingTab, privacySettingTab, testExecutionTab }