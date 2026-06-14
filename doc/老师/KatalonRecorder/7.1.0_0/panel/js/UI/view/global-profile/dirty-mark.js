/**
 * add * to the end of the profile title on the left side panel
 * @param {string} profileID - a UUID string
 */
const addDirtyMark = (profileID) => {
  document.getElementById(profileID).classList.add("modified");
}

/**
 * remove * to the end of the profile title on the left side panel
 * @param {string} profileID - a UUID string
 */
const removeDirtyMark = (profileID) => {
  document.getElementById(profileID).classList.remove("modified");
}

export { addDirtyMark, removeDirtyMark }
