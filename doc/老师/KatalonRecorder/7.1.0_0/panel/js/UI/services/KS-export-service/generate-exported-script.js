function mappingKRTestCommandsToScriptCommands(KRCommands){
  const ret = [];
  const regex = /^\${GlobalVariable\./g
  for (let index=0; index<KRCommands.length; index++) {
    let commandName = KRCommands[index].name;
    let commandTarget = KRCommands[index].defaultTarget;
    let commandValue = KRCommands[index].value;

    if (regex.test(commandTarget)){
      commandTarget = convertGlobalVariableToKSFormat(commandTarget);
    }
    if (regex.test(commandValue)){
      commandValue = convertGlobalVariableToKSFormat(commandValue);
    }
    ret.push(new Command(commandName, commandTarget, commandValue));
  }
  return ret;
}

const convertGlobalVariableToKSFormat = (value) => {
  return value.replace(/-/g, "_").replace(/ /g, '_');
}

function addGlobalVariable(KRTestCase){
  const regex = /^\${GlobalVariable\./g
  for (const command of KRTestCase.commands) {
    if (regex.test(command.defaultTarget)){
      const variable = convertGlobalVariableToKSFormat(command.defaultTarget.replace("${", "").replace("}",""));
      addDeclaredVar(variable);
    }
    if (regex.test(command.value)){
      const variable = convertGlobalVariableToKSFormat(command.value.replace("${", "").replace("}",""));
      addDeclaredVar(variable);
    }
  }

}


const generateExportedScript = async (KRTestCase) => {
  window.declaredVars = null;
  window.katalonStudioStoredVars = {};
  window.katalonStudioStoreCSVFile = {};
  window.javaJunitStoredVars = {};
  window.javaTestNGStoredVars = {};
  window.pythonUnittestVars = {};
  const language = $("#export-to-KS-select-script-language").val();

  const commands = mappingKRTestCommandsToScriptCommands(KRTestCase.commands);

  if (language.indexOf('new-formatter') >= 0) {
    const newFormatterId = language.replace('new-formatter-', '');
    const newFormatter = newFormatters[newFormatterId];
    const payload = newFormatter(name, commands);
    window.options = {
      defaultExtension: payload.extension,
      mimetype: payload.mimetype
    };
    return payload.content;
  }

  addGlobalVariable(KRTestCase);
  const scriptTestCase = new TestCase(KRTestCase.name);
  scriptTestCase.commands = commands;
  scriptTestCase.formatLocal(KRTestCase.name).header = "";
  scriptTestCase.formatLocal(KRTestCase.name).footer = "";
  const result = format(scriptTestCase, name);
  return result;
}


export { generateExportedScript, convertGlobalVariableToKSFormat }