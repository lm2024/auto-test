import { portSettingTab, privacySettingTab, selfHealingSettingTab, testExecutionTab } from "../setting-panel.js";

const treeDataStructure = [
  {
    id: "KSPort",
    name: "Katalon Studio Port",
  },
  {
    id: "selfHealing",
    name: "Self Healing"
  },
  {
    id: "privacy",
    name: "Privacy",
  },
  {
    id: "testExecution",
    name: "Test Execution",
  },
];

function generateMenuTree() {
  $("#menu-tree-view").tree({
    data: treeDataStructure,
  });
  $('#menu-tree-view').on(
    'tree.click',
    function (event) {
      switch (event.node.id) {
        case "KSPort":
          portSettingTab.display();
          break;
        case "selfHealing":
          selfHealingSettingTab.display();
          break;
        case "privacy":
          privacySettingTab.display();
          break;
        case "testExecution":
          testExecutionTab.display();
          break;
      }
    }
  );
}


export { generateMenuTree }