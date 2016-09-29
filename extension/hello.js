'use strict';

let metaKey = document.querySelector('.meta.key');

function displayLabelForKey(chromeKey) {
  if (chromeKey === 'Command') {
    return '\u2318';
  }
  return chromeKey;
}

// Display shortcut key on page
chrome.commands.getAll(commands => {
  commands.forEach(command => {
    if (command.name === '_execute_browser_action' && command.shortcut) {
      let $shortcut = $('<p>').addClass('shortcut');
      command.shortcut
        .split('+')
        .map(key =>
          $('<span>')
            .text(displayLabelForKey(key))
            .addClass('key')
            .addClass(key)
        )
        .forEach((key, i, keys) => {
          $shortcut.append(
            key,
            (i < keys.length - 1) ? '+' : null
          );
        });
      $('#shortcuts').append($shortcut);
    }
  });
});

let $textField = $('input[type=text]');
$textField.on('keydown keyup focus', e => {
  $('#shortcuts .key.Command')[e.metaKey  ? 'addClass' : 'removeClass']('pressed');
  $('#shortcuts .key.Ctrl')   [e.ctrlKey  ? 'addClass' : 'removeClass']('pressed');
  $('#shortcuts .key.Shift')  [e.shiftKey ? 'addClass' : 'removeClass']('pressed');
});
$textField.focus();
