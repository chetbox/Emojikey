'use strict';

let MAX_RESULTS = 10;
let MAX_HISTORY_RESULTS = 8;
let $emojikey = $('#emojikey');
let $input = $emojikey.find('input[type=text]');
let $results = $emojikey.find('.emojikey-results');
let $status = $emojikey.find('#status');

var lastQuery = '';

function showErrorStatus(message) {
  $status.addClass('error').append(message);
}

function clearStatus() {
  $status.text('').removeClass('error');
}

function handleError(e, messageToDisplay) {
  _gaq.push(['_trackEvent', 'error', e.message, e.filename + ': ' + e.lineno]);
  console.error(e);

  clearStatus();
  showErrorStatus(messageToDisplay || e.message);
}

function refreshTab() {
  clearStatus();
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (tabs.length) {
      chrome.tabs.reload(tabs[0].id);
    } else {
      handleError(new Error('No active tab to refresh'));
    }
  });
  $input.focus();
}

let REFRESH_MESSAGE = [
  'Please ',
  $('<a>').text('refresh').on('click', refreshTab),
  ' the page to use Emojikey'
];

function selectNext() {
  $results.find('.emojikey-selected:not(:last-child)')
    .removeClass('emojikey-selected')
    .next()
    .addClass('emojikey-selected');
}

function selectPrevious() {
  $results.find('.emojikey-selected:not(:first-child)')
    .removeClass('emojikey-selected')
    .prev()
    .addClass('emojikey-selected');
}

$input.on('keydown', e => {
  switch (e.which) {
    case 27: // ESC
      _gaq.push(['_trackEvent', 'keyboard', 'cancel', 'esc']);
      e.preventDefault();
      window.close();
      break;
    case 13: // Return
      _gaq.push(['_trackEvent', 'keyboard', 'select', 'return']);
      e.preventDefault();
      insertAndClose();
      break;
    case 37: // Left arrow
    case 38: // Up arrow
      _gaq.push(['_trackEvent', 'keyboard', 'move', 'left']);
      selectPrevious();
      e.preventDefault();
      break;
    case 39: // Right arrow
    case 40: // Down arrow
      _gaq.push(['_trackEvent', 'keyboard', 'move', 'right']);
      selectNext();
      e.preventDefault();
      break;
    default:
      break;
  }
});

function getSelected() {
  return $results.find('.emojikey-selected');
}

function addToHistory(character) {
  chrome.storage.sync.get('history', data => {
    if (!data || !data.history) {
      data.history = {};
    }
    let characterHistory = data.history[character];
    if (!data.history[character]) {
      let characterHistory = {usages: 0};
      data.history[character] = characterHistory;
    }
    data.history[character].usages += 1;
    data.history[character].lastUsed = new Date().getTime();

    chrome.storage.sync.set(data);
  });
}

function getHistory(callback) {
  chrome.storage.sync.get('history', data => {
    let history = $.map(data.history,
      (info, character) => ({character: character, info: info})
    )
    .sort((a, b) => b.info.lastUsed - a.info.lastUsed)
    .slice(0, MAX_HISTORY_RESULTS);
    callback(history);
  });
}

function selectFirstResult($el, i) {
  return i === 0 ? $el.addClass('emojikey-selected') : $el;
}

function showHistory() {
  $results.addClass('history');
  getHistory(history => $results.empty().append(
    history.map(
      characterInfo => $('<li>').text(characterInfo.character)
    )
    .map(selectFirstResult)
  ));
}

function hideHistory() {
  $results.removeClass('history');
}

function insertAndClose(chars) {
  clearStatus();
  chars = typeof chars !== "undefined" ? chars : getSelected().text();
  addToHistory(chars);
  let message = {insertText: chars};
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, message, success => {
      console.log('success', success);
      if (success) { // The content script always returns true
        window.close();
      } else {
        handleError(chrome.runtime.lastError, REFRESH_MESSAGE);
      }
    });
  });
}

$input.on('keyup', (e) => {
   _gaq.push(['_trackEvent', 'keyboard', 'keyup']);

  let query = $input.val();
  if (query === lastQuery) {
    // Same query as last time, nothing to do
    return;
  }

  _gaq.push(['_trackEvent', 'query', query]);

  lastQuery = query;

  $results.empty();

  if (!query) {
    showHistory();
    return;
  } else {
    hideHistory();
  }

  chrome.runtime.sendMessage({query: query}, response => {
    if (query !== lastQuery) {
      // Query has changed, abort
      return;
    }
    let $searchResults = response.results
      .slice(0, MAX_RESULTS)
      .map(
        result => $('<li>').text(result.chars).click(() => {
          _gaq.push(['_trackEvent', 'mouse', 'select', null, getSelected().index()]);
          insertAndClose(result.chars);
        })
      )
      .map(selectFirstResult);
    $results.append($searchResults);
  });
});

$('a.about').on('click', () => {
  chrome.tabs.create({url: chrome.extension.getURL('hello.html')});
});

chrome.tabs.query({active: true, currentWindow: true}, tabs => {
  chrome.tabs.sendMessage(tabs[0].id, {isReady: ''}, ready => {
    if (!ready) {
      handleError(chrome.runtime.lastError, REFRESH_MESSAGE);
    }
  });
});

showHistory();
