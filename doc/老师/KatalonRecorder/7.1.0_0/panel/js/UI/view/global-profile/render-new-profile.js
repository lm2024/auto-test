import { generateProfileContextMenu } from './generate-profile-context-menu.js';
import { setSelectedProfile } from './selected-profile.js';
import { findProfileByID } from '../../services/global-profile-service/profile-data-service.js';
import { assignId } from './assign-id.js';
import { appendVariable } from './add-variable.js';
import { getSelectedVariable, setSelectedVariable } from './selected-variable.js';

function contextMenuHandler(event) {
  event.preventDefault();
  event.stopPropagation();
  setSelectedProfile(this.id);

  let mid = '#' + 'menu' + this.id;
  $('.menu').css('left', event.pageX).css('top', event.pageY);
  $(mid).show();
  const shownMenu = $(mid);
  const bottomShownMenu = shownMenu.offset().top + shownMenu.height();
  if (bottomShownMenu > $(document).height()) {
    let diffBottomMenu = bottomShownMenu - $(document).height();
    shownMenu.css('top', shownMenu.offset().top - diffBottomMenu);
  }
}

const renderNewProfile = profile => {
  const container = document.createElement('div');
  container.id = profile.id;
  container.classList.add('profile-item');
  if (profile.isDefault) {
    container.classList.add('default');
  }

  const icon = document.createElement('div');
  icon.classList.add('profileIcon');
  const img = document.createElement('img');
  img.src = '/katalon/images/SVG/test-case-dot.svg';
  if (profile.isDefault) {
    img.src = '/katalon/images/SVG/default-profile-icon.svg';
  }
  icon.appendChild(img);
  container.appendChild(icon);

  const title = document.createElement('div');
  title.innerHTML = profile.title;
  container.appendChild(title);

  const profileList = document.getElementById('profile-list');
  profileList.appendChild(container);

  const menu = generateProfileContextMenu(profile);
  container.appendChild(menu);

  container.addEventListener('click', async function () {
    setSelectedProfile(this.id);
    const newProfile = await findProfileByID(this.id);

    $('.command-section').hide();
    $('.title-testcase').hide();
    $('.dynamic-test-suite').hide();
    $('#profile-section').css({
      display: 'flex',
      height: '100%',
      border: '1px solid var(--section-border)',
      'border-radius': '8px',
    });
    $('#profileTitle').html(newProfile.title).show();
    //need to reset colResizable first
    $('#profile-variable-grid')
      .colResizable({ disable: true })
      .colResizable({ liveDrag: true, minWidth: 75 });
    //display profile variable to sample-records-grid
    const profileGrid = $('#profile-grid');
    $(profileGrid).empty();
    for (const element of newProfile.variables) {
      const profileVariable = element;
      await appendVariable(profileVariable.name, profileVariable.value);
    }

    await assignId(0, await newProfile.countVariables());
    if (this.selectedVariableIndex !== undefined) {
      setSelectedVariable(this.selectedVariableIndex);
      getSelectedVariable().scrollIntoView({
        block: 'center',
      });
    }
  });

  container.addEventListener('contextmenu', contextMenuHandler);
  addContextMenuButton(profile.id, container, menu, 'profile');
};

export { renderNewProfile };
