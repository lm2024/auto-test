window.javaTestNGStoredVars = {};
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
];

function formatComment(comment){
  return `//${comment.comment}`;
}

SeleniumWebDriverAdaptor.prototype.addSelection = function(elementLocator, label) {
  var locator = this._elementLocator(this.rawArgs[0]);
  var driver = new WDAPI.Driver();
  return driver.findElement(locator.type, locator.string).select(this._selectLocator(this.rawArgs[1]));
};

SeleniumWebDriverAdaptor.prototype.captureEntirePageScreenshot = function(elementLocator, label) {
  return `{
  File scrFile = ((TakesScreenshot)driver).getScreenshotAs(OutputType.FILE);
  FileUtils.copyFile(scrFile, new File("src/test/resources/${this.rawArgs[0]}.png"));
}`
}

SeleniumWebDriverAdaptor.prototype.getEval = function(element, label){
  return `js.executeScript("${expandForStoreEvalCommand()} return " + ${xlateArgument(this.rawArgs[0])} + "")`;
}

WDAPI.Utils.isElementPresent = function(how, what) {
  /*return `try {
  driver.findElement(${WDAPI.Driver.searchContext(how, what)});
} catch (Exception e) {
  fail("timeout");
}`*/
  return "isElementPresent(" + WDAPI.Driver.searchContext(how, what) + ");";
};

WDAPI.Element.prototype.sendKeys = function(text) {
  text = xlateArgument(text);
  if (window.javaTestNGStoredVars[text] === undefined){
    return this.ref + ".sendKeys(" + text + ")";
  }
  if (window.javaTestNGStoredVars[text] !== "String"){
    return this.ref + ".sendKeys(" + `String.valueOf(${text})` + ")";
  }
  return this.ref + ".sendKeys(" + text + ")";
};

function waitFor(expression) {
  return expression.toString();
}

function setTimeoutCommand(command){
  if (command.target !== ""){
    return `driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(${parseInt(command.target) / 1000}));`
  } else if (command.value !== ""){
    return `driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(${parseInt(command.value) / 1000}));`
  }
}

function assignToVariable(type, variable, expression, command) {
  if (!type) type = "def";
  if (!expression || !command || !variable) return "";
  //This flag to represent whether expression assigned to the variable is primitive type
  let isLiteral = false;
  //KR allows variable with empty space, but Groovy doesn't.
  let varName = variable.replace(/ /g, '_').replace(/\./g, '_');
  let varValue = expression.toString(command);
  //Get exact type of variable
  try {
    if (!isNaN(parseFloat(eval(varValue)))) {
      varValue = eval(varValue);
      isLiteral = true;
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

  if (window.javaTestNGStoredVars[varName]) {
    type = window.javaTestNGStoredVars[varName];
    //If this variable has been declared and the expression is not primitive
    //then we have to convert it to the type of the declared variable
    if (!isLiteral) {
      return `${varName} = ${getTypeConversion(type)}${varValue}`
    }
    return varName + " = " + varValue;
  }
  window.javaTestNGStoredVars[varName] = type;
  //If this variable has been declared and the expression is not primitive
  //then we have to convert it to the type of the declared variable
  if (!isLiteral || type === "String") {
    return type + " " + varName + " = " + getTypeConversion(type) + varValue;
  }
  return type + " " + varName + " = " + varValue;
}

function getTypeConversion(type) {
  switch (type) {
    case "String":
      return "(String)";
    case "long":
      return "(long)";
    case "double":
      return "(double)";
    default:
      return "";
  }
}

function convertRunScript(expression, command) {
  let target = xlateArgument(command.target);
  //remove both " surrounding target
  target = target.substring(1, target.length - 1);
  if (command.value === "") {
    return `js.executeScript("${target}");`;
  }
  //store result into variable
  addDeclaredVar(command.value);
  // KR allows variable with empty space, but javascript doesn't.
  let varName = command.value.replace(/ /g, '_').replace(/\./g, '_');

  if (window.javaTestNGStoredVars[varName]) {
    let bracket = target.includes("$") ? `'` : `"`;
    let type = window.javaTestNGStoredVars[varName];
    let statement = `${varName} = ${getTypeConversion(type)} js.executeScript(${bracket}${target}${bracket})`;
    return statement;
  }

  //declare new variable
  window.javaTestNGStoredVars[varName] = command.target;
  return `String ${varName} = js.executeScript("${target}").toString();`;
}

function expandForStoreEvalCommand() {
  let variables = '';
  //inject declared variables to javascript code
  for (let i in window.javaTestNGStoredVars) {
    if (isVarName(i)) {
      variables += `var ${i} = \\"" + ${i} + "\\";`
    }
  }
  //inject storedVars object
  if (Object.keys(window.javaTestNGStoredVars).length !== 0) {
    let str = `{ ${Object.keys(window.javaTestNGStoredVars).map(key => `'${key}': ${key}`)} }`;
    variables += `var storedVars = ${str};`
  }
  return variables;
}

function convertConditionExpression(originalExpression) {
  let expression = originalExpression;
  if (/"\${/.test(expression)) {
    //expression has "" surround it => convert the expression to string
    expression = expression.replaceAll('"${', "").replaceAll('}"', ".toString()");
    if (/ == /.test(expression)){
      return expression.replaceAll(" == ",".equals(") + ")";
    }
    if (/ != /.test(expression)){
      return "!" + expression.replaceAll(" != ",".equals(") + ")";
    }
  }
  return expression.replaceAll("${", "").replaceAll("}", "");

}

//https://www.guru99.com/drag-drop-selenium.html
function convertDragAndDrop(expression, command) {
  const adaptor = new SeleniumWebDriverAdaptor(expression.rawArgs);
  const sourceLocator = adaptor._elementLocator(expression.rawArgs[0]);
  const destinationLocator = adaptor._elementLocator(expression.rawArgs[1]);
  const driver =  new WDAPI.Driver();
  const sourceCode= driver.findElement(sourceLocator.type, sourceLocator.string).ref;
  const destinationCode= driver.findElement(destinationLocator.type, destinationLocator.string).ref;
  return `{
  Actions builder = new Actions(driver);
  WebElement from = ${sourceCode};
  WebElement to = ${destinationCode};
  builder.dragAndDrop(from, to).build().perform();
}`;
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
      return `while (${conditionExpression}) {`;
    }
    case "endWhile":
      window.indentLevel--;
      return `}`;
    case "if": {
      let conditionExpression = convertConditionExpression(command.target);
      window.indentLevel++;
      return `if (${conditionExpression}) {`;
    }
    case "endIf":
      window.indentLevel--;
      return `}`;
    case "else":
      return `} else {`;
    case "elseIf": {
      let conditionExpression = convertConditionExpression(command.target);
      return `} else if (${conditionExpression}) {`
    }
  }
  var s = expression.toString();
  if (s.length === 0) {
    return null;
  }
  return s + ';';
}

CallSelenium.prototype.toString = function(command) {
  if (this.message == 'waitForPageToLoad') {
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
