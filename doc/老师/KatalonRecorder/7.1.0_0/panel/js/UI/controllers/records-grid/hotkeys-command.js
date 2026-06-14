import {
  generateAddCommand,
  generateCopyCommand,
  generateDeleteSelectedCommand,
  generatePasteCommand,
  generateRedoCommand,
  generateSelectAllCommand,
  generateSetBreakpointCommand,
  generateUndoCommand,
} from "../../services/records-grid-service/command-generators.js";
import { getSelectedRecords } from "../../view/records-grid/selected-records.js";
import { getSelectedCase } from "../../view/testcase-grid/selected-case.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";

import { loadToolbarForTeststep } from "../../view/records-grid/attach-event.js";

let isOnCommandContainer = false;
let isOnCommandToolBar = false;

function stopNativeEvent(event) {
  // NOTE: lock the browser default shortcuts
  // and this should be careful
  event.preventDefault();
  event.stopPropagation();
}

function pressArrowKey(direction, shiftKey, ctrlKey) {
  $(".toolbar-btn").hide();
  let selectedRecords = getSelectedRecords();
  if (selectedRecords.length === 0) {
    return;
  }

  const selectedTestCase = getSelectedCase();
  const testCaseID = selectedTestCase.id;
  const testCase = findTestCaseById(testCaseID);

  if (direction === 38) {
    // press up arrow
    pressArrowKeyUp(selectedRecords, shiftKey, ctrlKey);
  } else if (direction === 40) {
    // press down arrow
    pressArrowKeyDown(testCase, selectedRecords, shiftKey, ctrlKey);
  }
}

function pressArrowKeyUp(selectedRecords, shiftKey, ctrlKey) {
  let firstRecordId = selectedRecords[0].id;
  let lastRecordId = selectedRecords[selectedRecords.length - 1].id;
  let lastRecordNum = parseInt(lastRecordId.substring(firstRecordId.indexOf("-") + 1));
  let recordNum = parseInt(firstRecordId.substring(firstRecordId.indexOf("-") + 1));

  if (shiftKey) {
    // const listRows = $("#records-grid .selectedRecord");
    // let startElement;
    // if (listRows.length === 1) {
    //     listRows.removeClass('startElement');
    //     startElement = listRows[0];
    //     $(startElement).addClass('startElement');
    // }

    if (selectedRecords.length === 1) {
      $("#records-grid .startElement").removeClass("startElement");
      $(selectedRecords[0]).addClass("startElement");
    }

    if (ctrlKey) {
      $("#records-grid .selectedRecord").removeClass("selectedRecord");
      let endRecordElement = recordNum;
      for (let index = 1; index <= endRecordElement; index++) {
        const recordElement = $("#records-" + index)[0];
        $(recordElement).addClass("selectedRecord");
        loadToolbarForTeststep(recordElement);
        recordElement.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "center",
        });
      }
    } else {
      let recordElement;
      if ($(selectedRecords[selectedRecords.length - 1]).hasClass("startElement")) {
        recordElement = $("#records-" + (recordNum - 1))[0];
        $(recordElement).addClass("selectedRecord");
      } else {
        recordElement = $("#records-" + lastRecordNum)[0];
        $(recordElement).removeClass("selectedRecord");
      }
      // if (recordNum === 1) {
      //     recordElement = $("#records-1")[0];
      // } else {
      //     recordElement = $("#records-" + (recordNum - 1))[0];
      // }
      // $(recordElement).addClass("selectedRecord");
      loadToolbarForTeststep(recordElement);
      recordElement.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "center",
      });
    }
  } else {
    $("#records-grid .selectedRecord").removeClass("selectedRecord");
    let recordElement;
    if (recordNum === 1) {
      recordElement = $("#records-1")[0];
    } else {
      recordElement = $("#records-" + (recordNum - 1))[0];
    }
    $(recordElement).addClass("selectedRecord").children(":first").click();
    recordElement.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "center",
    });
  }
}

function pressArrowKeyDown(testCase, selectedRecords, shiftKey, ctrlKey) {
  let firstRecordId = selectedRecords[0].id;
  let lastRecordId = selectedRecords[selectedRecords.length - 1].id;
  let firstRecordNum = parseInt(firstRecordId.substring(firstRecordId.indexOf("-") + 1));
  let recordNum = parseInt(lastRecordId.substring(lastRecordId.indexOf("-") + 1));

  if (shiftKey) {
    if (selectedRecords.length === 1) {
      $("#records-grid .startElement").removeClass("startElement");
      $(selectedRecords[0]).addClass("startElement");
    }
    if (ctrlKey) {
      $("#records-grid .selectedRecord").removeClass("selectedRecord");
      let endRecordElement = testCase.getTestCommandCount();
      for (let index = recordNum; index <= endRecordElement; index++) {
        const recordElement = $("#records-" + index)[0];
        $(recordElement).addClass("selectedRecord");
        loadToolbarForTeststep(recordElement);
        recordElement.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "center",
        });
      }
    } else {
      let recordElement;
      // if (recordNum === testCase.getTestCommandCount()) {
      //     recordElement = $("#records-" + recordNum)[0];
      // } else {
      //     recordElement = $("#records-" + (recordNum + 1))[0]
      // }

      if ($(selectedRecords[0]).hasClass("startElement")) {
        recordElement = $("#records-" + (recordNum + 1))[0];
        $(recordElement).addClass("selectedRecord");
      } else {
        recordElement = $("#records-" + firstRecordNum)[0];
        $(recordElement).removeClass("selectedRecord");
      }

      loadToolbarForTeststep(recordElement);
      recordElement.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "center",
      });
    }
  } else {
    $("#records-grid .selectedRecord").removeClass("selectedRecord");
    let recordElement;
    if (recordNum === testCase.getTestCommandCount()) {
      recordElement = $("#records-" + recordNum)[0];
    } else {
      recordElement = $("#records-" + (recordNum + 1))[0];
    }
    $(recordElement).addClass("selectedRecord").children(":first").click();
    recordElement.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "center",
    });
  }
}

function navigateBetweenCell(commandCell, targetCell, valueCell, backward = false) {
  let previousCell, nextCell;
  let record = $(".selectedTd").parent();
  let currentRecord = Number($(record).attr("id").match(/\d+/)[0]);
  let numOfRecords = Number($("#records-count").attr("value"));

  if (commandCell > 0) {
    /*** NAVIGATE FORWARD ***/
    nextCell = record.children()[2];
    if (!backward) return $(nextCell).trigger("click");

    /*** NAVIGATE BACKWARD ***/
    // Check if the current record is
    // the FIRST record of a test case
    if (currentRecord === 1) return;
    previousCell = $(`#records-${currentRecord - 1}`).children()[3];
    return $(previousCell).trigger("click");
  }

  if (targetCell > 0) {
    /*** NAVIGATE BACKWARD ***/
    previousCell = record.children()[1];
    if (backward) return $(previousCell).trigger("click");

    /*** NAVIGATE FORWARD ***/
    nextCell = record.children()[3];
    return $(nextCell).trigger("click");
  }

  if (valueCell > 0) {
    /*** NAVIGATE BACKWARD ***/
    previousCell = record.children()[2];
    if (backward) return $(previousCell).trigger("click");

    /*** NAVIGATE FORWARD ***/
    // Check if the current record is
    // the LAST record of a test case
    if (currentRecord >= numOfRecords) return;
    nextCell = $(`#records-${currentRecord + 1}`).children()[1];
    return $(nextCell).trigger("click");
  }
}

// document.getElementById("command-toolbar").addEventListener("click", function(event) {
//     isOnCommandContainer = false;
// })

document.addEventListener("click", function (event) {
  const commandContainerElement = document.getElementById("command-container");
  // const commandToolbarElement = document.getElementById("command-toolbar");
  isOnCommandContainer = commandContainerElement.contains(event.target);
  // isOnCommandToolBar = commandToolbarElement.contains(event.target);
});

// Hot key setting
document.addEventListener("keydown", function (event) {
  let keyNum;
  if (window.event) {
    // IE
    keyNum = event.keyCode;
  } else if (event.which) {
    // Netscape/Firefox/Opera
    keyNum = event.which;
  }

  let commandCell = $("#records-grid").find("#command-command").length;
  let targetCell = $("#records-grid").find("#command-target").length;
  let valueCell = $("#records-grid").find("#command-value").length;

  // Hot keys: Ctrl + [KEY] or Command + [KEY]
  if (event.ctrlKey || event.metaKey) {
    // Users should not be allowed to refresh the app,
    // as it will re-inject content scripts and cause weird behaviors
    if (keyNum === 82) {
      stopNativeEvent(event);
      return;
    }

    if (!isOnCommandContainer) {
      // if (isOnCommandToolBar) {
      // allow Undo Redo on command toolbar
      switch (keyNum) {
        case 90: //Ctrl + Z
          stopNativeEvent(event);
          let undoCommand = generateUndoCommand();
          undoCommand.execute();
          break;
        case 89: //Ctrl + Y
          stopNativeEvent(event);
          let redoCommand = generateRedoCommand();
          redoCommand.execute();
          break;
      }
      // }
      return;
    }

    if (commandCell == 0 && targetCell == 0 && valueCell == 0) {
      stopNativeEvent(event);
      let copyCommand;
      switch (keyNum) {
        case 65: // Ctrl + A
          let selectAllCommand = generateSelectAllCommand();
          selectAllCommand.execute();
          break;
        case 66: // Ctrl + B
          let setBreakpointCommand = generateSetBreakpointCommand();
          setBreakpointCommand.execute();
          break;
        case 67: // Ctrl + C
          copyCommand = generateCopyCommand();
          copyCommand.execute();
          break;
        case 73: // Ctrl + I
          let addCommand = generateAddCommand();
          addCommand.execute();
          break;
        case 86: // Ctrl + V
          let pasteCommand = generatePasteCommand();
          pasteCommand.execute();
          break;
        case 88: // Ctrl + X
          copyCommand = generateCopyCommand();
          copyCommand.execute();
          let deleteSelectedCommand = generateDeleteSelectedCommand();
          deleteSelectedCommand.execute();
          break;
        case 90: //Ctrl + Z
          let undoCommand = generateUndoCommand();
          undoCommand.execute();
          break;
        case 89: //Ctrl + Y
          let redoCommand = generateRedoCommand();
          redoCommand.execute();
          break;
        default:
          break;
      }
    }
  } else if (keyNum === 9) { // Tab
    if (!isOnCommandContainer) return;
    stopNativeEvent(event);

    // If Shift + Tab, then navigate backward
    // else, navigate forward
    navigateBetweenCell(commandCell, targetCell, valueCell, event.shiftKey);
  }
});

//Hot key setting for up and down key
document.addEventListener("keydown", function (event) {
  let keyNum;
  if (window.event) {
    // IE
    keyNum = event.keyCode;
  } else if (event.which) {
    // Netscape/Firefox/Opera
    keyNum = event.which;
  }

  if (
    $("#records-grid").find(".selectedRecord").length > 0 &&
    $(".command-section").is(":visible")
  ) {
    if (
      !$("#records-grid").find(".target-dropdown").is(":visible") &&
      $("#records-grid").find("#command-command").length == 0 &&
      $("#records-grid").find("#command-target").length == 0 &&
      $("#records-grid").find("#command-value").length == 0
    ) {
      stopNativeEvent(event);
      switch (keyNum) {
        case 38: // up arrow
          pressArrowKey(38, event.shiftKey, event.ctrlKey);
          break;
        case 9: // tab
        case 40: // down arrow
          pressArrowKey(40, event.shiftKey, event.ctrlKey);
          break;
        /* KAT-BEGIN remove hot key
        case 46: // del
          let selectedTr = getSelectedRecords();
          for (let i=selectedTr.length-1 ; i>=0 ; i--) {
            deleteCommand(selectedTr[i].id);
          }
          break; */
        default:
          break;
      }
    }
  }
});
