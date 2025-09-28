(function () {
  "use strict";

  let currentSpeed = 1.5;
  let speedRules = {};
  let regexRules = [];
  let globalSpeed = 1.5;
  let currentZoom = 100;

  // Function to determine speed based on URL
  function getSpeedForUrl() {
    const hostname = window.location.hostname;
    const fullUrl = window.location.href;

    // First check regex patterns (higher priority)
    for (const rule of regexRules) {
      try {
        const regex = new RegExp(rule.pattern);
        if (regex.test(fullUrl) || regex.test(hostname)) {
          return rule.speed;
        }
      } catch (e) {
        console.error("Invalid regex pattern:", rule.pattern);
      }
    }

    // Then check exact domain rules
    if (speedRules[hostname]) {
      return speedRules[hostname];
    }

    // Default to global speed
    return globalSpeed;
  }

  // Load settings from storage (only speed settings, not zoom)
  chrome.storage.sync.get(
    ["speedRules", "globalSpeed", "regexRules"],
    (result) => {
      speedRules = result.speedRules || {};
      regexRules = result.regexRules || [];
      globalSpeed = result.globalSpeed || 1.5;

      // Zoom always starts at 100% (no zoom) - not saved between sessions
      currentZoom = 100;

      // Determine speed for current site
      currentSpeed = getSpeedForUrl();

      // Apply initial speed only (no zoom by default)
      setSpeed();

      // Force apply speed after a short delay to ensure it takes effect
      setTimeout(setSpeed, 100);
      setTimeout(setSpeed, 500);
    },
  );

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "setSpeed") {
      currentSpeed = request.speed;
      setSpeed();
    } else if (request.action === "updateRules") {
      speedRules = request.rules;
      globalSpeed = request.globalSpeed;
      currentSpeed = getSpeedForUrl();
      setSpeed();
    } else if (request.action === "updateRegexRules") {
      regexRules = request.regexRules;
      currentSpeed = getSpeedForUrl();
      setSpeed();
    } else if (request.action === "setZoom") {
      currentZoom = request.zoom;
      applyZoom();
    } else if (request.action === "getZoom") {
      // Return current zoom level to popup
      sendResponse({ zoom: currentZoom });
    } else if (request.action === "detectLetterbox") {
      // Manual letterbox detection triggered from popup
      const videos = document.querySelectorAll("video");
      if (videos.length === 0) {
        sendResponse({ error: "No video found on this page" });
        return;
      }

      let detectedZoom = null;
      for (const video of videos) {
        detectedZoom = detectLetterboxing(video);
        if (detectedZoom) {
          currentZoom = detectedZoom;
          applyZoom();
          sendResponse({ zoom: detectedZoom });
          return;
        }
      }

      sendResponse({ error: "No letterboxing detected in videos" });
    }
  });

  // Listen for storage changes (only for speed settings)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.speedRules) {
        speedRules = changes.speedRules.newValue || {};
      }
      if (changes.globalSpeed) {
        globalSpeed = changes.globalSpeed.newValue || 1.5;
      }
      if (changes.regexRules) {
        regexRules = changes.regexRules.newValue || [];
      }
      // No longer listening for customZoomValue changes
      currentSpeed = getSpeedForUrl();
      setSpeed();
    }
  });

  function setSpeed() {
    document.querySelectorAll("video, audio").forEach((el) => {
      el.playbackRate = currentSpeed;
      // Also set defaultPlaybackRate to make it more persistent
      el.defaultPlaybackRate = currentSpeed;
    });
  }

  // Detect letterboxing (black bars) in video
  function detectLetterboxing(video) {
    if (!video.videoWidth || !video.videoHeight) return null;

    try {
      // Create a canvas to sample the video
      const canvas = document.createElement("canvas");
      // Add willReadFrequently for better performance with multiple getImageData calls
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      // Use smaller dimensions for performance
      const sampleWidth = 320;
      const sampleHeight = Math.floor(
        (video.videoHeight / video.videoWidth) * sampleWidth,
      );

      canvas.width = sampleWidth;
      canvas.height = sampleHeight;

      // Draw current video frame
      ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight);

      // Sample pixels from top and bottom edges
      const topData = ctx.getImageData(0, 0, sampleWidth, 5);
      const bottomData = ctx.getImageData(0, sampleHeight - 5, sampleWidth, 5);

      // Check if edges are mostly black
      function isBlack(imageData) {
        const pixels = imageData.data;
        let blackPixels = 0;
        const threshold = 30; // RGB values below this are considered black

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          if (r < threshold && g < threshold && b < threshold) {
            blackPixels++;
          }
        }

        return blackPixels / (pixels.length / 4) > 0.9; // 90% black pixels
      }

      const hasTopBar = isBlack(topData);
      const hasBottomBar = isBlack(bottomData);

      if (hasTopBar && hasBottomBar) {
        // Detect approximate aspect ratio based on black bars
        // Sample middle of video to find actual content area
        let contentTop = 0;
        let contentBottom = sampleHeight;

        // Find where content starts from top
        for (let y = 0; y < sampleHeight / 2; y += 2) {
          const rowData = ctx.getImageData(0, y, sampleWidth, 1);
          if (!isBlack(rowData)) {
            contentTop = y;
            break;
          }
        }

        // Find where content ends from bottom
        for (let y = sampleHeight - 1; y > sampleHeight / 2; y -= 2) {
          const rowData = ctx.getImageData(0, y, sampleWidth, 1);
          if (!isBlack(rowData)) {
            contentBottom = y;
            break;
          }
        }

        const contentHeight = contentBottom - contentTop;
        const detectedAspectRatio = sampleWidth / contentHeight;

        // Determine zoom level based on detected aspect ratio
        if (detectedAspectRatio > 2.2) {
          return 131; // 21:9 content
        } else if (detectedAspectRatio > 1.9) {
          return 120; // Slightly wider than 16:9
        }
      }

      return null; // No letterboxing detected
    } catch (e) {
      console.error("Error detecting letterboxing:", e);
      return null;
    }
  }

  function applyZoom() {
    document.querySelectorAll("video").forEach((video) => {
      // Skip if already has the correct zoom to avoid reapplying
      if (video.dataset.appliedZoom === String(currentZoom)) {
        return;
      }

      // Reset all styles first
      video.style.removeProperty("transform");
      video.style.removeProperty("transform-origin");
      video.style.removeProperty("object-fit");

      if (currentZoom === 100) {
        // 16:9 - Original aspect ratio, no changes
        delete video.dataset.appliedZoom;
        delete video.dataset.autoDetected;

        // Reset parent overflow
        const parent = video.parentElement;
        if (parent && parent.dataset.zoomModified === "true") {
          parent.style.removeProperty("overflow");
          delete parent.dataset.zoomModified;
        }
      } else {
        // Apply zoom - scale the video to crop it
        const scale = currentZoom / 100;
        video.style.transform = `scale(${scale})`;
        video.style.transformOrigin = "center center";
        video.dataset.appliedZoom = String(currentZoom);

        // Hide overflow on parent
        const parent = video.parentElement;
        if (parent) {
          parent.style.overflow = "hidden";
          parent.dataset.zoomModified = "true";
        }
      }
    });
  }

  // Auto-detect letterboxing when video starts playing
  function enableAutoDetection() {
    document.addEventListener(
      "loadedmetadata",
      (e) => {
        if (e.target.tagName === "VIDEO" && !e.target.dataset.autoChecked) {
          e.target.dataset.autoChecked = "true";

          // Wait a bit for video to load first frame
          setTimeout(() => {
            const detectedZoom = detectLetterboxing(e.target);
            if (detectedZoom && currentZoom === 100) {
              // Only auto-zoom if user hasn't manually set a zoom
              currentZoom = detectedZoom;
              e.target.dataset.autoDetected = "true";
              applyZoom();

              // Notify popup about auto-detection
              chrome.runtime
                .sendMessage({
                  action: "autoZoomDetected",
                  zoom: detectedZoom,
                })
                .catch(() => {});
            }
          }, 500);
        }
      },
      true,
    );
  }

  // Initial setup
  setSpeed();
  // Auto-detection disabled - now triggered manually via button
  // enableAutoDetection();

  // MutationObserver to handle dynamically added videos
  const observer = new MutationObserver(() => {
    // Apply speed to new videos
    setSpeed();

    // Only reapply zoom if zoom is active
    if (currentZoom !== 100) {
      // Apply zoom to new videos only
      document.querySelectorAll("video").forEach((video) => {
        if (!video.dataset.appliedZoom) {
          const scale = currentZoom / 100;
          video.style.transform = `scale(${scale})`;
          video.style.transformOrigin = "center center";
          video.dataset.appliedZoom = String(currentZoom);

          const parent = video.parentElement;
          if (parent && parent.dataset.zoomModified !== "true") {
            parent.style.overflow = "hidden";
            parent.dataset.zoomModified = "true";
          }
        }
      });
    }
  });

  // Start observing
  function startObserving() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Try to start observing immediately
  startObserving();

  // Also try when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserving);
  }

  // Fallback for edge cases
  if (!document.body) {
    const checkBody = setInterval(() => {
      if (document.body) {
        startObserving();
        clearInterval(checkBody);
      }
    }, 100);
  }

  // Handle play events
  document.addEventListener(
    "play",
    (e) => {
      if (e.target.tagName === "VIDEO" || e.target.tagName === "AUDIO") {
        e.target.playbackRate = currentSpeed;
        e.target.defaultPlaybackRate = currentSpeed;

        // Apply zoom to video if needed
        if (e.target.tagName === "VIDEO" && currentZoom !== 100) {
          const video = e.target;
          if (
            !video.dataset.appliedZoom ||
            video.dataset.appliedZoom !== String(currentZoom)
          ) {
            const scale = currentZoom / 100;
            video.style.transform = `scale(${scale})`;
            video.style.transformOrigin = "center center";
            video.dataset.appliedZoom = String(currentZoom);

            const parent = video.parentElement;
            if (parent && parent.dataset.zoomModified !== "true") {
              parent.style.overflow = "hidden";
              parent.dataset.zoomModified = "true";
            }
          }
        }
      }
    },
    true,
  );

  // Also handle loadstart and canplay events to ensure speed is set early
  ["loadstart", "canplay", "loadeddata"].forEach((eventName) => {
    document.addEventListener(
      eventName,
      (e) => {
        if (e.target.tagName === "VIDEO" || e.target.tagName === "AUDIO") {
          e.target.playbackRate = currentSpeed;
          e.target.defaultPlaybackRate = currentSpeed;
        }
      },
      true,
    );
  });

  // Periodic check for speed only (not zoom to avoid flickering)
  setInterval(() => {
    document.querySelectorAll("video, audio").forEach((el) => {
      if (el.playbackRate !== currentSpeed) {
        el.playbackRate = currentSpeed;
      }
    });
  }, 1000);
})();
