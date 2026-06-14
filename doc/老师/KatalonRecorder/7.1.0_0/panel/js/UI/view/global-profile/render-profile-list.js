import { getAllProfile } from "../../services/global-profile-service/profile-data-service.js";
import { renderNewProfile } from "./render-new-profile.js";

const renderProfileList = async () => {
  const profiles = await getAllProfile();
  if (profiles){
    profiles.forEach(profile => {
      renderNewProfile(profile);
    })
  }
}

export { renderProfileList }