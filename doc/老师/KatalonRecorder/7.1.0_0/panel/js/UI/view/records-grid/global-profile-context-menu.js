import { generateValueContextMenu } from "./generate-value-context-menu.js";
import { getCommandValue, getTdShowValueNode } from "./record-utils.js";

const addValueContextMenu = (start, end) => {
  for (let i = start; i <= end; ++i) {
    const id = `records-${i}`;
    const trNode = document.getElementById(id);
    const commandValue = getCommandValue(trNode);
    if (commandValue !== ""){
      appendValueContextMenu(id);
      appendAddVariableButton(id);
    }
  }
}

const appendValueContextMenu = (id) => {
  const node = document.getElementById(id);
  const valueDiv = node.getElementsByClassName("value")[0];

  let menu = $(valueDiv).find(".menu")[0];
  if (!menu) {
    menu = generateValueContextMenu(id);
    valueDiv.appendChild(menu);
  }
}

const appendAddVariableButton = (id) => {
  const node = document.getElementById(id);
  if ($(node).find(".addNewVariable").length > 0){
    return;
  }
  const valueTd = getTdShowValueNode(node, 3);
  const addNewVariable = document.createElement("div");
  addNewVariable.classList.add("addNewVariable");
  valueTd.appendChild(addNewVariable);
  $(addNewVariable).click(function (event) {
    const mid = "#" + "menu" + id;
    $(mid).css("left", event.pageX - 180).css("top", event.pageY + 10);
    $(mid).show();
  })
}

const removeValueContextMenu = (id) => {
  $(`#${id} .menu`).remove();
}

const removeAddVariableButton = (id) => {
  $(`#${id} .addNewVariable`).remove();
}

export { addValueContextMenu, appendValueContextMenu, appendAddVariableButton, removeValueContextMenu, removeAddVariableButton }