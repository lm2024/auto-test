const displayProgressBar = async (userChoice) => {
  $("#export-progress").css("display", "block");
  const count = userChoice.testSuites.length;
  for (let i = 1; i <= count; i++) {
    const timeout = userChoice.testSuites[i-1].testCases.length * 50;
    await new Promise(resolve => setTimeout(resolve, timeout));
    const content = `${i}/${count} test artifacts are being exported`;
    const percentage = Math.round((i / count) *100 * 100) / 100
    $("#export-progress-bar").val(percentage)
    $("#export-progress-bar-message").html(content);
    $("#export-progress-bar-label").html(`${percentage} %`);
  }

}

export { displayProgressBar }