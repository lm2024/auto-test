/*import { getAllProfile } from "../../services/global-profile-service/profile-data-service.js";

async function profileTitleClickHandler(event){
  event.stopPropagation();
  $("#export-to-KS-test-case-preview-panel").css("display", "none");
  $("#export-to-KS-test-case-preview-other").css("display", "block");
}

async function userChooseProfileHandler(event, userChoice){
  event.stopPropagation();
  //element's ID has format export-to-KS-profile-{UUID}
  const profileID = event.target.parentElement.id.substring(21);
  if (event.target.checked) {
    await userChoice.addNewProfile(profileID);
  } else {
    await userChoice.removeProfile(profileID);
  }
}*/

/*const renderProfileTree = async (userChoice) => {
  const profileTreeContainer = document.getElementById("export-to-KS-profiles-list");
  const profiles = await getAllProfile();
  for (const profile of profiles) {

    const div = document.createElement("div");
    div.id = `export-to-KS-profile-${profile.id}`;
    div.classList.add("export-item");
    div.addEventListener("click", profileTitleClickHandler);
    profileTreeContainer.appendChild(div);

    const input = document.createElement("input");
    input.setAttribute("type", "checkbox");
    input.addEventListener("click", function(event){ userChooseProfileHandler(event, userChoice)});
    div.appendChild(input);
    if (profile.isDefault){
      $(input).click();
    }

    const title = document.createElement("div");
    title.innerHTML = profile.title;
    div.appendChild(title);

  }
}*/

/*
export { renderProfileTree }*/
