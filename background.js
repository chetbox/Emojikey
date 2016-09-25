'use strict';

// Set up search
$.getJSON('/config_resources/emoji-data.json', db => {
  chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
      sendResponse({results: search(request.query, db)});
  });
});

let installedVersion = localStorage['version'];
let currentVersion = chrome.app.getDetails().version;
localStorage['version'] = currentVersion;

// Open hello.html when extension installed
if (!installedVersion) {
  chrome.runtime.onInstalled.addListener(object => {
    chrome.tabs.create({url: chrome.extension.getURL('hello.html')});
  });
}
