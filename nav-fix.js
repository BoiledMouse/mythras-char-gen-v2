// Navigation fix script
// This script attaches click handlers to the navigation buttons and toggles
// the visibility of sections. It ensures that navigation works even if
// the main script fails to register the handlers due to an error in
// initialisation.  It runs after the DOM is fully loaded.

document.addEventListener('DOMContentLoaded', function () {
  // Select all navigation buttons and the content sections
  const navButtons = document.querySelectorAll('.navbtn');
  const sections = document.querySelectorAll('section');

  /**
   * Show the section with the given id and hide all others.
   * @param {string} target The id of the section to activate
   */
  function activateSection(target) {
    sections.forEach(sec => {
      if (sec.id === target) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });
  }

  /**
   * Click handler for navigation buttons.  Removes the 'active' class from
   * all buttons, adds it to the clicked button, and displays the associated
   * section.
   * @param {MouseEvent} ev The click event
   */
  function handleNavClick(ev) {
    ev.preventDefault();
    const btn = ev.currentTarget;
    const target = btn.dataset.target;
    // Update active button styles
    navButtons.forEach(nb => nb.classList.remove('active'));
    btn.classList.add('active');
    // Show the corresponding section
    activateSection(target);
  }

  // Attach the handler to each nav button
  navButtons.forEach(btn => btn.addEventListener('click', handleNavClick));
});