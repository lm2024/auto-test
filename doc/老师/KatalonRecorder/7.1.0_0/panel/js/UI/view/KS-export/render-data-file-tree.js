async function dataTitleClickHandler(event){
  event.stopPropagation();
  $("#export-to-KS-test-case-preview-panel").css("display", "none");
  $("#export-to-KS-test-case-preview-other").css("display", "block");
}

async function userChooseDataFileHandler(event, userChoice){
  event.stopPropagation();
  const dataFileName = event.target.nextElementSibling.innerHTML
  if (event.target.checked) {
    await userChoice.addNewDataFile(dataFileName);
  } else {
    await userChoice.removeDataFile(dataFileName);
  }
}


/*
<div id="data-2">
    <input type="checkbox">
    <div>Basic automation</div>
</div>
 */
const renderDataFileTree = async (userChoice) => {
  const dataFileTreeContainer = document.getElementById("export-to-KS-data-list");
  for (const dataFileName of Object.keys(window.dataFiles)) {
    const div = document.createElement("div");
    dataFileTreeContainer.appendChild(div);
    div.classList.add("export-item");
    div.addEventListener("click", dataTitleClickHandler);

    const input = document.createElement("input");
    input.setAttribute("type", "checkbox");
    input.addEventListener("click", function(event){userChooseDataFileHandler(event, userChoice)});
    div.appendChild(input);

    const title = document.createElement("div");
    title.innerHTML = dataFileName;
    div.appendChild(title);
  }
}

export { renderDataFileTree }