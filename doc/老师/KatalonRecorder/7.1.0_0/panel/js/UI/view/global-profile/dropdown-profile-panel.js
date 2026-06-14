/**
 * open profile dropdown
 */
const openProfileList = () => {
  const image = $("#profileDropdown").find("img");
  $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
  $("#profile-list").css("display", "flex");
}

/**
 *  close profile dropdown
 */
const closeProfileList = () => {
  const image = $("#profileDropdown").find("img");
  $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
  $("#profile-list").css("display", "none");
}

export { openProfileList, closeProfileList }