async function getParserScripts (scriptId){
  switch (scriptId){
    case 'cs-wd-nunit':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/csharp/cs-rc.js",
        'js/katalon/selenium-ide/webdriver.js',
        "js/katalon/selenium-ide/format/csharp/cs-wd.js"
      ];
    case 'cs-wd-mstest':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/csharp/cs-rc.js",
        'js/katalon/selenium-ide/webdriver.js',
        "js/katalon/selenium-ide/format/csharp/cs-wd.js",
        "js/katalon/selenium-ide/format/csharp/cs-mstest-wd.js"
      ];
    case 'java-wd-testng':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/java/java-rc.js",
        "js/katalon/selenium-ide/format/java/java-rc-junit4.js",
        "js/katalon/selenium-ide/format/java/java-rc-testng.js",
        'js/katalon/selenium-ide/webdriver.js',
        "js/katalon/selenium-ide/format/java/webdriver-testng.js",
        "js/katalon/selenium-ide/format/java/java-advance-testng.js",
      ];
    case 'java-wd-junit':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/java/java-rc.js",
        "js/katalon/selenium-ide/format/java/java-rc-junit4.js",
        "js/katalon/selenium-ide/format/java/java-rc-testng.js",
        'js/katalon/selenium-ide/webdriver.js',
        "js/katalon/selenium-ide/format/java/webdriver-junit4.js",
        "js/katalon/selenium-ide/format/java/java-advance-junit.js",
      ];
    case 'java-rc-junit':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/java/java-rc.js",
        "js/katalon/selenium-ide/format/java/java-rc-junit4.js",
        "js/katalon/selenium-ide/format/java/java-rc-testng.js",
        "js/katalon/selenium-ide/format/java/java-backed-junit4.js"
      ];
    case 'python-appdynamics':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/python/python2-rc.js",
        'js/katalon/selenium-ide/webdriver.js',
        "js/katalon/selenium-ide/format/python/python-appdynamics.js"
      ];
    case 'python2-wd-unittest':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/python/python2-rc.js",
        'js/katalon/selenium-ide/webdriver.js',
        "js/katalon/selenium-ide/format/python/python2-wd.js",
        "js/katalon/selenium-ide/format/python/python-advance-unittest.js",
      ];
    case 'robot':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/format/robot/robot.js'
      ];
    case 'ruby-wd-rspec':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/ruby/ruby-rc.js",
        "js/katalon/selenium-ide/format/ruby/ruby-rc-rspec.js",
        'js/katalon/selenium-ide/webdriver.js',
        "js/katalon/selenium-ide/format/ruby/ruby-wd-rspec.js"
      ];
    case 'xml':
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/format/xml/XML-formatter.js'
      ];
    case "katalon":
      return [
        'js/katalon/selenium-ide/formatCommandOnlyAdapter.js',
        'js/katalon/selenium-ide/remoteControl.js',
        "js/katalon/selenium-ide/format/java/java-rc.js",
        "js/katalon/selenium-ide/format/java/java-rc-junit4.js",
        "js/katalon/selenium-ide/format/java/java-rc-testng.js",
        "js/katalon/selenium-ide/format/java/java-backed-junit4.js",
        "js/katalon/selenium-ide/format/katalon/katalon.js"
      ];
  }
}

const loadParserScripts = async (scriptId) => {
  return new Promise(async resolve => {
    const scriptNames = await getParserScripts(scriptId);
    if (scriptNames === undefined) {
      resolve();
    }
    $("[id^=formatter-script-language-id-]").remove();
    let j = 0;
    for (let i = 0; i < scriptNames.length; i++) {
      const script = document.createElement('script');
      script.id = "formatter-script-language-id-katalon-" + i;
      script.src = scriptNames[i];
      script.async = false; // This is required for synchronous execution
      script.onload = function () {
        j++;
      }
      document.head.appendChild(script);
    }
    let interval = setInterval(
      function () {
        if (j === scriptNames.length) {
          clearInterval(interval);
          resolve();
        }
      },
      100
    );
  });
}

const unloadParserScripts = async () => {
  $("[id^=formatter-script-language-id-]").remove();
  const script = document.createElement('script');
  script.id = "formatter-script-language-id-katalon";
  script.src = 'js/background/formatCommand.js';
  script.async = false; // This is required for synchronous execution
  document.head.appendChild(script);
  window.options = undefined;
  window.declaredVars = null;
  window.katalonStudioStoredVars = {};
  window.katalonStudioStoreCSVFile = {};
  window.javaJunitStoredVars = {};
  window.javaTestNGStoredVars = {};
  window.pythonUnittestVars = {};
  window.unsupportedCommands = [];
}


export { loadParserScripts, unloadParserScripts }