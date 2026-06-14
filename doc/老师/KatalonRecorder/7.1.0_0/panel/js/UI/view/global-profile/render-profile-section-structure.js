/*
<div id="profile-variable-container">
  <table id="profile-variable-grid" className="tablesorter" cellSpacing="0">
    <thead className="fixed">
    <tr>
      <th style="width: 23%">No</th>
      <th style="width: 52%">Name</th>
      <th style="width: 25%">Default value</th>
    </tr>
    </thead>
    <tbody id="profile-grid">

    </tbody>
  </table>
</div>
<div id="profile-toolbar">
  <div id="profile-toolbar-buttons">
    <button id="profile-add-btn"></button>
    <button id="profile-delete-btn"></button>

  </div>
  <div class="fieldset">
    <div class="input-row">
      <label>Command</label>
      <div>
        <input id="profile-variable-name" type="text"/>
      </div>
    </div>
    <div class="input-row">
      <label>Target</label>
      <div>
        <input id="profile-variable-value" type="text"/>
      </div>
    </div>
  </div>
</div>*/
function generateProfileVariableContainer() {
  const profileVariableContainer = document.createElement("div");
  profileVariableContainer.id = "profile-variable-container";

  const profileVariableTable = document.createElement("table");
  profileVariableTable.id = "profile-variable-grid";
  profileVariableTable.classList.add("tablesorter");
  profileVariableTable.setAttribute("cellSpacing", "0");
  profileVariableContainer.appendChild(profileVariableTable);

  const tableHead = document.createElement("thead");
  tableHead.classList.add("fixed");
  profileVariableTable.appendChild(tableHead);

  const headerRow = document.createElement("tr");
  tableHead.appendChild(headerRow);

  const nameColumn = document.createElement("th");
  nameColumn.style.width = "50%";
  nameColumn.innerHTML = "Name";
  headerRow.appendChild(nameColumn);

  const valueColumn = document.createElement("th");
  valueColumn.style.width = "50%";
  valueColumn.innerHTML = "Default value";
  headerRow.appendChild(valueColumn);

  const tableBody = document.createElement("tbody");
  tableBody.id = "profile-grid";
  profileVariableTable.appendChild(tableBody);

  return profileVariableContainer;
}

function generateInputBlock(inputLabel, inputID){
  const container = document.createElement("div");
  container.classList.add("input-row");

  const label = document.createElement("label");
  label.innerHTML = inputLabel;
  container.appendChild(label);

  const inputContainer = document.createElement("div");
  container.appendChild(inputContainer);

  const input = document.createElement("input");
  input.setAttribute("type", "text");
  input.id = inputID;
  inputContainer.appendChild(input);

  return container;
}

function generateProfileFieldSet() {
  const fieldset = document.createElement("div");
  fieldset.classList.add("fieldset");

  const nameInputBlock = generateInputBlock("Name", "profile-variable-name");
  fieldset.appendChild(nameInputBlock);
  const valueInputBlock = generateInputBlock("Default Value", "profile-variable-value");
  fieldset.appendChild(valueInputBlock);

  return fieldset;
}

function generateProfileToolBar() {
  const profileToolBar = document.createElement("div");
  profileToolBar.id = "profile-toolbar";

  const profileToolBarButtons = document.createElement("div");
  profileToolBarButtons.id = "profile-toolbar-buttons";
  profileToolBar.appendChild(profileToolBarButtons);

  const addProfileButton = document.createElement("button");
  addProfileButton.id = "variable-add-btn";
  addProfileButton.title = "Add new variable";
  profileToolBarButtons.appendChild(addProfileButton);

  const deleteProfileButton = document.createElement("button");
  deleteProfileButton.id = "variable-delete-btn";
  deleteProfileButton.title = "Delete selected variable";
  profileToolBarButtons.appendChild(deleteProfileButton);

  const copyVariableButton = document.createElement("button");
  copyVariableButton.id = "variable-copy-btn";
  copyVariableButton.title = "Copy selected variable";
  profileToolBarButtons.appendChild(copyVariableButton);

  const pasteVariableButton = document.createElement("button");
  pasteVariableButton.id = "variable-paste-btn";
  pasteVariableButton.title = "Paste copied variable";
  profileToolBarButtons.appendChild(pasteVariableButton);

  const profileFieldset = generateProfileFieldSet();
  profileToolBar.appendChild(profileFieldset);

  return profileToolBar;

}

function generateTitleSection(){
  const title = document.createElement("div");
  title.id = "profileTitle"
  title.innerHTML = "Tien";
  return title;

}

const renderProfileSectionStructure = async () => {
  const profileVariableContainer = generateProfileVariableContainer();
  const profileToolBar = generateProfileToolBar();

  const profileSection = document.getElementById("profile-section");
  profileSection.appendChild(profileVariableContainer);
  profileSection.appendChild(profileToolBar);

  const command_section = document.getElementsByClassName("command-sample-section")[0];
  command_section.insertBefore(generateTitleSection(), command_section.firstChild);
}

export { renderProfileSectionStructure }
