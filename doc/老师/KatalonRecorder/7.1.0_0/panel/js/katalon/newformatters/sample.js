$(document).ready(function(){
  newFormatters.sample = function(name, commands) {
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
      "addSelection",
      "captureEntirePageScreenshot",
      "getEval",
      "runScript",
      "if",
      "else",
      "endIf",
      "elseIf",
      "while",
      "endWhile",
      "selectWindow",
      "storeEval"
    ]

    var content = '';
    for (var i = 0; i < commands.length; i++) {
      var command = commands[i];
      content += command.command + ' | ' + command.target + ' | ' + command.value + '\n';
    }
    return {
      content: content,
      extension: 'txt',
      mimetype: 'text/plain'
    }
  }
})
