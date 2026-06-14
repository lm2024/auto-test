const getSelectedRecords = () => {
  const selectedNode = document.getElementById("records-grid").getElementsByClassName("selectedRecord");
  if (selectedNode.length) {
    return selectedNode;
  } else {
    return "";
  }
}

function getSelectedRecord() {
  var selectedNode = document.getElementById("records-grid")
    .getElementsByClassName("selectedRecord");
  if (selectedNode.length) {
    return selectedNode[0].id;
  } else {
    return "";
  }
}

const getSelectedEmptyRecords = () => {
  const selectedNode = document.getElementById("records-grid").getElementsByClassName("selectedRecord");

  if (selectedNode.length && $.trim($(selectedNode).find('td:not(:first-child)').find('div:not([class])').text()) == '') {
    return selectedNode;
  } else {
    return "";
  }
}

export { getSelectedRecords, getSelectedRecord, getSelectedEmptyRecords }