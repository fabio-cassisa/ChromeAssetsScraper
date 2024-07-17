// Define utility functions outside the event listener so they are accessible globally

// Function to check if URL is an image
function isImage(url) {
    const lowerUrl = url.toLowerCase();
    return (
        lowerUrl.endsWith(".jpg") ||
        lowerUrl.endsWith(".jpeg") ||
        lowerUrl.endsWith(".png") ||
        lowerUrl.endsWith(".gif") ||
        lowerUrl.includes(".jpg?") ||
        lowerUrl.includes(".jpeg?") ||
        lowerUrl.includes(".png?") ||
        lowerUrl.includes(".gif?") ||
        lowerUrl.endsWith(".webp") ||
        lowerUrl.endsWith(".tif") ||
        lowerUrl.includes(".webp?") ||
        lowerUrl.includes(".tif?")
    );
}

// Function to check if URL is a video
function isVideo(url) {
    const lowerUrl = url.toLowerCase();
    return (
        lowerUrl.endsWith(".mp4") ||
        lowerUrl.endsWith(".webm") ||
        lowerUrl.endsWith(".ogg") ||
        lowerUrl.endsWith(".avi") ||
        lowerUrl.includes(".mp4?") ||
        lowerUrl.includes(".webm?") ||
        lowerUrl.includes(".ogg?") ||
        lowerUrl.includes(".avi?") ||
        lowerUrl.endsWith(".mov") ||
        lowerUrl.endsWith(".wmv") ||
        lowerUrl.includes(".mov?") ||
        lowerUrl.includes(".wmv?")
    );
}

// Function to check if URL is a font
function isFont(url) {
    const lowerUrl = url.toLowerCase();
    return (
        lowerUrl.endsWith(".woff") ||
        lowerUrl.endsWith(".woff2") ||
        lowerUrl.endsWith(".ttf") ||
        lowerUrl.endsWith(".otf") ||
        lowerUrl.includes(".woff?") ||
        lowerUrl.includes(".woff2?") ||
        lowerUrl.includes(".ttf?") ||
        lowerUrl.includes(".otf?") ||
        lowerUrl.endsWith(".eot") ||
        lowerUrl.includes(".eot?") ||
        lowerUrl.endsWith(".svg") ||
        lowerUrl.includes(".svg?")
    );
}

document.addEventListener("DOMContentLoaded", function () {
    // Event listener for the download button
    document.getElementById("downloadBtn").addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                console.error("No active tabs found.");
                document.getElementById("status").textContent =
                    "Error: No active tab found.";
                return;
            }

            const tabId = tabs[0].id;
            console.log(`Sending message to tab ${tabId}`);

            chrome.tabs.sendMessage(tabId, { action: "getHarData" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error in sendMessage:", chrome.runtime.lastError);
                    document.getElementById(
                        "status"
                    ).textContent = `Error: ${chrome.runtime.lastError.message}`;
                    return;
                }

                if (!response || !response.harData) {
                    console.error("No response or harData found.");
                    document.getElementById("status").textContent =
                        "Error: No data found.";
                    return;
                }

                console.log("Received response from content script:", response);
                const urls = extractUrlsFromHar(response.harData); // Extract URLs from HAR data

                // Use JSZip to create a zip file
                const zip = new JSZip();
                const promises = [];

                // Get checkboxes state
                const imagesChecked = document.getElementById("imagesCheckbox").checked;
                const videosChecked = document.getElementById("videosCheckbox").checked;
                const fontsChecked = document.getElementById("fontsCheckbox").checked;

                // Function to determine if URL should be included based on file type
                function shouldInclude(url) {
                    const lowerUrl = url.toLowerCase();
                    if (imagesChecked && isImage(url)) {
                        return true;
                    }
                    if (videosChecked && isVideo(url)) {
                        return true;
                    }
                    if (fontsChecked && isFont(url)) {
                        return true;
                    }
                    return false;
                }

                // Process each URL to decide inclusion and fetch
                urls.forEach((url) => {
                    if (shouldInclude(url)) {
                        promises.push(
                            fetch(url)
                                .then((response) => {
                                    const fileName = getFileName(url, response); // Get filename based on response or URL
                                    return { fileName, blob: response.blob() };
                                })
                                .then(({ fileName, blob }) => {
                                    return blob.then((blobData) => {
                                        // Add file to zip archive
                                        zip.file(fileName, blobData, { binary: true });
                                    });
                                })
                                .catch((error) => {
                                    console.error(`Failed to fetch ${url}:`, error);
                                })
                        );
                    }
                });

                // When all promises are resolved, generate the zip file
                Promise.all(promises)
                    .then(() => {
                        zip
                            .generateAsync({ type: "blob" })
                            .then((content) => {
                                // Save zip file using chrome.downloads API
                                chrome.downloads.download(
                                    {
                                        url: URL.createObjectURL(content),
                                        filename: "downloaded_assets.zip",
                                    },
                                    (downloadId) => {
                                        if (chrome.runtime.lastError) {
                                            console.error(
                                                "Failed to download zip file:",
                                                chrome.runtime.lastError
                                            );
                                            // Handle failure
                                        } else {
                                            console.log("Zip file download started.");
                                            // No need to track download here, handle it in onChanged listener
                                        }
                                    }
                                );
                            })
                            .catch((zipError) => {
                                console.error("Failed to generate zip file:", zipError);
                            });
                    })
                    .catch((error) => {
                        console.error("Failed to process promises:", error);
                    });

                document.getElementById(
                    "status"
                ).textContent = `Downloading files as a zip...`;
            });
        });
    });
});

// Define the function to extract URLs from HAR data
function extractUrlsFromHar(harData) {
    const entries = harData.log.entries;
    const urls = entries.map((entry) => entry.request.url);
    return urls;
}

// Function to get filename based on URL or response headers
function getFileName(url, response) {
    let fileName = cleanFileName(url); // Implement cleanFileName function as needed

    // Attempt to get filename from Content-Disposition header
    const contentDisposition = response.headers.get("Content-Disposition");
    if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
            fileName = match[1];
        }
    }

    // Fallback to content type if filename not found
    if (!fileName) {
        const contentType = response.headers.get("Content-Type");
        if (contentType) {
            const extension = mimeToExtension(contentType);
            if (extension) {
                fileName += extension;
            }
        }
    }

    // If still no valid filename, generate a unique name based on URL
    if (!fileName.trim()) {
        fileName = `file_${Date.now()}`;
    }

    // Clean up the filename to ensure it ends with the correct extension
    const lowerUrl = url.toLowerCase();
    if (isImage(url)) {
        if (
            !lowerUrl.endsWith(".jpg") &&
            !lowerUrl.endsWith(".jpeg") &&
            !lowerUrl.endsWith(".png") &&
            !lowerUrl.endsWith(".gif") &&
            !lowerUrl.endsWith(".webp") &&
            !lowerUrl.endsWith(".tif")
        ) {
            fileName += ".png"; // Default to .png for images if no valid extension found
        }
    } else if (isVideo(url)) {
        if (
            !lowerUrl.endsWith(".mp4") &&
            !lowerUrl.endsWith(".webm") &&
            !lowerUrl.endsWith(".ogg") &&
            !lowerUrl.endsWith(".avi") &&
            !lowerUrl.endsWith(".mov") &&
            !lowerUrl.endsWith(".wmv")
        ) {
            fileName += ".mp4"; // Default to .mp4 for videos if no valid extension found
        }
    } else if (isFont(url)) {
        if (
            !lowerUrl.endsWith(".woff") &&
            !lowerUrl.endsWith(".woff2") &&
            !lowerUrl.endsWith(".ttf") &&
            !lowerUrl.endsWith(".otf") &&
            !lowerUrl.endsWith(".eot") &&
            !lowerUrl.endsWith(".svg")
        ) {
            fileName += ".woff"; // Default to .woff for fonts if no valid extension found
        }
    }

    // Remove characters that are not allowed in filenames
    fileName = fileName.replace(/[<>:"/\\|?*]/g, "_");

    return fileName;
}

// Function to convert MIME type to file extension
function mimeToExtension(mimeType) {
    switch (mimeType) {
        case "image/jpeg":
            return ".jpg";
        case "image/png":
            return ".png";
        case "image/gif":
            return ".gif";
        case "video/mp4":
            return ".mp4";
        case "video/webm":
            return ".webm";
        case "video/ogg":
            return ".ogg";
        case "video/avi":
            return ".avi";
        case "application/font-woff":
            return ".woff";
        case "application/font-woff2":
            return ".woff2";
        case "application/x-font-ttf":
            return ".ttf";
        case "application/x-font-opentype":
            return ".otf";
        default:
            return "";
    }
}

// Define the function to clean up file names
function cleanFileName(url) {
    let fileName = url.substring(url.lastIndexOf("/") + 1);

    // If the filename is empty (no file name in URL), generate a unique name
    if (!fileName.trim()) {
        fileName = `file_${Date.now()}`;
    }

    // Remove characters that are not allowed in filenames
    fileName = fileName.replace(/[<>:"/\\|?*]/g, "_");

    return fileName;
}
