function showTestOpsDialog(messageHTML){
  import("../UI/view/dialog/generic-dialog.js").then(async module => {
    const dialog = new module.GenericDialog({
      title: `
                <img class="kto-light" style="max-width: 50%;" src="../../../katalon/images/branding/Katalon-TestOps-full-color-large-w.png" alt="Katalon TestOps" />
                <img class="kto-dark" style="max-width: 50%;" src="../../../katalon/images/branding/Katalon-TestOps-full-color-large.png" alt="Katalon TestOps" />
                `,
      id: "testOpsDialog",
      message: messageHTML,
      height: "auto",
      width: 400,
      buttons: [{
        id: "testOpsDialogClose",
        text: "Close"
      }]
    });
    await dialog.render();
    $("#testOpsDialogClose").click(function(){dialog.close()});
  })
}

function showErrorDialog() {
    return showTestOpsDialog('Something went wrong. Please try again later.');
}
