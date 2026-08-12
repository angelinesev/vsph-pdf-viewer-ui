(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('client') !== '1') {
    return;
  }

  function hideClientControls() {
    var selectors = [
      '#openFile',
      '#secondaryOpenFile',
      '#download',
      '#secondaryDownload',
      '#viewBookmark',
      '#scrollVertical',
      '#scrollHorizontal',
      '#scrollWrapped',
      '#bookFlip',
    ];

    selectors.forEach(function (selector) {
      var el = document.querySelector(selector);
      if (el) {
        el.setAttribute('hidden', 'true');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideClientControls);
  } else {
    hideClientControls();
  }
})();
