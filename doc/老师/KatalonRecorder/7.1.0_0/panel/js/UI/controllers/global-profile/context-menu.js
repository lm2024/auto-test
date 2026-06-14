import { variableGridMenu } from "../../view/global-profile/variable-grid-menu.js";
import { setSelectedVariable } from "../../view/global-profile/selected-variable.js";

document.body.appendChild(variableGridMenu.getContainer());

// Trigger action when the context menu is about to be shown
$(document).on("contextmenu", function (event) {
  $(".menu").css("left", event.pageX).css("top", event.pageY);

  if (event.target.id === "profile-variable-container") {
    event.preventDefault();
    $("#variable-grid-menu").show();
  }

  let target = event.target;
  let inCommandGrid = false;
  while (target.tagName.toLowerCase() !== "body") {
    if (/variable-(\d)+/.test(target.id)) {
      const index = target.id.substring(9);
      setSelectedVariable(index);
    }
    if (target.id === "profile-grid") {
      inCommandGrid = true;
      break;
    } else {
      target = target.parentElement;
    }
  }
  if (inCommandGrid) {
    event.preventDefault();
    variableGridMenu.show();
  }
});


// If the document is clicked somewhere
$(document).on("mousedown", function (e) {
  if (!$(e.target).parents(".menu").length > 0) $(".menu").hide();
  // KAT-BEGIN fix context menu not work with touchpad
  else setTimeout(function () {
    $(".menu").hide();
  }, 500);
  // KAT-END
});