const disableExportButton = async () => {
  $("#export-to-KS-export").addClass("disable");
}

const enableExportButton = async () => {
  $("#export-to-KS-export").removeClass("disable");
}

const updateExportButtonStatus = async () => {
  if ($("#export-to-KS-test-suites input:checked").length){
    await enableExportButton()
  } else {
    await disableExportButton();
  }
}

export { disableExportButton, enableExportButton, updateExportButtonStatus }