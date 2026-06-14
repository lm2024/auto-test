import {
  loadProfileData,
  saveProfileData,
} from '../../services/global-profile-service/globla-profile-local-storage.js';
import { renderProfileList } from '../../view/global-profile/render-profile-list.js';
import { addProfile } from '../../services/global-profile-service/profile-data-service.js';
import {
  closeProfileList,
  openProfileList,
} from '../../view/global-profile/dropdown-profile-panel.js';
import { readJsonFromFile } from '../../services/helper-service/readJsonFromFile.js';
import { renderAddProfileDialog } from '../../view/global-profile/add-profile-dialog.js';
import { renderNewProfile } from '../../view/global-profile/render-new-profile.js';
import { Profile } from '../../models/global-profile/profile.js';

$(document).ready(function () {
  loadProfileData().then(async _ => {
    await renderProfileList();
  });

  $('#profileDropdown').click(function () {
    const image = $(this).find('img');
    const src = $(image).attr('src');
    if (src.includes('off')) {
      openProfileList();
    } else {
      closeProfileList();
    }
  });

  $('#profilePlus').click(function () {
    const dropdown = $('#profiles-action-dropdown');
    if ($(dropdown).css('display') === 'block') {
      $(dropdown).css('display', 'none');
    } else {
      $(dropdown).css('display', 'block');
      const profilePlusPosition = $(this).position();
      $(dropdown).css('top', profilePlusPosition.top + 32);
      $(dropdown).css('left', profilePlusPosition.left);
      $(dropdown).css('display', 'block');
    }
  });

  $('#create-new-profile').click(async () => {
    $('#profiles-action-dropdown').css('display', 'none');

    renderAddProfileDialog();
  });

  $('#open-existing-profile').click(event => {
    event.stopPropagation();
    $('#profiles-action-dropdown').css('display', 'none');

    document.getElementById('open-global-profile').click();
  });

  $('#open-global-profile').change(async function (event) {
    event.stopPropagation();

    for (const profile of this.files) {
      let { id, title, variables, isDefault } = await readJsonFromFile(profile);
      let globalProfile = new Profile(id, title, variables, isDefault);

      try {
        await addProfile(globalProfile);
        renderNewProfile(globalProfile);
        await saveProfileData();
        $(`#${globalProfile.id}`).trigger('click');

        Toastify({
          text: 'Successfully added the new profile!',
          duration: 3000,
          close: true,
          avatar: '/katalon/images/SVG/green-check-circle.svg',
        }).showToast();
      } catch (error) {
        Toastify({
          text: `${error.message}!`,
          duration: 3000,
          close: true,
          avatar: '/katalon/images/SVG/red-cross-circle.svg',
        }).showToast();
      }
    }

    this.value = null;
  });
});
