import "../../../../../panel/js/background/doc.js";

$(document).ready(function () {
  $("#refercontainer").hide();
  $('#records-grid').on('click', function () {
    if ($('#command-command')) {
      // On click
      scrape($('#command-command').val());

      // On input change
      $('#command-command').on('input keydown', () => {
        scrape($('#command-command').val());
      })
    }
  });
});
