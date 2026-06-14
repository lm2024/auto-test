import {
  getSelectedVariable,
  getSelectedVariables,
  setSelectedVariable
} from "../../view/global-profile/selected-variable.js";
import { getSelectedProfile } from "../../view/global-profile/selected-profile.js";
import { findProfileByID } from "./profile-data-service.js";
import { assignId } from "../../view/global-profile/assign-id.js";
import { addDirtyMark } from "../../view/global-profile/dirty-mark.js";
import { ProfileVariable } from "../../models/global-profile/profile-variable.js";
import { addVariable, appendVariable } from "../../view/global-profile/add-variable.js";
import { DeleteProfileDialog } from "../../view/global-profile/delete-profile-dialog.js";

let tempVariables = [];

const addVariableAction = async () => {
  const selectedProfile = await findProfileByID(getSelectedProfile().id);
  await selectedProfile.insertNewVariable(new ProfileVariable(), await selectedProfile.countVariables());
  await appendVariable();
  await assignId(0, await selectedProfile.countVariables());
  addDirtyMark(selectedProfile.id);
}

const deleteVariableAction = async () => {
  const selectedVariableElements = [...getSelectedVariables()];
  const selectedProfileElement = getSelectedProfile();



  if (selectedVariableElements && selectedProfileElement){
    const profile = await findProfileByID(selectedProfileElement.id);
    while (selectedVariableElements.length > 0){
      const element = selectedVariableElements.shift();
      //element's ID has format "variable-{index}"
      const index = parseInt(element.id.substring(9));
      const dialog = new DeleteProfileDialog(profile, index, element);
      await dialog.render();
    }
  }
}

const copyVariableAction = async () => {
  const selectedVariableElements = getSelectedVariables();
  const selectedProfileElement = getSelectedProfile()
  if (selectedVariableElements && selectedProfileElement){
    tempVariables = [];
    const profile = await findProfileByID(selectedProfileElement.id);
    for (const element of selectedVariableElements){
      //element's ID has format "variable-{index}"
      const index = parseInt(element.id.substring(9));
      const variable = await profile.getVariableByIndex(index);
      tempVariables.push(variable);
    }
  }
}

const pasteVariableAction = async () => {
  const selectedVariableElement = getSelectedVariable();
  const selectedProfileElement = getSelectedProfile()
  if (selectedProfileElement === undefined){
    return;
  }
  const profile = await findProfileByID(selectedProfileElement.id);
  if (selectedVariableElement){
    //element's ID has format "variable-{index}"
    let index = parseInt(selectedVariableElement.id.substring(9));
    for (const variable of tempVariables){
      let variableName = variable.name;
      while (await profile.isVariableNameExist(variableName)){
        variableName += "_copy";
      }
      await profile.insertNewVariable(new ProfileVariable(variableName, variable.value), index);
      await addVariable({name: variableName, value: variable.value, index: index});
      index++;
    }
    addDirtyMark(profile.id);
    await assignId(0, await profile.countVariables());
    setSelectedVariable(index);
  } else {
    for (const variable of tempVariables){
      let variableName = variable.name;
      while (await profile.isVariableNameExist(variableName)){
        variableName += "_copy";
      }
      await profile.insertNewVariable(new ProfileVariable(variableName, variable.value));
      await appendVariable(variableName, variable.value);
    }
    addDirtyMark(profile.id);
    await assignId(0, await profile.countVariables());
    setSelectedVariable(0);
  }

}

export { addVariableAction, deleteVariableAction, copyVariableAction, pasteVariableAction}