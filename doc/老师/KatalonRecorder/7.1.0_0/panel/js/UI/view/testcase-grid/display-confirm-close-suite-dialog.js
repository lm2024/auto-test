import { GenericDialog } from "../dialog/generic-dialog.js";

const displayConfirmCloseDialog = question => {
  return new Promise(async resolve => {
    const dialog = new GenericDialog({
      message: question,
      title: "Warning! Possible data loss",
      height: "auto",
      width: 400,
      buttons: [
        {
          id: "warning-close-yes-button",
          text: "Yes",
        },
        {
          id: "warning-close-no-button",
          text: "No, delete my data"
        },
        {
          id: "warning-close-cancel-button",
          text: "Cancel"
        }
      ]
    });
    await dialog.render();
    $("#warning-close-yes-button").click(function(){
      resolve("true");
      dialog.close();
    });
    $("#warning-close-no-button").click(function(){
      resolve(false);
      dialog.close();
    });
    $("#warning-close-cancel-button").click(function(){
      dialog.close();
    });
  })
};

export { displayConfirmCloseDialog }