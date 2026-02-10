// Root admin page logic
// Handles game access toggles and user deletion.

(function () {
  const csrf =
    document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute('content') || '';
  document
    .querySelectorAll('.game-toggle input[type="checkbox"]')
    .forEach(function (cb) {
      cb.addEventListener('change', function () {
        const userId = this.dataset.userId;
        const gameId = this.dataset.gameId;
        const enabled = this.checked;
        fetch('/admin/game-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          body: JSON.stringify({
            user_id: parseInt(userId, 10),
            game_id: gameId,
            enabled: enabled,
          }),
        })
          .then((r) => {
            if (!r.ok) {
              this.checked = !enabled;
            }
          })
          .catch(() => {
            this.checked = !enabled;
          });
      });
    });
  document.querySelectorAll('.btn-delete-user').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const userId = this.dataset.userId;
      const username = this.dataset.username;
      if (
        !userId ||
        !confirm('Delete user "' + username + '"? This cannot be undone.')
      )
        return;
      fetch('/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ user_id: parseInt(userId, 10) }),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (data.success) window.location.reload();
            else alert(data.error || 'Failed to delete user');
          });
        })
        .catch(function () {
          alert('Request failed');
        });
    });
  });
})();
