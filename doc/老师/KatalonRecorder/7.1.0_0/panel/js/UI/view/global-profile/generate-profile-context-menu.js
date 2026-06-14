import { getSelectedProfile } from "./selected-profile.js";
import {
  addProfile,
  duplicateProfile,
  findProfileByID, removeProfile,
  setDefaultProfile
} from "../../services/global-profile-service/profile-data-service.js";
import { renderNewProfile } from "./render-new-profile.js";
import { saveProfileData } from "../../services/global-profile-service/globla-profile-local-storage.js";
import { GenericDialog } from "../dialog/generic-dialog.js";
import { renderProfileList } from "./render-profile-list.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { getSelectedCase } from "../testcase-grid/selected-case.js";
import { addProfileLinksForCommandValue } from "../records-grid/global-profile-link-for-command-value.js";
import { addDirtyMark, removeDirtyMark } from "./dirty-mark.js";
import {
  GlobalProfileAssignValueFirstDialog, GlobalProfileAssignValueSecondDialog,
  GlobalProfileAssignValueWizardDialogMediator
} from "./global-profile-assign-value-dialogs.js";

function generateSaveItem(){
  const save = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Save profile";
  save.appendChild(a);
  save.addEventListener("click", async function (event) {
    event.stopPropagation();
    const selectedProfile = await findProfileByID(getSelectedProfile().id);
    if (await selectedProfile.isContainDuplicated()){
      const dialog = new GenericDialog({
        id: "duplicateVariableWarning",
        title: "Warning",
        message: `Profile ${selectedProfile.title} contains duplicated global variables.`,
        buttons: [
          {
            text: "OK",
            id: "waring-duplicate-ok"
          }
        ],
        height: 170,
        width: 400
      });
      await dialog.render();
      $("#waring-duplicate-ok").click(() => {
        dialog.close();
      });
    } else {
      removeDirtyMark(selectedProfile.id);
      await saveProfileData();
    }

  }, false);
  return save;
}

function generateRenameItem() {
  const rename = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Rename";
  rename.appendChild(a);
  rename.addEventListener("click", async function (event) {
    event.stopPropagation();
    const selectedProfileElement = getSelectedProfile();
    const profile = await findProfileByID(selectedProfileElement.id);
    const newTitle = prompt("Please enter the Profile's title", profile.title);
    if (newTitle) {
      profile.title = newTitle;
      selectedProfileElement.childNodes[1].innerHTML = newTitle;
      addDirtyMark(profile.id);
    }
  }, false);
  return rename;
}

function generateDuplicateItem() {
  const duplicate = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Duplicate";
  duplicate.appendChild(a);
  duplicate.addEventListener("click", async function (event) {
    event.stopPropagation();
    const selectedProfileElement = getSelectedProfile();
    const profile = await findProfileByID(selectedProfileElement.id);
    const newProfile = await duplicateProfile(profile);
    await addProfile(newProfile);
    newProfile.title = newProfile.title + " copy";

    await saveProfileData();
    renderNewProfile(newProfile);
  }, false);
  return duplicate;
}


function generateRemoveItem() {
  const remove = document.createElement("li");
  remove.setAttribute("style", "border-top: 1px solid #E8EBED;");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.setAttribute("style", "color: #B41400;");
  a.textContent = "Remove";
  remove.appendChild(a);
  remove.addEventListener("click", async function (event) {
    event.stopPropagation();
    const selectedProfileElement = getSelectedProfile();
    const profile = await findProfileByID(selectedProfileElement.id);
    if (profile.isDefault) {
      const dialog = new GenericDialog({
        id: "alertProfile",
        title: "Acknowledge",
        message: "You cannot delete a default Execution Profile. Please specify another profile as default before proceed.",
        buttons: [
          {
            text: "OK",
            id: "profile-ok"
          }
        ],
        height: 170,
        width: 400
      });

      await dialog.render();
      $("#profile-ok").click(() => {
        dialog.close();
      });
    } else {
      await removeProfile(profile.id);
      $(`#${profile.id}`).remove();
      await saveProfileData();
    }
  }, false);
  return remove;
}


function generateSetProfileDefault() {
  const setDefault = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Set as default Execution Profile";
  setDefault.appendChild(a);
  setDefault.addEventListener("click", async function (event) {
    event.stopPropagation();
    const selectedProfileElement = getSelectedProfile();
    await setDefaultProfile(selectedProfileElement.id);
    $("#profile-list").empty();
    await saveProfileData();
    await renderProfileList();
    const selectedTestCase = findTestCaseById(getSelectedCase().id);
    await addProfileLinksForCommandValue(1, selectedTestCase.getTestCommandCount());

  }, false);
  return setDefault;
}

function generateDownloadProfile(){
  const downloadProfile = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Download profile";
  downloadProfile.appendChild(a);
  downloadProfile.addEventListener("click", async function (event) {
    event.stopPropagation();
    const selectedProfileElement = getSelectedProfile();
    const profile = await findProfileByID(selectedProfileElement.id)
    let fileContent = "data:application/json;charset=utf-8," + JSON.stringify(profile);
    let encodedUri = encodeURI(fileContent);
    let link = document.createElement("a");
    link.setAttribute("id", "123");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", profile.title + ".krprofile");
    document.body.appendChild(link);
    link.click();
    $(link).remove();

  }, false);
  return downloadProfile;
}

function generateUseProfileInTestCase(profile){
  const useInTestCase = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Use this in a test case";
  useInTestCase.appendChild(a);
  useInTestCase.addEventListener("click", async function (event) {
    event.stopPropagation();
    const mediator = new GlobalProfileAssignValueWizardDialogMediator();
    const dialog1 = new GlobalProfileAssignValueFirstDialog(mediator);
    const dialog2 = new GlobalProfileAssignValueSecondDialog(mediator, profile);
    const screenObj = {};
    screenObj[dialog1.id] = dialog1;
    screenObj[dialog2.id] = dialog2;
    mediator.setWizardDialogScreens(screenObj);

    dialog1.render();

  }, false);
  return useInTestCase;
}

const generateProfileContextMenu = (profile) => {
  const menu = document.createElement("div");
  menu.setAttribute("class", "menu");
  menu.setAttribute("id", "menu" + profile.id);
  const ul = document.createElement("ul");
  const downloadProfile = generateDownloadProfile();
  const save = generateSaveItem();
  const rename = generateRenameItem();
  const duplicate = generateDuplicateItem();
  const remove = generateRemoveItem();
  const useInTestCase = generateUseProfileInTestCase(profile);

  ul.appendChild(useInTestCase);
  if (!profile.isDefault) {
    const setProfileDefault = generateSetProfileDefault();
    ul.appendChild(setProfileDefault);
  }
  ul.appendChild(save);
  ul.appendChild(downloadProfile);
  ul.appendChild(rename);
  ul.appendChild(duplicate);
  ul.appendChild(remove);

  menu.appendChild(ul);
  return menu;
}

export { generateProfileContextMenu }