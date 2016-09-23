$.getJSON('/config_resources/emoji-data.json', db => {
  chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
      let results = search(request.query, db);
      sendResponse({results: results});
  });
});

let installedVersion = localStorage['version'];

// Open hello.html when extension installed
if (!installedVersion) {
  chrome.runtime.onInstalled.addListener(function (object) {
    chrome.tabs.create({
      url: chrome.extension.getURL('hello.html')
    });
  });
}

localStorage['version'] = chrome.app.getDetails().version;
