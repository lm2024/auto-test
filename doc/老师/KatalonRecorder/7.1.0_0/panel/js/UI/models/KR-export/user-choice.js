class DataFile {
  constructor(name) {
    this.name = name;
  }
}

class TestCase {
  constructor(id) {
    this.id = id;
    this.hasUnsupportedCommand = false;
  }
}

class TestSuite {
  constructor(id, testCases = []) {
    this.id = id;
    this.testCases = testCases;
  }
}

class Profile {
  constructor(id) {
    this.id = id;
  }
}


class UserChoice {
  constructor() {
    this.dataFiles = [];
    this.testSuites = [];
    this.profiles = [];
  }

  async reset() {
    this.dataFiles = [];
    this.testSuites = [];
    this.profiles = [];
  }

  async addNewProfile(profileID) {
    const newProfile = new Profile(profileID);
    const index = this.profiles.findIndex(profile => profile.id === profileID);
    if (index === -1) {
      this.profiles.push(newProfile);
    } else {
      this.profiles.splice(index, 1, newProfile);
    }
    return newProfile;
  }

  async removeProfile(profileID) {
    const index = this.profiles.findIndex(profile => profile.id === profileID);
    return this.profiles.splice(index, 1)[0];
  }

  async addNewDataFile(name) {
    const newDataFile = new DataFile(name);
    const index = this.dataFiles.findIndex(dataFile => dataFile.name === name);
    if (index === -1) {
      this.dataFiles.push(newDataFile);
    } else {
      this.dataFiles.splice(index, 1, newDataFile);
    }
    return newDataFile;
  }

  async removeDataFile(name) {
    const index = this.dataFiles.findIndex(dataFile => dataFile.name === name);
    return this.dataFiles.splice(index, 1)[0];
  }

  async addNewTestSuite(testSuiteID) {
    const index = this.testSuites.findIndex(suite => suite.id === testSuiteID);
    if (index !== -1) return;
    const newTestSuite = new TestSuite(testSuiteID);
    this.testSuites.push(newTestSuite);
    return newTestSuite;
  }

  async removeTestSuite(testSuiteID) {
    const index = this.testSuites.findIndex(suite => suite.id === testSuiteID)
    if (index === -1) return;
    this.testSuites.splice(index, 1);
  }

  async addNewTestCase(testSuiteID, testCaseID) {
    let testSuite = this.testSuites.find(testSuite => testSuite.id === testSuiteID);

    if (testSuite === undefined) {
      testSuite = await this.addNewTestSuite(testSuiteID);
    }
    const testCase = new TestCase(testCaseID);
    testSuite.testCases.push(testCase);
    return testCase;
  }

  async removeTestCase(testCaseID) {
    let testCase;
    let testSuite;
    for (const userChoiceTestSuite of this.testSuites) {
      testCase = userChoiceTestSuite.testCases.find(testCase => testCase.id === testCaseID);
      if (testCase) {
        testSuite = userChoiceTestSuite;
        break;
      }
    }
    const index = testSuite.testCases.findIndex(testCase => testCase.id === testCaseID);
    testSuite.testCases.splice(index, 1);
    if (testSuite.testCases.length === 0) {
      await this.removeTestSuite(testSuite.id);
    }
    return testCase;
  }

  async checkTestCasesHasUnsupportedCommands() {
    return this.testSuites
      .map(testSuite => testSuite.testCases)
      .reduce((prev, current) => {
        prev.push(...current);
        return prev;
      }, [])
      .some(testCase => testCase.hasUnsupportedCommand);
  }

  async findTestSuiteById(testSuiteID) {
    return this.testSuites.find(testSuite => testSuite.id === testSuiteID);
  }

  async getNumUnsupportedTestCase(){
    let count = 0;
    this.testSuites.map(testSuite => testSuite.testCases)
      .reduce((prev, testCases) => {prev.push(...testCases); return prev;}, [])
      .forEach(testCase => {if (testCase.hasUnsupportedCommand) count++});
    return count;
  }

  async getTestCaseCount(){
    let count = 0;
    this.testSuites.map(testSuite => testSuite.testCases)
      .forEach(testCases => count+= testCases.length);
    return count;
  }

  async getTestCaseById(testCaseId){
    for (let testSuite of this.testSuites){
      for (let testCase of testSuite.testCases){
        if (testCase.id === testCaseId){
          return testCase;
        }
      }
    }
    return null;
  }

  async getAllTestCases(){
    const result = [];
    this.testSuites.forEach(testSuite => result.push(...testSuite.testCases));
    return result;
  }

}

export { UserChoice }