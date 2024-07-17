chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getHarData") {
    const harData = collectHarData();
    setTimeout(() => {
      sendResponse({ harData: harData });
    }, 0); // Ensure sendResponse is called asynchronously
    return true; // Indicates that sendResponse will be called asynchronously
  }
});

function collectHarData() {
  const performanceEntries = performance.getEntriesByType("resource");
  const harEntries = performanceEntries.map(entry => {
    return {
      request: {
        url: entry.name
      },
      response: {
        content: {
          mimeType: entry.initiatorType
        }
      }
    };
  });
  return { log: { entries: harEntries } };
}
