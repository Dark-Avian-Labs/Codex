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
      if (!part) return '';
      try {
        return decodeURIComponent(part.slice(name.length + 1));
      } catch {
        return '';
      }
    }
    var theme = readCookie('dal.theme.mode').trim();
    if (theme !== 'light' && theme !== 'dark') {
      try {
        theme = (localStorage.getItem('dal.theme.mode') || '').trim();
      } catch (e) {
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
          console.warn('Unable to read theme from localStorage; falling back to default.', e);
        }
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
      } catch (e) {
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
          console.warn('Unable to read UI style from localStorage; falling back to default.', e);
        }
        ui = '';
      }
    }
    if (ui !== 'prism' && ui !== 'shadow') ui = 'prism';
    root.classList.remove('ui-prism', 'ui-shadow');
    root.classList.add('ui-' + ui);
  } catch {}
})();
