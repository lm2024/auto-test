const parseCommandValue = (testCommand) => {
  const value = testCommand.value;
  const regex = /(?<=\${).+?(?=})/g;
  let variables = value.match(regex)
  variables = variables === null ? [] : variables;
  variables = variables.filter(variable => !variable.includes("GlobalVariable"));

  return variables === null ? [] : variables;
}

export { parseCommandValue }