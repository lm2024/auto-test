import { generateUUID } from "../helper-service/utils.js";
import { findTestCaseById } from "../data-service/test-case-service.js";
import { generateExportedScript } from "./generate-exported-script.js";
import { findTestSuiteById } from "../data-service/test-suite-service.js";
import { parseData } from "../data-file-service/data-file-services.js";


async function generateMainGitignoreFile(zipFile){
  const contain = `.gradle

bin

Reports

Libs

output

!output/.gitkeep
build

.classpath

.project`;
  zipFile.file(".gitignore", contain);
}

async function generatePRJFile(zipFile, projectName){
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<Project>
   <description></description>
   <name>${projectName}</name>
   <tag></tag>
   <UUID>6becabf2-990e-48b7-badb-78be84fb2963</UUID>
   <migratedVersion>5.9.0</migratedVersion>
   <pageLoadTimeout>0</pageLoadTimeout>
   <sourceContent>
      <sourceFolderList>
         <sourceFolderConfiguration>
            <url>Include/scripts/groovy</url>
         </sourceFolderConfiguration>
      </sourceFolderList>
      <systemFolderList>
         <systemFolderConfiguration>
            <url>Include/scripts/groovy</url>
         </systemFolderConfiguration>
         <systemFolderConfiguration>
            <url>Include/features</url>
         </systemFolderConfiguration>
         <systemFolderConfiguration>
            <url>Include/config</url>
         </systemFolderConfiguration>
      </systemFolderList>
   </sourceContent>
   <type>WEBUI</type>
</Project>
`
  zipFile.file(`${projectName}.prj`, content);
}

async function generateBuildGradleFile(zipFile){
  zipFile.file("build.gradle", "plugins {\n" +
    "  id 'java'\n" +
    "  id \"com.katalon.gradle-plugin\" version \"0.0.7\"\n" +
    "}\n" +
    "\n" +
    "repositories {\n" +
    "  mavenCentral()\n" +
    "}\n" +
    "\n" +
    "dependencies {\n" +
    "  // sample dependencies\n" +
    "  // rest-assured\n" +
    "  // compile 'io.rest-assured:rest-assured:3.2.0'\n" +
    "  // JsonPath\n" +
    "  // compile 'io.rest-assured:json-path:3.2.0'\n" +
    "  // XmlPath\n" +
    "  // compile 'io.rest-assured:json-path:3.2.0'\n" +
    "  // JSON Schema Validation\n" +
    "  // compile 'io.rest-assured:json-schema-validator:3.2.0'\n" +
    "}");
}

async function generateConsolePropertiesFile(zipFile){
  zipFile.file("console.properties", "adoPlanID=\n" +
    "adoPlanId=\n" +
    "adoTestRunName=\n" +
    "deviceId=\n" +
    "kobitonDeviceId=\n" +
    "kobitonToken=\n" +
    "kobitonUserName=\n" +
    "qTestDestId=\n" +
    "qTestDestType=\n" +
    "remoteWebDriverType=Selenium\n" +
    "remoteWebDriverUrl=\n" +
    "testOpsBuildId=\n" +
    "testOpsProjectId=\n" +
    "testOpsReleaseId=\n");
}

async function generateIdeaFolder(zipFile){
  const idea = zipFile.folder(".idea");
  idea.file(".gitignore", "# Default ignored files\n" +
    "/shelf/\n" +
    "/workspace.xml\n" +
    "# Datasource local storage ignored files\n" +
    "/dataSources/\n" +
    "/dataSources.local.xml\n" +
    "# Editor-based HTTP Client requests\n" +
    "/httpRequests/\n");
  idea.file("gradle.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<project version=\"4\">\n" +
    "  <component name=\"GradleSettings\">\n" +
    "    <option name=\"linkedExternalProjectsSettings\">\n" +
    "      <GradleProjectSettings>\n" +
    "        <option name=\"distributionType\" value=\"DEFAULT_WRAPPED\" />\n" +
    "        <option name=\"externalProjectPath\" value=\"$PROJECT_DIR$\" />\n" +
    "        <option name=\"gradleHome\" value=\"/usr/local/Cellar/gradle/7.1/libexec\" />\n" +
    "        <option name=\"gradleJvm\" value=\"adopt-openj9-11\" />\n" +
    "        <option name=\"modules\">\n" +
    "          <set>\n" +
    "            <option value=\"$PROJECT_DIR$\" />\n" +
    "          </set>\n" +
    "        </option>\n" +
    "      </GradleProjectSettings>\n" +
    "    </option>\n" +
    "  </component>\n" +
    "</project>");
  idea.file("misc.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<project version=\"4\">\n" +
    "  <component name=\"ExternalStorageConfigurationManager\" enabled=\"true\" />\n" +
    "</project>");

  idea.file("runConfigurations.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<project version=\"4\">\n" +
    "  <component name=\"RunConfigurationProducerService\">\n" +
    "    <option name=\"ignoredProducers\">\n" +
    "      <set>\n" +
    "        <option value=\"com.android.tools.idea.compose.preview.runconfiguration.ComposePreviewRunConfigurationProducer\" />\n" +
    "      </set>\n" +
    "    </option>\n" +
    "  </component>\n" +
    "</project>");
  idea.file("workspace.xml","<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
    "<project version=\"4\">\n" +
    "  <component name=\"AutoImportSettings\">\n" +
    "    <option name=\"autoReloadType\" value=\"SELECTIVE\" />\n" +
    "  </component>\n" +
    "  <component name=\"ChangeListManager\">\n" +
    "    <list default=\"true\" id=\"2d78b8ec-7f84-462e-af7a-49b29e54989e\" name=\"Changes\" comment=\"\" />\n" +
    "    <option name=\"SHOW_DIALOG\" value=\"false\" />\n" +
    "    <option name=\"HIGHLIGHT_CONFLICTS\" value=\"true\" />\n" +
    "    <option name=\"HIGHLIGHT_NON_ACTIVE_CHANGELIST\" value=\"false\" />\n" +
    "    <option name=\"LAST_RESOLUTION\" value=\"IGNORE\" />\n" +
    "  </component>\n" +
    "  <component name=\"ExternalProjectsData\">\n" +
    "    <projectState path=\"$PROJECT_DIR$\">\n" +
    "      <ProjectState />\n" +
    "    </projectState>\n" +
    "  </component>\n" +
    "  <component name=\"ProjectId\" id=\"1xdQFiT8npAU8kh0BxRFLN3SdOQ\" />\n" +
    "  <component name=\"ProjectViewState\">\n" +
    "    <option name=\"hideEmptyMiddlePackages\" value=\"true\" />\n" +
    "    <option name=\"showLibraryContents\" value=\"true\" />\n" +
    "  </component>\n" +
    "  <component name=\"PropertiesComponent\">\n" +
    "    <property name=\"RunOnceActivity.OpenProjectViewOnStart\" value=\"true\" />\n" +
    "    <property name=\"RunOnceActivity.ShowReadmeOnStart\" value=\"true\" />\n" +
    "    <property name=\"WebServerToolWindowFactoryState\" value=\"false\" />\n" +
    "    <property name=\"last_opened_file_path\" value=\"$PROJECT_DIR$\" />\n" +
    "  </component>\n" +
    "  <component name=\"SpellCheckerSettings\" RuntimeDictionaries=\"0\" Folders=\"0\" CustomDictionaries=\"0\" DefaultDictionary=\"application-level\" UseSingleDictionary=\"true\" transferred=\"true\" />\n" +
    "  <component name=\"TaskManager\">\n" +
    "    <task active=\"true\" id=\"Default\" summary=\"Default task\">\n" +
    "      <changelist id=\"2d78b8ec-7f84-462e-af7a-49b29e54989e\" name=\"Changes\" comment=\"\" />\n" +
    "      <created>1630682387139</created>\n" +
    "      <option name=\"number\" value=\"Default\" />\n" +
    "      <option name=\"presentableId\" value=\"Default\" />\n" +
    "      <updated>1630682387139</updated>\n" +
    "      <workItem from=\"1630682389641\" duration=\"114000\" />\n" +
    "    </task>\n" +
    "    <servers />\n" +
    "  </component>\n" +
    "  <component name=\"TypeScriptGeneratedFilesManager\">\n" +
    "    <option name=\"version\" value=\"3\" />\n" +
    "  </component>\n" +
    "</project>");
}

async function generateCheckpoint(zipFile){
  zipFile.folder("Checkpoints");
}

async function generateTestListener(zipFile){
  zipFile.folder("Test Listeners");
}

async function generateDriverFolder(zipFile){
  zipFile.folder("Drivers");
}

async function generateDataFilesFolder(zipFile, userChoice){
  const dataFilesFolder = zipFile.folder("Data Files");
  for (const dataFile of userChoice.dataFiles) {
    const name = dataFile.name;
    const fileName = window.dataFiles[name].type === "json" ? name + ".csv" : name;
      dataFilesFolder.file(`${name}.dat`,`<?xml version="1.0" encoding="UTF-8"?>
<DataFileEntity>
   <description></description>
   <name>${name}</name>
   <tag></tag>
   <containsHeaders>true</containsHeaders>
   <csvSeperator>COMMA</csvSeperator>
   <dataFileGUID>${generateUUID()}</dataFileGUID>
   <dataSourceUrl>Include/csv/${fileName}</dataSourceUrl>
   <driver>CSV</driver>
   <isInternalPath>true</isInternalPath>
   <query></query>
   <secureUserAccount>false</secureUserAccount>
   <sheetName></sheetName>
   <usingGlobalDBSetting>false</usingGlobalDBSetting>
</DataFileEntity>
`);
  }
}

async function marshallDataToCSVFormat(data){
  if (data[0] === undefined){
    return "";
  }
  let result = "";
  const columnNames = Object.keys(data[0]);
  result += columnNames.join(",");
  for (const item of data){
    result += "\n" + Object.values(item).join(",");
  }
  return result;
}

async function generateIncludeFolder(zipFile, userChoice){
  const include = zipFile.folder("Include");

  const includeCSV = include.folder("csv");
  for (const userChoiceDataFile of userChoice.dataFiles) {
    const dataFile = window.dataFiles[userChoiceDataFile.name];
    if (dataFile.type === "csv") {
      includeCSV.file(userChoiceDataFile.name, dataFile.content);
    } else {
      if(dataFile.data === undefined){
        parseData(userChoiceDataFile.name);
      }
      const content = await marshallDataToCSVFormat(dataFile.data);
      includeCSV.file(userChoiceDataFile.name+".csv", content);
    }
  }

  const includeConfig = include.folder("config");
  includeConfig.file("log.properties", "# This file is used to configure Katalon Studio execution log levels.\n" +
    "\n" +
    "# When you need to troubleshoot Katalon Studio issue\n" +
    "# logging.level.com.kms=TRACE\n" +
    "\n" +
    "# logging.level.com.mycompany=DEBUG");

  include.folder("features");
  const includeScripts = include.folder("scripts");
  includeScripts.folder("groovy");
}

async function generateKeywordsFolder(zipFile){
  zipFile.folder("Keywords");
}

async function generateObjectRepositoryFolder(zipFile){
  zipFile.folder("Object Repository");
}

async function generatePluginsFolder(zipFile){
  zipFile.folder("Plugins");
}

async function generateProfilesFolder(zipFile, userChoice){
  const profileFolder = zipFile.folder("Profiles");
  //always add default profile
  profileFolder.file("default.glbl", `<?xml version="1.0" encoding="UTF-8"?>
<GlobalVariableEntities>
   <description></description>
   <name>default</name>
   <tag></tag>
   <defaultProfile>true</defaultProfile>
</GlobalVariableEntities>`)
}

async function generateReportsFolder(zipFile){
  const reports = zipFile.folder("Reports");
  const reportsSelfHealing = reports.folder("Self-healing");
  reportsSelfHealing.file("broken-test-objects.json", "{\n" +
    "  \"brokenTestObjects\" : [ ]\n" +
    "}");
}

async function generateScriptsFolder(zipFile, userChoice, testSuiteNames){
  const scriptFolder = zipFile.folder("Scripts");
  for (const userChoiceTestSuite of userChoice.testSuites){
    const testSuiteFolder = scriptFolder.folder(testSuiteNames[userChoiceTestSuite.id]);
    const testCases = userChoiceTestSuite.testCases
      .map(testCase => findTestCaseById(testCase.id));
    const testCaseNameMapping = await mappingTestCasesToNewName(testCases);
    for (const testCase of testCases){
      const testCaseName = testCaseNameMapping[testCase.id];
      testSuiteFolder.folder(testCaseName)
        .file(`Script${Date.now()}.groovy`, generateExportedScript(testCase));
    }
  }

}

async function generateTestCasesFolder(zipFile, userChoice, testSuiteNames){
  const testCasesFolder = zipFile.folder("Test Cases");
  for (const userChoiceTestSuite of userChoice.testSuites){
    const testSuiteFolder = testCasesFolder.folder(testSuiteNames[userChoiceTestSuite.id]);
    const testCases = userChoiceTestSuite.testCases
      .map(testCase => findTestCaseById(testCase.id));
    const testCaseNameMapping = await mappingTestCasesToNewName(testCases);
    for (const testCase of testCases){
      testSuiteFolder.file(`${testCaseNameMapping[testCase.id]}.tc`,`<?xml version="1.0" encoding="UTF-8"?>
<TestCaseEntity>
   <description></description>
   <name>${testCaseNameMapping[testCase.id]}</name>
   <tag></tag>
   <comment></comment>
   <testCaseGuid>${testCase.id}</testCaseGuid>
</TestCaseEntity>
`)
    }
  }
}

function generateTestCaseXML(testCaseName, testCaseID, testSuiteName){
  return `<testCaseLink>
      <guid>${testCaseID}</guid>
      <isReuseDriver>false</isReuseDriver>
      <isRun>true</isRun>
      <testCaseId>Test Cases/${testSuiteName}/${testCaseName}</testCaseId>
   </testCaseLink>`
}

async function generateTestSuitesFolder(zipFile, userChoice, testSuiteNames){
  const testSuitesFolder= zipFile.folder("Test Suites");
  for (const userChoiceTestSuite of userChoice.testSuites){
    const testCases = userChoiceTestSuite.testCases
      .map(testCase => findTestCaseById(testCase.id));
    const testCaseNameMapping = await mappingTestCasesToNewName(testCases);
    const testSuiteName = testSuiteNames[userChoiceTestSuite.id];
    const testCasesXML = userChoiceTestSuite.testCases.reduce((XMLString, testCase) => {
      XMLString += generateTestCaseXML(testCaseNameMapping[testCase.id], testCase.id, testSuiteName);
      return XMLString;
    }, "");
    const testSuiteFileContent = `<?xml version="1.0" encoding="UTF-8"?>
<TestSuiteEntity>
   <description></description>
   <name>${testSuiteNames[userChoiceTestSuite.id]}</name>
   <tag></tag>
   <isRerun>false</isRerun>
   <mailRecipient></mailRecipient>
   <numberOfRerun>3</numberOfRerun>
   <pageLoadTimeout>30</pageLoadTimeout>
   <pageLoadTimeoutDefault>true</pageLoadTimeoutDefault>
   <rerunFailedTestCasesOnly>false</rerunFailedTestCasesOnly>
   <rerunImmediately>true</rerunImmediately>
   <testSuiteGuid>${userChoiceTestSuite.id}</testSuiteGuid>
   ${testCasesXML}
</TestSuiteEntity>
    `;
    testSuitesFolder.file(`${testSuiteNames[userChoiceTestSuite.id]}.ts`, testSuiteFileContent);
    testSuitesFolder.file(`${testSuiteNames[userChoiceTestSuite.id]}.groovy`, `import static com.kms.katalon.core.checkpoint.CheckpointFactory.findCheckpoint
import static com.kms.katalon.core.testcase.TestCaseFactory.findTestCase
import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject

import com.kms.katalon.core.checkpoint.Checkpoint as Checkpoint
import com.kms.katalon.core.checkpoint.CheckpointFactory as CheckpointFactory
import com.kms.katalon.core.model.FailureHandling as FailureHandling
import com.kms.katalon.core.testcase.TestCase as TestCase
import com.kms.katalon.core.testcase.TestCaseFactory as TestCaseFactory
import com.kms.katalon.core.testdata.TestData as TestData
import com.kms.katalon.core.testdata.TestDataFactory as TestDataFactory
import com.kms.katalon.core.testobject.ObjectRepository as ObjectRepository
import com.kms.katalon.core.testobject.TestObject as TestObject

import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile

import internal.GlobalVariable as GlobalVariable

import com.kms.katalon.core.annotation.SetUp
import com.kms.katalon.core.annotation.SetupTestCase
import com.kms.katalon.core.annotation.TearDown
import com.kms.katalon.core.annotation.TearDownTestCase

/**
 * Some methods below are samples for using SetUp/TearDown in a test suite.
 */

/**
 * Setup test suite environment.
 */
@SetUp(skipped = true) // Please change skipped to be false to activate this method.
def setUp() {
\t// Put your code here.
}

/**
 * Clean test suites environment.
 */
@TearDown(skipped = true) // Please change skipped to be false to activate this method.
def tearDown() {
\t// Put your code here.
}

/**
 * Run before each test case starts.
 */
@SetupTestCase(skipped = true) // Please change skipped to be false to activate this method.
def setupTestCase() {
\t// Put your code here.
}

/**
 * Run after each test case ends.
 */
@TearDownTestCase(skipped = true) // Please change skipped to be false to activate this method.
def tearDownTestCase() {
\t// Put your code here.
}

/**
 * References:
 * Groovy tutorial page: http://docs.groovy-lang.org/next/html/documentation/
 */`);
  }
}

async function generateSettingsFolder(zipFile){
  const settings = zipFile.folder("settings");
  const settingsExternal = settings.folder("external");
  settingsExternal.file("com.kms.katalon.composer.execution.settings.properties","");
  settingsExternal.file("com.kms.katalon.core.db.DatabaseSettings.properties","");
  settingsExternal.file("com.kms.katalon.integration.azure.properties","");

  const settingsInternal = settings.folder("internal");
  settingsInternal.file("com.kms.katalon.composer.testcase.properties", "#Sat Sep 04 08:15:04 ICT 2021\n" +
    "testCaseTag=\"\"\n");
  settingsInternal.file("com.kms.katalon.execution.properties","");
  settingsInternal.file("com.kms.katalon.execution.webui.properties","#Fri Sep 03 22:12:19 ICT 2021\n" +
    "execution.default.selectingCapturedObjectSelectorMethod=\"XPATH\"\n");
  settingsInternal.file("com.kms.katalon.integration.analytics.properties", "#Fri Sep 03 22:12:56 ICT 2021\n" +
    "analytics.authentication.token=\"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\"\n");
  settingsInternal.file("com.kms.katalon.integration.qtest.properties","");
}

async function mappingTestCasesToNewName(testCases){
  const testCaseNames = new Map();


  const testCaseObj = {};
  for (const testCase of testCases){
    let testCaseName = testCase.name;
    const nameNum = testCaseNames.get(testCaseName)
    if (nameNum){
      testCaseNames.set(testCaseName, nameNum + 1)
      testCaseName += ` (${nameNum})`;
    } else {
      testCaseNames.set(testCaseName, 1);
    }
    testCaseObj[testCase.id] = testCaseName;
  }
  return testCaseObj;
}

async function mappingTestSuiteToNewName(testSuites){
  const testSuiteNames = new Map();
  const testSuiteObj = {};
  for (const testSuite of testSuites){
    let testSuiteName = testSuite.name;
    const nameNum = testSuiteNames.get(testSuiteName)
    if (nameNum){
      testSuiteNames.set(testSuiteName, nameNum + 1)
      testSuiteName += ` (${nameNum})`;
    } else {
      testSuiteNames.set(testSuiteName, 1);
    }
    testSuiteObj[testSuite.id] = testSuiteName;
  }
  return testSuiteObj;
}

const generateKatalonStudioProjectZipFile = async (userChoice, projectName) =>{
  const zipFile = new JSZip();
  await generateMainGitignoreFile(zipFile);
  await generatePRJFile(zipFile, projectName);
  await generateBuildGradleFile(zipFile);
  await generateConsolePropertiesFile(zipFile);
  await generateIdeaFolder(zipFile);
  await generateCheckpoint(zipFile);
  await generateTestListener(zipFile);
  await generateDriverFolder(zipFile);
  await generateDataFilesFolder(zipFile, userChoice);
  await generateIncludeFolder(zipFile, userChoice)
  await generateKeywordsFolder(zipFile);
  await generateObjectRepositoryFolder(zipFile);
  await generatePluginsFolder(zipFile);
  await generateProfilesFolder(zipFile, userChoice);
  await generateReportsFolder(zipFile);
  await generateSettingsFolder(zipFile);

  const testSuites = userChoice.testSuites.map(testSuite => findTestSuiteById(testSuite.id));
  const testSuiteNameMapping = await mappingTestSuiteToNewName(testSuites);

  await generateScriptsFolder(zipFile, userChoice, testSuiteNameMapping);
  await generateTestCasesFolder(zipFile, userChoice, testSuiteNameMapping);
  await generateTestSuitesFolder(zipFile, userChoice, testSuiteNameMapping);

  return zipFile;
}

export { generateKatalonStudioProjectZipFile }