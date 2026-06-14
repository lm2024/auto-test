$(document).ready(function () {
  const sidebar = document.querySelector('#tree-section'),
    logo = document.querySelector('.KR-logo'),
    toggle = document.querySelector('#toggle');

  function sidebarAction() {
    const collapsed = sidebar.classList.toggle('collapsed');

    if (collapsed) {
      logo.querySelector('#logo_kr_full').style.display = 'none';
      logo.querySelector('#logo_kr_icon').style.display = 'block';
      logo.classList.add('collapsed');
      toggle.setAttribute('src', '../panel/icons/fab-collapsed.svg');

      $('#result-container').css('display', 'none');

      $(
        '#testSuiteDropdown, #dynamic-dropdown, #testDataDropdown, #extensionDropdown, #profileDropdown'
      ).css('display', 'none');
      $(
        '#testCase-container, #testCase-container-dynamic, #testData-container, #extensionScript-container, #profile-container, #more-options'
      ).addClass('tooltip');

      $('#testCase-grid').css('display', 'none');
      $('#testCase-filter').css('display', 'none');
      $('#data-files-list').css('display', 'none');
      $('#extensions-list').css('display', 'none');
      $('#profile-list').css('display', 'none');
    } else {
      logo.querySelector('#logo_kr_full').style.display = 'block';
      logo.querySelector('#logo_kr_icon').style.display = 'none';
      logo.classList.remove('collapsed');
      toggle.setAttribute('src', '../panel/icons/fab-expanded.svg');

      $(
        '#testSuiteDropdown, #dynamic-dropdown, #testDataDropdown, #extensionDropdown, #profileDropdown'
      ).css('display', 'block');
      $(
        '#testCase-container, #testCase-container-dynamic, #testData-container, #extensionScript-container, #profile-container, #more-options'
      ).removeClass('tooltip');

      const testSuiteDropdown = $('#testSuiteDropdown')
        .find('img')
        .attr('src');
      if (testSuiteDropdown.includes('arrow-on')) {
        $('#testCase-grid').css('display', 'block');
        $('#result-container').css('display', 'flex');
      }

      const dynamicDropdown = $('#dynamic-dropdown').find('img').attr('src');
      if (dynamicDropdown.includes('arrow-on')) {
        $('#testCase-filter').css('display', 'block');
      }

      const testDataDropdown = $('#testDataDropdown').find('img').attr('src');
      if (testDataDropdown.includes('arrow-on')) {
        $('#data-files-list').css('display', 'flex');
      }

      const extensionDropdown = $('#extensionDropdown')
        .find('img')
        .attr('src');
      if (extensionDropdown.includes('arrow-on')) {
        $('#extensions-list').css('display', 'flex');
      }

      const profileDropdown = $('#profileDropdown').find('img').attr('src');
      if (profileDropdown.includes('arrow-on')) {
        $('#profile-list').css('display', 'flex');
      }
    }
  }

  toggle.addEventListener('click', () => {
    sidebarAction();
  });

  $(
    '#testCase-container, #testCase-container-dynamic, #testData-container, #extensionScript-container, #profile-container'
  ).click(() => {
    const isCollapsed = sidebar.classList.contains('collapsed');
    if (!isCollapsed) return;

    sidebarAction();
  });

  $('#more-options').click(() => {
    const dropdown = $('#more-options-open-dropdown');
    if ($(dropdown).css('display') === 'block') {
      $(dropdown).css('display', 'none');
      $('#more-options').css('background-color', '');
      $('#more-options').css('color', '');
      $('#more-options-icon').attr(
        'src',
        '/katalon/images/SVG/more-options.svg'
      );
    } else {
      $(dropdown).css('display', 'block');
      $('#more-options').css('background-color', '#276EF1');
      $('#more-options').css('color', '#FFFFFF');
      $('#more-options-icon').attr(
        'src',
        '/katalon/images/SVG/inverted-more-options.svg'
      );
    }
  });

  $('#tree-section, .KR-logo')
    .mouseover(async function () {
      $(toggle).css('display', 'block');

      $('#workspace').removeClass('hide-scrollbar');
      $('#workspace').addClass('show-scrollbar');
      $('#workspace .dropdown').css('opacity', '1');
    })
    .mouseleave(async function () {
      $(toggle).css('display', 'none');

      $('#workspace').addClass('hide-scrollbar');
      $('#workspace').removeClass('show-scrollbar');
      $('#workspace .dropdown').css('opacity', '0');
    });
});
