const checkUnsupportedCommands = async (testCase) => {
  return testCase.commands
    .map(command => command.name)
    .some(commandName => window.unsupportedCommands.includes(commandName));
}

export { checkUnsupportedCommands }