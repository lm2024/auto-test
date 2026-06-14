const getVariablesArray = async () => {
  return document.getElementById("profile-grid").getElementsByTagName("tr");
}

export { getVariablesArray }