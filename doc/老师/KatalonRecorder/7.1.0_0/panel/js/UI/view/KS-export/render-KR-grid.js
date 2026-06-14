const renderKRGrid = async (testCase) => {
  const sampleRecordGrid = $("#export-to-KS-records-grid");
  $(sampleRecordGrid).empty();
  for (const testCommand of testCase.commands) {
    let row = document.createElement("tr");
    if (window.unsupportedCommands.includes(testCommand.name)) {
      row.classList.add("unsupported");
    }
    let command = document.createElement("td");
    command.innerHTML = testCommand.name;
    let target = document.createElement("td");
    target.innerHTML = testCommand.defaultTarget;
    let value = document.createElement("td");
    value.innerHTML = testCommand.value;
    row.appendChild(command);
    row.appendChild(target);
    row.appendChild(value);
    $(sampleRecordGrid).append(row);
  }
}

export { renderKRGrid }