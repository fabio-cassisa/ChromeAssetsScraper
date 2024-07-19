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
        lowerUrl.includes(".tif?") ||
        lowerUrl.endsWith(".svg") ||
        lowerUrl.includes(".svg?")
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
        lowerUrl.includes(".eot?")
    );
}

document.addEventListener("DOMContentLoaded", function () {
    // Get all the elements by their IDs:
    const downloadBtn = document.getElementById("downloadBtn");
    const statusElem = document.getElementById("status");
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar").firstElementChild;
    const progressText = document.getElementById("progress-text");
    const summaryElem = document.getElementById("summary");

    // Event listener for the download button
    downloadBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                console.error("No active tabs found.");
                statusElem.textContent = "Error: No active tab found.";
                return;
            }

            const tabId = tabs[0].id;
            console.log(`Sending message to tab ${tabId}`);

            chrome.tabs.sendMessage(tabId, { action: "getHarData" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error in sendMessage:", chrome.runtime.lastError);
                    statusElem.textContent = `Error: ${chrome.runtime.lastError.message}`;
                    return;
                }

                if (!response || !response.harData) {
                    console.error("No response or harData found.");
                    statusElem.textContent = "Error: No data found.";
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

                // Initialize progress
                progressContainer.style.display = "block";
                summaryElem.style.display = "none";
                let completed = 0;
                let successful = 0;
                let failed = 0;
                const countByType = { images: 0, videos: 0, fonts: 0 };

                function updateProgress() {
                    const progress = (completed / urls.length) * 100;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `${Math.round(progress)}%`;
                }

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
                                        completed++;
                                        successful++;
                                        if (isImage(url)) countByType.images++;
                                        else if (isVideo(url)) countByType.videos++;
                                        else if (isFont(url)) countByType.fonts++;
                                        updateProgress();
                                    });
                                })
                                .catch((error) => {
                                    console.error(`Failed to fetch ${url}:`, error);
                                    completed++;
                                    failed++;
                                    updateProgress();
                                })
                        );
                    }  else {
                        completed++;
                        updateProgress();
                    }
                });

                // When all promises are resolved, generate the zip file
                Promise.all(promises)
                    .then(() => {
                        zip
                            .generateAsync({ type: "blob" })
                            .then((content) => {
                                const blobUrl = URL.createObjectURL(content);
                                // Save zip file using chrome.downloads API
                                chrome.downloads.download(
                                    {
                                        url: blobUrl,
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

                                        // Revoke the blob URL to free memory:
                                        URL.revokeObjectURL(blobUrl);
                                    }
                                );
                            })
                            .catch((zipError) => {
                                console.error("Failed to generate zip file:", zipError);
                            });
                    })
                    .catch((error) => {
                        console.error("Failed to process promises:", error);
                    })
                    .finally(() => {
                        progressContainer.style.display = "none";
                        summaryElem.style.display = "block";
                        summaryElem.innerHTML = `
                            <p>Total files: ${successful + failed}</p>
                            <p>Successful: ${successful}</p>
                            <p>Failed: ${failed}</p>
                            <p>Images: ${countByType.images}</p>
                            <p>Videos: ${countByType.videos}</p>
                            <p>Fonts: ${countByType.fonts}</p>
                        `;
                        statusElem.textContent = `Download complete. ${successful} files downloaded, ${failed} failed.`;
                    });

                statusElem.textContent = `Downloading files as a zip...`;
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
            fileName += determineExtensionFromContentType(url, contentType);
        }
    }

    // If still no valid filename, generate a unique name based on URL
    if (!fileName.trim()) {
        fileName = `file_${Date.now()}`;
    }

    // Clean up the filename to ensure it ends with the correct extension
    fileName = ensureCorrectExtension(url, fileName);

    // Remove characters that are not allowed in filenames
    fileName = fileName.replace(/[<>:"/\\|?*]/g, "_");

    return fileName;
}

function determineExtensionFromContentType(url, contentType) {
    const extension = mimeToExtension(contentType);
    if (extension) {
        // Check specific cases for SVG, GIF, WebP
        if (isSVG(url) && extension !== ".svg") {
            return ".svg";
        } else if (isGIF(url) && extension !== ".gif") {
            return ".gif";
        } else if (isWebP(url) && extension !== ".webp") {
            return ".webp";
        } else {
            return extension;
        }
    }
    return "";
}

function ensureCorrectExtension(url, fileName) {
    const lowerUrl = url.toLowerCase();
    const hasValidExtension = (fileName) => {
        const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.svg', '.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext);
    };

    if (isImage(url)) {
        if (!hasValidExtension(fileName)) {
            fileName += ".png"; // Default to .png for images if no valid extension found
        }
    } else if (isVideo(url)) {
        if (!hasValidExtension(fileName)) {
            fileName += ".mp4"; // Default to .mp4 for videos if no valid extension found
        }
    } else if (isFont(url)) {
        if (!hasValidExtension(fileName)) {
            fileName += ".woff"; // Default to .woff for fonts if no valid extension found
        }
    }
    return fileName;
}

function isSVG(url) {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith(".svg") ||
        lowerUrl.includes(".svg?");
}

function isGIF(url) {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith(".gif") ||
        lowerUrl.includes(".gif?");
}

function isWebP(url) {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith(".webp") ||
        lowerUrl.includes(".webp?");
}

// Function to convert MIME type to file extension
function mimeToExtension(mimeType) {
    const mimeMap = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/tiff": ".tif",
        "image/svg+xml": ".svg",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/ogg": ".ogg",
        "video/avi": ".avi",
        "video/mov": ".mov",
        "video/wmv": ".wmv",
        "font/woff": ".woff",
        "font/woff2": ".woff2",
        "font/ttf": ".ttf",
        "font/otf": ".otf",
        "application/vnd.ms-fontobject": ".eot"
    };
    return mimeMap[mimeType] || "";
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
