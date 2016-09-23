$.getJSON('/config_resources/emoji-data.json', db => {
  chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
      let results = search(request.query, db);
      sendResponse({results: results});
  });
});

// Open hello.html when extension installed
chrome.runtime.onInstalled.addListener(function (object) {
    chrome.tabs.create({
      url: chrome.extension.getURL('hello.html')
    });
});
