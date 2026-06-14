import { GenericDialog } from "./generic-dialog.js";

function displayWarningIncompatibleCommands(incompatibleCommands) {
  function generateCommandList(){
    return incompatibleCommands.reduce((html,command) => html+`<li>${command}</li>`, "");
  }
  async function displayDialog(resolve) {
    const HTML =
      `
        <span>There are some incompatible commands in your Selenium IDE project</span>
        <ul style="margin: 0;">${generateCommandList()}</ul>
        <span>They will be deleted to make the tests functional. Please see this 
        <a href="https://docs.katalon.com/katalon-recorder/docs/import-from-selenium-ide.html" target="_blank">docs</a> to see the command compatibility between Selenium IDE and Katalon Recorder.</span>
      `
    ;

    const dialog = new GenericDialog({
      id: "selenium-confirm-dialog",
      title: "Incompatible commands",
      message: HTML,
      height: "auto",
      width: 400,
      buttons: [
        {
          id: "selenium-confirm-convert",
          text: "Got it!"
        },
        {
          id: "selenium-confirm-close",
          text: "Close"
        }
      ]
    });
    await dialog.render();
    $("#selenium-confirm-convert").click(function(){
      dialog.close();
      resolve("true");
    });
    $("#selenium-confirm-close").click(function(){
      dialog.close();
    });
  }

  return new Promise(async (resolve) => {
    await displayDialog(resolve);
  });
}

export { displayWarningIncompatibleCommands }