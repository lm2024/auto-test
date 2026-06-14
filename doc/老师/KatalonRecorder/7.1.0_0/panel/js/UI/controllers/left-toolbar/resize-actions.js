let heightElement = 0;

$(() => {
  $('#action-act').click(async function (e) {
    const elementAction = ['#export', '#test-ops-back-up-data', '#ka-upload', '#tagging-features'];
    if (this.src.includes('collapse')) {
      this.src = 'icons/expand.svg';
      await elementAction.forEach(i => $(i).hide());
      $('#actions').css('min-height', '100px');
    } else {
      this.src = 'icons/collapse.svg';
      await elementAction.forEach(i => $(i).show());
      $('#actions').css('min-height', '200px');
    }
  });
});

// $(window).resize(function() {
//     let height = $(window).height();
//     if (height < 723) {
//         heightElement = 280;
//     } else if (height > 724 && height < 839) {
//         heightElement = 380;
//     } else {
//         heightElement = 540;
//     }
//     $('#workspace').css('max-height', heightElement);
// });

// check event click outside
$(document).on('click', function (e) {
  const element = e.target;
  if (!$(element).is('#suite-open') && $(element).parents('#suite-open').length == 0) {
    $('#suite-open-dropdown').hide();
    $('#suite-open').css('background-color', '');
    $('#suite-open').css('color', '');
    $('#suite-open img').attr('src', 'icons/open-test-suite.svg');
  }

  if (!$(element).is('#more-options') && $(element).parents('#more-options').length == 0) {
    $('#more-options-open-dropdown').hide();
    $('#more-options').css('background-color', '');
    $('#more-options').css('color', '');
    $('#more-options-icon').attr('src', '/katalon/images/SVG/more-options.svg');
  }

  if (!$(element).is('#profilePlus') && $(element).parents('#profilePlus').length == 0) {
    $('#profiles-action-dropdown').hide();
  }
});
