import { findTestCaseById } from "./test-case-service.js";

const setTestCommandStatus = (testCaseID, commandIndex, state) => {
  const testCase = findTestCaseById(testCaseID);
  if (commandIndex >= testCase.commands.length){
    return;
  }
  testCase.commands[commandIndex].status = state;
}

export { setTestCommandStatus }