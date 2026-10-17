  function alignDropdowns() {
    const header = document.querySelector('.top-nav');
    const headerLeft = header.getBoundingClientRect().left;
    header.querySelectorAll('.nav-dropdown').forEach(dropdown => {
      const trigger = dropdown.querySelector('.nav-link');
      const menu = dropdown.querySelector('.dropdown-menu');
      // Anchor the first letter to its trigger; long labels wrap instead of moving the column.
      const triggerLeft = trigger.getBoundingClientRect().left;
      const left = triggerLeft - headerLeft - menu.clientLeft;
      const width = Math.max(1, header.getBoundingClientRect().right - triggerLeft - menu.clientLeft - 8);
      menu.style.setProperty('--menu-x', `${left}px`);
      menu.style.setProperty('--menu-width', `${width}px`);
    });
  }

  // Recheck at open time and after fonts load, including Safari's late layout updates.
  document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
    dropdown.addEventListener('pointerenter', alignDropdowns);
    dropdown.addEventListener('focusin', alignDropdowns);
    dropdown.addEventListener('touchstart', alignDropdowns, { passive: true });
  });
  document.fonts?.ready.then(alignDropdowns);
