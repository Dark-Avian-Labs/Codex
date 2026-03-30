(function () {
  try {
    var root = document.documentElement;
    function readCookie(name) {
      var part = document.cookie
        .split(';')
        .map(function (p) {
          return p.trim();
        })
        .find(function (p) {
          return p.substring(0, name.length + 1) === name + '=';
        });
      return part ? part.slice(name.length + 1) : '';
    }
    var theme = readCookie('dal.theme.mode').trim();
    if (theme !== 'light' && theme !== 'dark') {
      try {
        theme = (localStorage.getItem('dal.theme.mode') || '').trim();
      } catch {
        theme = '';
      }
    }
    if (theme !== 'light' && theme !== 'dark') theme = 'dark';
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    root.classList.remove('dark');
    if (theme === 'dark') root.classList.add('dark');

    var ui = readCookie('dal.ui.style').trim();
    if (ui !== 'prism' && ui !== 'shadow') {
      try {
        ui = (localStorage.getItem('dal.ui.style') || '').trim();
      } catch {
        ui = '';
      }
    }
    if (ui !== 'prism' && ui !== 'shadow') ui = 'prism';
    root.classList.remove('ui-prism', 'ui-shadow');
    root.classList.add('ui-' + ui);
  } catch {}
})();
