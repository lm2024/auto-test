import { createNewProfile, getDefaultProfile } from "../../services/global-profile-service/profile-data-service.js";
import { getSelectedRecord } from "./selected-records.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { getSelectedCase } from "../testcase-grid/selected-case.js";
import { ProfileVariable } from "../../models/global-profile/profile-variable.js";
import { renderNewProfile } from "../global-profile/render-new-profile.js";
import { trackingSegment } from "../../services/tracking-service/segment-tracking-service.js";
import { addValueToProfileAction } from "../../services/records-grid-service/actions.js";

function generateAddToNewProfileItem() {
  const addToNewProfile = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Add to a new profile";
  addToNewProfile.appendChild(a);
  addToNewProfile.addEventListener("click", async function (event) {
    event.stopPropagation();
    const title = prompt("Please enter the Profile's title", "Untitled Profile");
    if (title) {
      const newProfile = await createNewProfile(title);
      renderNewProfile(newProfile);
      const selectedRecordID = getSelectedRecord();
      const selectedRecord = document.getElementById(selectedRecordID);
      const selectedTestCase = findTestCaseById(getSelectedCase().id);
      const index = parseInt(selectedRecordID.substring(8)) - 1;
      const testCommand = selectedTestCase.commands[index];

      if (testCommand.value !== "") {
        await addValueToProfileAction(testCommand, selectedRecord, newProfile);
        trackingSegment("kru_add_global_variables_from_test_case",
          { num_global_variables: 1 });
      }

      /*const variableName = `variable-${newProfile.variables.length}`;
      const variableValue = testCommand.value;
      await newProfile.insertNewVariable(new ProfileVariable(variableName, variableValue));
      trackingSegment("kru_new_profile", { source: "profile_context_menu" });*/
    }

  }, false);
  return addToNewProfile;
}

function generateAddToCurrentProfileItem() {
  const addToCurrentProfile = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Add to the default profile";
  addToCurrentProfile.appendChild(a);
  addToCurrentProfile.addEventListener("click", async function (event) {
    event.stopPropagation();
    const selectedRecordID = getSelectedRecord();
    const selectedRecord = document.getElementById(selectedRecordID);
    const selectedTestCase = findTestCaseById(getSelectedCase().id);
    const index = parseInt(selectedRecordID.substring(8)) - 1;
    const testCommand = selectedTestCase.commands[index];
    const defaultProfile = await getDefaultProfile();

    if (testCommand.value !== "") {
      await addValueToProfileAction(testCommand, selectedRecord, defaultProfile);
      trackingSegment("kru_add_global_variables_from_test_case",
        { num_global_variables: 1 });
    }
  }, false);
  return addToCurrentProfile;
}


const generateValueContextMenu = (id) => {
  const menu = document.createElement("div");
  menu.setAttribute("class", "menu");
  menu.setAttribute("id", "menu" + id);
  const ul = document.createElement("ul");
  const newProfile = generateAddToNewProfileItem();
  const addToCurrentProfile = generateAddToCurrentProfileItem();


  ul.appendChild(newProfile);
  ul.appendChild(addToCurrentProfile);


  menu.appendChild(ul);
  return menu;
}


export { generateValueContextMenu }