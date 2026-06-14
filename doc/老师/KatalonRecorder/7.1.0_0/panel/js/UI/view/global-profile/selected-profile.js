import { saveProfileData } from "../../services/global-profile-service/globla-profile-local-storage.js";

const getSelectedProfile = () => {
  const profileListElement = document.getElementById("profile-list");
  const selectedProfileElements = profileListElement.getElementsByClassName("selected");
  if (selectedProfileElements) {
    return selectedProfileElements[0];
  } else {
    return null;
  }
}

const setSelectedProfile = (id) => {
  $('#profile-list .selected').removeClass("selected");
  $(`#${id}`).addClass("selected");
}

export { getSelectedProfile, setSelectedProfile }