import {findTestCaseById} from "../data-service/test-case-service.js";
import {generateExportedScript} from "./generate-exported-script.js";
import {findTestSuiteById} from "../data-service/test-suite-service.js";

async function generatePomFile(zipFile, projectTitle) {
    const contain = `<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.example</groupId>
  <artifactId>${projectTitle}</artifactId>
  <version>1.0-SNAPSHOT</version>

  <name>KR-to-Java-JUnit</name>

  <properties>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <maven.compiler.source>1.7</maven.compiler.source>
    <maven.compiler.target>1.7</maven.compiler.target>
  </properties>

  <dependencies>
    <!-- https://mvnrepository.com/artifact/org.testng/testng -->
    <dependency>
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <version>6.14.3</version>
      <scope>test</scope>
    </dependency>
    <!-- https://mvnrepository.com/artifact/org.seleniumhq.selenium/selenium-java -->
    <dependency>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>selenium-java</artifactId>
      <version>3.141.59</version>
    </dependency>
    <!-- https://mvnrepository.com/artifact/commons-io/commons-io -->
    <dependency>
      <groupId>commons-io</groupId>
      <artifactId>commons-io</artifactId>
      <version>2.4</version>
    </dependency>
  </dependencies>

  <build>
    <pluginManagement><!-- lock down plugins versions to avoid using Maven defaults (may be moved to parent pom) -->
      <plugins>
        <!-- clean lifecycle, see https://maven.apache.org/ref/current/maven-core/lifecycles.html#clean_Lifecycle -->
        <plugin>
          <artifactId>maven-clean-plugin</artifactId>
          <version>3.1.0</version>
        </plugin>
        <!-- default lifecycle, jar packaging: see https://maven.apache.org/ref/current/maven-core/default-bindings.html#Plugin_bindings_for_jar_packaging -->
        <plugin>
          <artifactId>maven-resources-plugin</artifactId>
          <version>3.0.2</version>
        </plugin>
        <plugin>
          <artifactId>maven-compiler-plugin</artifactId>
          <version>3.8.0</version>
        </plugin>
        <plugin>
          <artifactId>maven-surefire-plugin</artifactId>
          <version>2.22.1</version>
        </plugin>
        <plugin>
          <artifactId>maven-jar-plugin</artifactId>
          <version>3.0.2</version>
        </plugin>
        <plugin>
          <artifactId>maven-install-plugin</artifactId>
          <version>2.5.2</version>
        </plugin>
        <plugin>
          <artifactId>maven-deploy-plugin</artifactId>
          <version>2.8.2</version>
        </plugin>
        <!-- site lifecycle, see https://maven.apache.org/ref/current/maven-core/lifecycles.html#site_Lifecycle -->
        <plugin>
          <artifactId>maven-site-plugin</artifactId>
          <version>3.7.1</version>
        </plugin>
        <plugin>
          <artifactId>maven-project-info-reports-plugin</artifactId>
          <version>3.0.0</version>
        </plugin>
      </plugins>
    </pluginManagement>
  </build>
</project>
`;
    zipFile.file("pom.xml", contain);
}

async function mappingTestCaseToNewName(testCases) {
    const testCaseNames = new Map();
    const testCaseObj = {};
    for (const testCase of testCases) {
        let testCaseName = testClassName(testCase.name);
        const nameNum = testCaseNames.get(testCaseName)
        if (nameNum) {
            testCaseNames.set(testCaseName, nameNum + 1)
            testCaseName += `${nameNum}`;
        } else {
            testCaseNames.set(testCaseName, 1);
        }
        testCaseObj[testCase.id] = testCaseName;
    }
    return testCaseObj;
}

async function mappingTestSuiteToNewName(testSuites) {
    const testSuiteNames = new Map();
    const testSuiteObj = {};
    for (const testSuite of testSuites) {
        let testSuiteName = testClassName(testSuite.name);
        const nameNum = testSuiteNames.get(testSuiteName)
        if (nameNum) {
            testSuiteNames.set(testSuiteName, nameNum + 1)
            testSuiteName += `${nameNum}`;
        } else {
            testSuiteNames.set(testSuiteName, 1);
        }
        testSuiteObj[testSuite.id] = testSuiteName;
    }
    return testSuiteObj;
}

async function generateTestFolder(srcFolder, userChoice, testSuiteNameMapping) {
    const exampleFolder = srcFolder
        .folder("test")
        .folder("java")
        .folder("com")
        .folder("example");

    for (const testSuite of userChoice.testSuites) {
        const newPackage = exampleFolder.folder(testSuiteNameMapping[testSuite.id]);
        const testCases = testSuite.testCases.map(testCase => findTestCaseById(testCase.id));
        const testCaseNameMapping = await mappingTestCaseToNewName(testCases);
        for (const testCase of testCases) {
            let script = await generateExportedScript(testCase);
            const originalClassName = testClassName(testCase.name);
            script = script.replace(`public class ${originalClassName}`, `public class ${testCaseNameMapping[testCase.id]}`);
            script = script.replace(`package com.example;`, `package com.example.${testSuiteNameMapping[testSuite.id]};`)
            newPackage.file(`${testCaseNameMapping[testCase.id]}.java`, script);
        }
    }


}

async function generateTestSuiteXML(zipFile, testSuiteName, testSuite) {
    let xml = `<?xml version = "1.0" encoding = "UTF-8"?>
<!DOCTYPE suite SYSTEM "http://testng.org/testng-1.0.dtd" >
<suite name = "${testSuiteName}">
`;
    for (const testCase of testSuite.testCases) {
        const testCases = testSuite.testCases.map(testCase => findTestCaseById(testCase.id));
        const testCaseNameMapping = await mappingTestCaseToNewName(testCases);
        const caseDeclaration = `<test name = "${testCaseNameMapping[testCase.id]}">
    <classes>
        <class name = "com.example.${testSuiteName}.${testCaseNameMapping[testCase.id]}"/>
    </classes>
</test>\n`
        xml += caseDeclaration;
    }
    xml += "</suite>";
    zipFile.file(`${testSuiteName}.xml`, xml);
}

async function generateTestNGXmlFile(zipFile, userChoice, testSuiteNameMapping) {
    let xml = `<?xml version = "1.0" encoding = "UTF-8"?>
<!DOCTYPE suite SYSTEM "http://testng.org/testng-1.0.dtd" >

<suite name="allSuites">
  <suite-files>
`
    for (const testSuite of userChoice.testSuites) {
        await generateTestSuiteXML(zipFile, testSuiteNameMapping[testSuite.id], testSuite);
        xml += `<suite-file path="${testSuiteNameMapping[testSuite.id]}.xml" />\n`;
    }
    xml += `  </suite-files>
</suite>`;
    zipFile.file("testng.xml", xml);
}

const generateJavaTestNGProjectZipFile = async (userChoice, projectTitle) => {
    const zipFile = new JSZip();
    await generatePomFile(zipFile, projectTitle);

    const testSuites = userChoice.testSuites.map(testSuite => findTestSuiteById(testSuite.id));
    const testSuiteNameMapping = await mappingTestSuiteToNewName(testSuites);

    await generateTestNGXmlFile(zipFile, userChoice, testSuiteNameMapping);

    const srcFolder = zipFile.folder("src");
    await generateTestFolder(srcFolder, userChoice, testSuiteNameMapping);
    return zipFile;
}

export {generateJavaTestNGProjectZipFile}