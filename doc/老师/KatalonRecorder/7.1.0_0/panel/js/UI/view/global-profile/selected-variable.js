const getSelectedVariable = () => {
  const profileGridElement = document.getElementById("profile-grid");
  const selectedVariable = profileGridElement.getElementsByClassName("selected");
  if (selectedVariable) {
    return selectedVariable[0];
  } else {
    return null;
  }
}

const getSelectedVariables = () => {
  const profileGridElement = document.getElementById("profile-grid");
  return profileGridElement.getElementsByClassName("selected");
}

const setSelectedVariable = (index) => {
  $("#profile-grid .selected").removeClass("selected");
  $("#profile-grid").children()[index].classList.add("selected");
}

export { getSelectedVariable, setSelectedVariable, getSelectedVariables }