// ==UserScript==
// @name        Instagram Power Mode
// @namespace   xi72yow
// @match       https://www.instagram.com/*
// @grant       none
// @version 1.1
// @author      xi72yow
// @description Reels (and other videos) in fullscreen mode Swipe Reels with Arrow Keys (Up/Down), Mute/Unmute with M
// @downloadURL https://raw.githubusercontent.com/xi72yow/WebTweaks/master/scripts/insta-power.user.js
// @updateURL   https://raw.githubusercontent.com/xi72yow/WebTweaks/master/scripts/insta-power.user.js
// ==/UserScript==

window.isFullScreen = window.matchMedia("(display-mode: fullscreen)").matches;

window
  .matchMedia("(display-mode: fullscreen)")
  .addEventListener("change", ({ matches }) => {
    if (matches) {
      window.isFullScreen = true;
    } else {
      window.isFullScreen = false;
    }
  });

function playingVideoFullscreen() {
  const videoElements = document.querySelectorAll("video");

  videoElements.forEach((videoElement) => {
    if (videoElement && !videoElement.paused) {
      if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen();
      } else if (videoElement.mozRequestFullScreen) {
        videoElement.mozRequestFullScreen();
      } else if (videoElement.webkitRequestFullscreen) {
        videoElement.webkitRequestFullscreen();
      } else if (videoElement.msRequestFullscreen) {
        videoElement.msRequestFullscreen();
      }
    }
  });
}

function toggleMute() {
  const unMuteSvg =
    document.querySelector('[aria-label="Ton stummgeschaltet"]') ||
    document.querySelector('[aria-label="Audio is muted"]');
  const muteSvg =
    document.querySelector('[aria-label="Audio wird abgespielt"]') ||
    document.querySelector('[aria-label="Audio is playing"]');

  if (unMuteSvg) {
    unMuteSvg.parentElement.click();
  } else if (muteSvg) {
    muteSvg.parentElement.click();
  }
}

document.addEventListener("keydown", (event) => {
  if (
    event.key === "f" ||
    event.key === "ArrowUp" ||
    event.key === "ArrowDown"
  ) {
    setTimeout(() => {
      if (
        (!window.isFullScreen && event.key === "f") ||
        (window.isFullScreen &&
          (event.key === "ArrowUp" || event.key === "ArrowDown"))
      )
        playingVideoFullscreen();
    }, 500);
  }

  if (event.key === "m") {
    toggleMute();
  }

  if (event.key === "ArrowUp") {
    const nextSvg =
      document.querySelector('[aria-label="Weiter"]') ||
      document.querySelector('[aria-label="Next"]');
    if (nextSvg) {
      nextSvg.parentElement.click();
    }
  }

  if (event.key === "ArrowDown") {
    const previousSvg =
      document.querySelector('[aria-label="Zurück"]') ||
      document.querySelector('[aria-label="Go back"]');
    if (previousSvg) {
      previousSvg.parentElement.click();
    }
  }
});
