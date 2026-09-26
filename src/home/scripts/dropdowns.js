  function alignDropdowns() {
    const header = document.querySelector('.top-nav');
    const headerLeft = header.getBoundingClientRect().left;
    header.querySelectorAll('.nav-dropdown').forEach(dropdown => {
      const trigger = dropdown.querySelector('.nav-link');
      const menu = dropdown.querySelector('.dropdown-menu');
      const contentWidth = menu.querySelector('.dropdown-inner').offsetWidth;
      const triggerLeft = trigger.getBoundingClientRect().left - headerLeft;
      const left = Math.max(16, Math.min(triggerLeft, header.clientWidth - contentWidth - 16));
      menu.style.setProperty('--menu-x', `${left}px`);
    });
  }

