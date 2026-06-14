import { GenericDialog } from '../dialog/generic-dialog.js';
import { createNewProfile } from '../../services/global-profile-service/profile-data-service.js';
import { renderNewProfile } from './render-new-profile.js';
import { saveProfileData } from '../../services/global-profile-service/globla-profile-local-storage.js';
import { trackingSegment } from '../../services/tracking-service/segment-tracking-service.js';

const htmlString = `
  <div class="header">
    <div class="title">Katalon Recorder (Selenium tests generator)</div>
      <button class="dialog-close" id="add-profile-close">
        <img src="/katalon/images/SVG/close-icon.svg" alt="Close"/>
      </button>
  </div>
  <div class="content">
    <div class="message">Please enter the Profile’s name:</div>
    <input id="add-profile-name" placeholder="Enter new Profile's name"></input>
  </div>
  <div class="footer">
    <button id="add-profile-cancel">Cancel</button>
    <button class="disable" disabled id="add-profile-confirm">Confirm</button>
  </div>
`;

export async function renderAddProfileDialog() {
  const height = 204;
  const width = 400;
  const dialog = new GenericDialog({
    id: 'add-profile-dialog',
    html: htmlString,
    height: height,
    width: width,
  });

  await dialog.render();

  // No overlay for this dialog
  $('.ui-widget-overlay').css('display', 'none');

  $('#add-profile-cancel').on('click', () => {
    $('#add-profile-dialog').dialog('close');
  });

  $('#add-profile-close').on('click', () => {
    $('#add-profile-dialog').dialog('close');
  });

  $('#add-profile-name').on('input', event => {
    if (event.target.value.length > 0) {
      $('#add-profile-confirm').removeClass('disable');
      $('#add-profile-confirm').prop('disabled', false);
      $('#add-profile-confirm').css('background', '#276EF1');
      $('#add-profile-confirm').css('color', '#FFFFFF');
    } else {
      $('#add-profile-confirm').addClass('disable');
      $('#add-profile-confirm').prop('disabled', true);
      $('#add-profile-confirm').css('background', '');
      $('#add-profile-confirm').css('color', '');
    }
  });

  $('#add-profile-confirm').on('click', async () => {
    const title = $('#add-profile-name').val();

    if (title) {
      const newProfile = await createNewProfile(title);
      renderNewProfile(newProfile);
      await saveProfileData();
      $(`#${newProfile.id}`).trigger('click');
    }

    trackingSegment('kru_new_profile', { source: 'profile_context_menu' });

    $('#add-profile-dialog').dialog('close');
    $('#add-profile-name').val('');
  });

  $('#add-profile-name').on('keyup', event => {
    if (event.which == 13 || event.keyCode == 13) {
      $('#add-profile-confirm').click();
    }
  })
}
