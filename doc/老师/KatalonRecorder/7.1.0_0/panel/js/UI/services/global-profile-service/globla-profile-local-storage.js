import { Profile } from "../../models/global-profile/profile.js";
import { ProfileVariable } from "../../models/global-profile/profile-variable.js";
import { addEmptyDefaultProfile, addProfile, countProfile } from "./profile-data-service.js";

/**
 * mapping a JSON object contains data from a ProfileData object to a real ProfileData
 * @param {Object} jsonProfileData
 */
async function mappingProfileData(jsonProfileData) {
  for (const jsonProfile of jsonProfileData.profiles) {
    const profile = new Profile();
    Object.keys(jsonProfile).forEach(key => {
      if (!(jsonProfile[key] instanceof Array)){
        profile[key] = jsonProfile[key];
      }
    });
    jsonProfile.variables.forEach(jsonVariable => {
      const profileVariable = new ProfileVariable();
      Object.keys(jsonVariable).forEach(key => {
        profileVariable[key] = jsonVariable[key];
      });
      profile.variables.push(profileVariable);
    });
    await addProfile(profile);
  }
}

/**
 * get data from local storage and store it into in-memory object
 * @returns {Promise<void>}
 */
const loadProfileData = async () => {
  let result = await browser.storage.local.get("profileData");
  if (result.profileData) {
    await mappingProfileData(result.profileData);
  }
  if ((await countProfile()) === 0){
    await addEmptyDefaultProfile();
  }
}

/**
 * persist in-memory object to local storage
 * @returns {Promise<void>}
 */
const saveProfileData = async () => {
  browser.storage.local.set({profileData});
}

export { loadProfileData, saveProfileData }