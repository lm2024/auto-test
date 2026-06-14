window.pythonUnittestVars = {};
window.indentLevel = 0;
window.codeBlockCommands = [
  "while",
  "if",
  "else",
  "elseIf"
]

window.unsupportedCommands = ["ajaxWait",
  "ajaxWaitAndWait",
  "break",
  "chooseCancelOnNextPrompt",
  "chooseCancelOnNextPromptAndWait",
  "domWait",
  "domWaitAndWait",
  "editContent",
  "editContentAndWait",
  "pageWait",
  "pageWaitAndWait",
  "prePageWait",
  "prePageWaitAndWait",
  "showElement",
  "showElementAndWait",
  "waitPreparation",
  "waitPreparationAndWait",
  "gotoIf",
  "gotoLabel",
  "label",
  "writeToCSV",
  "appendToCSV",
  "appendToJSON",
  "assertNotWhetherThisFrameMatchFrameExpression",
  "assertNotWhetherThisWindowMatchWindowExpression",
  "assertWhetherThisFrameMatchFrameExpression",
  "assertWhetherThisWindowMatchWindowExpression",
  "verifyWhetherThisFrameMatchFrameExpression",
  "verifyWhetherThisWindowMatchWindowExpression",
  "verifyNotWhetherThisFrameMatchFrameExpression",
  "verifyNotWhetherThisWindowMatchWindowExpression",
  "storeWhetherThisFrameMatchFrameExpression",
  "storeWhetherThisWindowMatchWindowExpression",
  "waitForWhetherThisFrameMatchFrameExpression",
  "waitForWhetherThisWindowMatchWindowExpression",
  "waitForNotWhetherThisFrameMatchFrameExpression",
  "waitForNotWhetherThisWindowMatchWindowExpression",
  "storeCsv",
  "endLoadVars",
  "loadVars",
]

function formatComment(comment){
  return `#${comment.comment}`;
}

SeleniumWebDriverAdaptor.prototype.addSelection = function(elementLocator, label) {
  var locator = this._elementLocator(this.rawArgs[0]);
  var driver = new WDAPI.Driver();
  return driver.findElement(locator.type, locator.string).select(this._selectLocator(this.rawArgs[1]));
};

SeleniumWebDriverAdaptor.prototype.captureEntirePageScreenshot = function(elementLocator, label) {
  return `driver.save_screenshot('${this.rawArgs[0]}.png')`;
}

SeleniumWebDriverAdaptor.prototype.getEval = function(element, label){
  let value = xlateArgument(this.rawArgs[0]);
  value = wrapVariableNameInsideStr(value);
  return `driver.execute_script("${expandForStoreEvalCommand()} return " + ${value})`;
}

/*WDAPI.Utils.isElementPresent = function(how, what) {
  return `try:
  driver.find_element(${WDAPI.Driver.searchContextArgs(how, what)})
except Exception as e:
  self.fail("timeout")`
};*/

WDAPI.Element.prototype.sendKeys = function(text) {
  text = xlateArgument(text);
  text = wrapVariableNameInsideStr(text);
  return this.ref + ".send_keys(" + text + ")";
};

//since python does not allow "+" operator between string and number
//we need to wrap num inside str() function
function wrapVariableNameInsideStr(text){
  Object.keys(window.pythonUnittestVars).forEach(varName => {
    const pattern = `\" + ${varName} + \"`;
    const index = text.indexOf(pattern);
    if (index === -1) return;
    const temp = text.substring(index, index + pattern.length);
    text = text.replace(temp, `\" + str(${varName}) + \"`)
  })
  Object.keys(window.pythonUnittestVars).forEach(varName => {
    const pattern = `${varName} + \"`;
    const index = text.indexOf(pattern);
    if (index === -1) return;
    const temp = text.substring(index, index + pattern.length);
    text = text.replace(temp, `str(${varName}) + \"`)
  })
  Object.keys(window.pythonUnittestVars).forEach(varName => {
    const pattern = `\" + ${varName}`;
    const index = text.indexOf(pattern);
    if (index === -1) return;
    const temp = text.substring(index, index + pattern.length);
    text = text.replace(temp, `\" + str(${varName})`)
  });
  return text;
}

function echo(message) {
  message = xlateArgument(message);
  message = wrapVariableNameInsideStr(message)
  return "print(" + message + ")";
}

function waitFor(expression) {
  return expression.toString();
}

function setTimeoutCommand(command){
  if (command.target !== ""){
    return `driver.implicitly_wait(${parseInt(command.target) / 1000})`
  } else if (command.value !== ""){
    return `driver.implicitly_wait(${parseInt(command.value) / 1000})`
  }
}


function assignToVariable(type, variable, expression, command) {
  if (!type) type = "def";
  if (!expression || !command || !variable) return "";
  //This flag to represent whether expression assigned to the variable is primitive type
  //KR allows variable with empty space, but Groovy doesn't.
  let varName = variable.replace(/ /g, '_').replace(/\./g, '_');
  let varValue;
  if (typeof expression === "string"){
    varValue = expression.toString();
    varValue = wrapVariableNameInsideStr(varValue);
  } else {
    varValue = expression.toString(command);
  }

  //Get exact type of variable
  try {
    if (!isNaN(parseFloat(eval(varValue)))) {
      varValue = eval(varValue);
      if (varValue % 1 === 0) {
        type = "long";
      } else {
        type = "double";
      }
    }
  } catch (e) {
  }
  //When the command contains eval we cannot use varValue to pass to eval() function
  //This happen because after go through expression.toString() the varValue become the code on KS
  //Ex: Command{command = "storeEval", target = 5, value = "pages"} => varValue = "selenium.getEval(\"  \" + \"5\")"
  //Therefore, we need to check the value of command.target
  if (command?.command.includes("Eval")) {
    try {
      if (!isNaN(parseFloat(eval(command?.target)))) {
        if (eval(command?.target) % 1 === 0) {
          type = "long";
        } else {
          type = "double";
        }
      }
    } catch (e) {
    }
  }

  this.pythonUnittestVars[varName] = type;
  return varName + " = " + varValue;
}

function convertRunScript(expression, command) {
  let target = xlateArgument(command.target);
  target = wrapVariableNameInsideStr(target);
  //remove both " surrounding target
  target = target.substring(1, target.length - 1);
  if (command.value === "") {
    return `driver.execute_script("${target}");`;
  }
  //store result into variable
  addDeclaredVar(command.value);
  // KR allows variable with empty space, but javascript doesn't.
  let varName = command.value.replace(/ /g, '_').replace(/\./g, '_');
  //declare new variable
  return `${varName} = driver.execute_script("${target}")`;
}

function expandForStoreEvalCommand() {
  let variables = '';
  //inject declared variables to javascript code
  for (let i of Object.keys(this.pythonUnittestVars)) {
    if (isVarName(i)) {
      variables += `var ${i} = \\"" + str(${i}) + "\\";`
    }
  }
  //inject storedVars object
  if (Object.keys(window.pythonUnittestVars).length !== 0) {
    let str = `{ ${Object.keys(window.pythonUnittestVars).map(key => `'${key}': ${key}`)} }`;
    variables += `var storedVars = ${str};`
  }
  return variables;
}

function convertConditionExpression(originalExpression) {
  let expression = originalExpression;
  if (/"\${/.test(expression)) {
    //expression has "" surround it => convert the expression to string
    expression = expression.replaceAll('"${', "").replaceAll('}"', ".toString()");
  } else {
    expression = expression.replaceAll("${", "").replaceAll("}", "");
  }
  return expression;
}

/*
https://www.lambdatest.com/blog/drag-and-drop-in-selenium-python/
*/
function convertDragAndDrop(expression, command) {
  const adaptor = new SeleniumWebDriverAdaptor(expression.rawArgs);
  const sourceLocator = adaptor._elementLocator(expression.rawArgs[0]);
  const destinationLocator = adaptor._elementLocator(expression.rawArgs[1]);
  const driver =  new WDAPI.Driver();
  const sourceCode= driver.findElement(sourceLocator.type, sourceLocator.string).ref;
  const destinationCode= driver.findElement(destinationLocator.type, destinationLocator.string).ref;
  return `actions = ActionChains(driver)
from_source = ${sourceCode}
to_source = ${destinationCode}
actions.drag_and_drop(from_source, to_source).perform()`;
}

function statement(expression, command) {
  switch (command?.command){
    case "runScript":
      return convertRunScript(expression, command);
    case "dragAndDropToObjectByJqueryUI":
    case "dragAndDropToObject":
      return convertDragAndDrop(expression, command);
    case "while": {
      let conditionExpression = convertConditionExpression(command.target);
      window.indentLevel++;
      return `while ${conditionExpression} :`;
    }
    case "endWhile":
      window.indentLevel--;
      return ``;
    case "if": {
      let conditionExpression = convertConditionExpression(command.target);
      window.indentLevel++;
      return `if ${conditionExpression} :`;
    }
    case "endIf":
      window.indentLevel--;
      return ``;
    case "else":
      return `else: `;
    case "elseIf": {
      let conditionExpression = convertConditionExpression(command.target);
      return `elif ${conditionExpression} :`
    }
  }
  var s = expression.toString();
  if (s.length === 0) {
    return null;
  }
  return s;
}

CallSelenium.prototype.toString = function(command) {
  if (this.message === 'waitForPageToLoad') {
    return '';
  }
  var result = '';
  var adaptor = new SeleniumWebDriverAdaptor(this.rawArgs);
  if (adaptor[this.message]) {
    var codeBlock = adaptor[this.message].call(adaptor);
    if (adaptor.negative) {
      this.negative = !this.negative;
    }
    if (this.negative) {
      result += notOperator();
    }
    result += codeBlock;
  } else {
    //unsupported
    throw 'ERROR: Unsupported command [' + this.message + ' | ' + (this.rawArgs.length > 0 && this.rawArgs[0] ? this.rawArgs[0] : '') + ' | ' + (this.rawArgs.length > 1 && this.rawArgs[1] ? this.rawArgs[1] : '') + ']';
  }
  return result;
};
