import { getDefaultProfile } from "../../services/global-profile-service/profile-data-service.js";
import { getCommandValue, getTdShowValueNode } from "./record-utils.js";
import { openProfileList } from "../global-profile/dropdown-profile-panel.js";

async function globalVariableClickHandler(event) {
  event.stopPropagation();
  if ($(event.target).hasClass("globalVariable")){
    const defaultProfile = await getDefaultProfile();
    const regex = /(?<=\${GlobalVariable\.).+?(?=})/g
    const globalVariableName = event.target.innerHTML.match(regex)?.[0];
    const index = await defaultProfile.findIndexByName(globalVariableName);

    $(`#${defaultProfile.id}`)[0].selectedVariableIndex = index;
    $(`#${defaultProfile.id}`).click();
    openProfileList();
  }

}

const addProfileLinkForCommandValue = async (tr) => {
  const regex = /(?<=\${GlobalVariable\.).+?(?=})/g
  const commandValue = getCommandValue(tr);
  const globalVariable = commandValue.match(regex)?.[0];
  if (globalVariable) {
    const defaultProfile = await getDefaultProfile();
    const variable = await defaultProfile.findVariableByName(globalVariable);
    if (variable) {
      const htmlString = commandValue.replaceAll("${GlobalVariable","<span class='globalVariable'>${GlobalVariable").replaceAll("}", "}</span>")
      getTdShowValueNode(tr, 3).innerHTML = "<span>" + htmlString + "</span>";
      getTdShowValueNode(tr, 3).addEventListener("click", globalVariableClickHandler);
      return;
    }
  }
  getTdShowValueNode(tr, 3).removeEventListener("click", globalVariableClickHandler);
  getTdShowValueNode(tr, 3).classList.remove("globalVariable");
}

const addProfileLinksForCommandValue = async (start, end) => {
    for (let i = start; i <= end; ++i) {
      const id = `records-${i}`;
      const trNode = document.getElementById(id);
      if (trNode !== null){
        await addProfileLinkForCommandValue(trNode);
      }
    }

}

export { addProfileLinksForCommandValue, addProfileLinkForCommandValue }

