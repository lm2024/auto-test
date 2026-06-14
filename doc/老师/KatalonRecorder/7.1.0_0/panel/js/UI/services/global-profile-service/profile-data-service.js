import { Profile } from "../../models/global-profile/profile.js";
import { ProfileVariable } from "../../models/global-profile/profile-variable.js";

/**
 * add a Profile to in-memory object
 * @param {Profile} profile
 * @returns {Promise<void>}
 */
const addProfile = async (profile) => {
  if (profile === undefined || profile === null) {
    throw new Error("Null or undefined profile");
  }
  if (profile.isDefault) {
    let currentDefaultProfile;
    try {
      currentDefaultProfile = await getDefaultProfile(true);
    } catch (e) {}
    if (currentDefaultProfile) {
      throw new Error("Cannot have 2 default profiles");
    }
  }
  profileData.profiles.push(profile);
}

/**
 * return all Profile objects
 * @returns {Promise<Profile[]>}
 */
const getAllProfile = async () => {
  return profileData.profiles;
}

/**
 * find a Profile object by ID
 * @param {String} profileID - an UUID representing Profile ID
 * @returns {Promise<Profile>}
 */
const findProfileByID = async (profileID) => {
  return profileData.profiles.find(profile => profile.id === profileID);
}

/**
 * deep clone a Profile object
 * @param {Profile} profile
 * @returns {Promise<Profile>}
 */
const duplicateProfile = async (profile) => {
  if (profile === undefined || profile === null) {
    throw new Error("Null or undefined profile");
  }
  const newProfile = new Profile();
  newProfile.title = profile.title;
  newProfile.isDefault = false;
  newProfile.variables = profile.variables.map(variable => new ProfileVariable(variable.name, variable.value));
  return newProfile;
}

/**
 * set a new default profile
 * @param {string} profileID - an UUID representing Profile ID
 * @returns {Promise<void>}
 */
const setDefaultProfile = async (profileID) => {
  const oldDefaultProfile = await getDefaultProfile(true);
  const newDefaultProfile = await findProfileByID(profileID);
  if (newDefaultProfile) {
    oldDefaultProfile.isDefault = false;
    newDefaultProfile.isDefault = true;
  }
}

/**
 * remove a Profile from in-memory object
 * @param {string} profileID - an UUID representing Profile ID
 * @returns {Promise<Profile>}
 */
const removeProfile = async (profileID) => {

  for (let i = 0; i < profileData.profiles.length; i++) {
    const profile = profileData.profiles[i];
    if (profile.id === profileID) {
      if (profile.isDefault) {
        throw new Error("Cannot delete a default profile");
      }
      return profileData.profiles.splice(i, 1)[0];
    }
  }
}

/**
 * create a new profile
 * if the title is not provided, the default value will be "Untitled Profile"
 * @param {string} [title="Untitled Profile"] - profile's title
 * @returns {Promise<Profile>}
 */
const createNewProfile = async (title = "Untitled Profile") => {
  title = title !== null ? title : "Untitled Profile";
  const profile = new Profile();
  profile.title = title;
  profileData.profiles.push(profile);
  return profile;
}

/**
 * get the current default profile
 * @returns {Promise<Profile>}
 */
const getDefaultProfile = async (flag = false) => {
  /*** 
   * flag == true: adding new profiles, NOT REQUIRED
   * to have an existing one 
   * flag == false: get Default profiles to link to a
   * test case's value field, REQUIRED to have one
   * => flag is off, have to wait for Global Profiles
   * to be existed
  ***/
  if (!flag && !profileData.profiles[0]) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const defaultProfile = profileData.profiles.find(profile => profile.isDefault);
  if (defaultProfile === undefined) {
    throw new Error("Undefined default profile");
  }
  return defaultProfile;
}

/**
 * get the total numbers of profiles in in-memory object
 * @returns {Promise<number>}
 */
const countProfile = async () => {
  return profileData.profiles.length;
}

/**
 * add an empty Profile and make it the default profile
 * this profile will be named "Default Profile"
 * @returns {Promise<Profile>}
 */
const addEmptyDefaultProfile = async () => {
  try{
    const oldDefaultProfile = await getDefaultProfile();
    oldDefaultProfile.isDefault = false;
  } catch (e){
  } finally {
    const defaultProfile = await createNewProfile("Default Profile");
    defaultProfile.isDefault = true;
    return defaultProfile;
  }

}


export {
  addProfile,
  getAllProfile,
  findProfileByID,
  duplicateProfile,
  setDefaultProfile,
  removeProfile,
  createNewProfile,
  getDefaultProfile,
  countProfile,
  addEmptyDefaultProfile
}