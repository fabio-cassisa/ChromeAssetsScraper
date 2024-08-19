// HAR data functionalities:
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

// CSS colorPicker functionalities:
function extractColors() {
  const colorsMap = {};

  // Collect computed styles from all elements
  document.querySelectorAll('*').forEach(element => {
      const computedStyles = window.getComputedStyle(element);
      const color = computedStyles.color;
      const backgroundColor = computedStyles.backgroundColor;

      if (color && color !== 'rgba(0, 0, 0, 0)') {
          colorsMap[color] = (colorsMap[color] || 0) + 1;
      }

      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
          colorsMap[backgroundColor] = (colorsMap[backgroundColor] || 0) + 1;
      }
  });

  // Sort colors by frequency and get top 5
  const sortedColors = Object.entries(colorsMap)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5)
      .map(([color]) => color);

  return sortedColors;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getHarData') {
      // Handle existing HAR data fetching logic
  } else if (message.action === 'getColors') {
      const topColors = extractColors();
      sendResponse({ colors: topColors });
  }
});
