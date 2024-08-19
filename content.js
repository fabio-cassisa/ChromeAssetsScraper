// Checking if injection has been done correctly in the page when loaeded: 
console.log("Content script loaded on this page.");

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
function rgbToHex(rgb) {
  const rgba = rgb.match(/\d+/g);
  let hex = "#";
  
  for (let i = 0; i < 3; i++) {
      const hexComponent = parseInt(rgba[i], 10).toString(16).padStart(2, '0');
      hex += hexComponent;
  }
  
  return hex;
}

function extractColors() {
  const colorsMap = {};

  document.querySelectorAll('*').forEach(element => {
      const computedStyles = window.getComputedStyle(element);
      const color = computedStyles.color;
      const backgroundColor = computedStyles.backgroundColor;

      const hexColor = rgbToHex(color);
      const hexBackgroundColor = rgbToHex(backgroundColor);

      if (hexColor && hexColor !== '#00000000') {
          colorsMap[hexColor] = (colorsMap[hexColor] || 0) + 1;
      }

      if (hexBackgroundColor && hexBackgroundColor !== '#00000000') {
          colorsMap[hexBackgroundColor] = (colorsMap[hexBackgroundColor] || 0) + 1;
      }
  });

  const sortedColors = Object.entries(colorsMap)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5)
      .map(([color]) => color);

  return sortedColors;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getColors') {
      const topColors = extractColors();
      sendResponse({ colors: topColors });
  }
});
