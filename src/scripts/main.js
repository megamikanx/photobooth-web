// DOM references
const video = document.querySelector("#camera");
const canvas = document.querySelector("#canvas");
const frameOverlay = document.querySelector("#frameOverlay");
const startButton = document.querySelector("#startCamera");
const captureButton = document.querySelector("#capturePhoto");
const frameList = document.querySelector("#frameList");
const captureCount = document.querySelector("#captureCount");
const captureMax = document.querySelector("#captureMax");
const captureScreen = document.querySelector("#captureScreen");
const selectionScreen = document.querySelector("#selectionScreen");
const thumbnailGrid = document.querySelector("#thumbnailGrid");
const strip = document.querySelector(".strip");
const stripSlots = document.querySelectorAll(".strip-slot");
const downloadStripButton = document.querySelector("#downloadStrip");
const startOverButton = document.querySelector("#startOver");

// App configuration
const MAX_PHOTOS = 8;
const STRIP_SLOTS = 4;
const FRAME_SETS = {
  "set-01": [
    "./assets/frames/set-01-1.png",
    "./assets/frames/set-01-2.png",
    "./assets/frames/set-01-3.png",
    "./assets/frames/set-01-4.png",
  ],
};
// App state
const photos = [];
const selectedSlots = Array.from({ length: STRIP_SLOTS }, () => null);
const slotImages = Array.from({ length: STRIP_SLOTS }, () => null);
const imageCache = new Map();
const frameDataUrlCache = new Map();

let stream = null;
let selectedFramePath = "";
let selectedFrameSet = null;
let activeSlotIndex = 0;
let frameLocked = false;

// Frame selection helpers
const getActiveFrameOption = () =>
  frameList.querySelector(".frame-option.is-active");

const getCurrentCaptureFramePath = () => {
  if (selectedFramePath) return selectedFramePath;
  if (!selectedFrameSet) return "";
  const frameIndex = Math.min(
    selectedFrameSet.length - 1,
    Math.floor(photos.length / 2)
  );
  return selectedFrameSet[frameIndex];
};

// Apply selected frame or set to the preview
const setFrame = (framePath) => {
  selectedFramePath = framePath;
  selectedFrameSet = null;
  setPreviewFrame(framePath);
};

const setFrameSet = (frameSetKey) => {
  selectedFrameSet = FRAME_SETS[frameSetKey] || null;
  selectedFramePath = "";
  setPreviewFrame(getCurrentCaptureFramePath());
  if (selectedFrameSet) {
    selectedFrameSet.forEach((src) => getCachedImage(src));
  }
};

// UI updates
const updateCaptureCount = () => {
  captureCount.textContent = photos.length;
  captureMax.textContent = MAX_PHOTOS;
  if (selectedFrameSet) {
    setPreviewFrame(getCurrentCaptureFramePath());
  }
};

const setButtonsState = (state) => {
  captureButton.disabled = !state.cameraOn || photos.length >= MAX_PHOTOS;
};

const setFrameListState = (enabled) => {
  frameList.setAttribute("aria-disabled", enabled ? "false" : "true");
};

// Preview frame handling
const setPreviewFrame = (framePath) => {
  if (!framePath) {
    frameOverlay.src = "";
    frameOverlay.classList.add("hidden");
    return;
  }
  frameOverlay.src = framePath;
  frameOverlay.classList.remove("hidden");
};

frameOverlay.addEventListener("error", () => {
  console.warn("Preview frame failed to load:", frameOverlay.src);
  frameOverlay.src = "";
  frameOverlay.classList.add("hidden");
});
const applyActiveFrameSelection = () => {
  const activeButton = getActiveFrameOption();
  if (!activeButton) return;
  const framePath = activeButton.dataset.frame || "";
  const frameSetKey = activeButton.dataset.frameSet || "";
  if (frameSetKey) {
    setFrameSet(frameSetKey);
  } else {
    setFrame(framePath);
  }
};

// Camera helpers
const waitForVideoReady = () =>
  new Promise((resolve) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    video.addEventListener("loadeddata", resolve, { once: true });
  });

const startCamera = async () => {
  if (stream) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    applyActiveFrameSelection();
    setButtonsState({ cameraOn: true });
    setFrameListState(true);
  } catch (error) {
    console.error("Camera access failed:", error);
    alert("Unable to access the camera. Please allow camera permissions.");
  }
};

// Capture helpers
const drawFrameIfNeeded = (context, callback) => {
  const framePath = getCurrentCaptureFramePath();
  if (!framePath) {
    callback();
    return;
  }

  const frameImage = new Image();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    callback();
  };
  const fallbackTimer = setTimeout(finish, 500);
  frameImage.crossOrigin = "anonymous";
  frameImage.src = framePath;
  frameImage.onload = () => {
    context.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
    clearTimeout(fallbackTimer);
    finish();
  };
  frameImage.onerror = () => {
    console.warn("Frame image failed to load:", framePath);
    clearTimeout(fallbackTimer);
    finish();
  };
};

const capturePhoto = async () => {
  if (!stream || photos.length >= MAX_PHOTOS) return;
  await waitForVideoReady();

  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  context.filter =
    "blur(0.4px) brightness(1.1) hue-rotate(12deg) grayscale(10%) contrast(115%)";
  context.save();
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();
  context.filter = "none";

  drawFrameIfNeeded(context, () => {
    photos.push(canvas.toDataURL("image/png"));
    if (!frameLocked) {
      frameLocked = true;
      setFrameListState(false);
    }
    updateCaptureCount();
    setButtonsState({ cameraOn: true });

    if (photos.length === MAX_PHOTOS) {
      showSelectionScreen();
    }
  });
};

// Strip selection helpers
const setActiveSlot = (index) => {
  activeSlotIndex = index;
  stripSlots.forEach((slot) => slot.classList.remove("is-active"));
  stripSlots[index].classList.add("is-active");
};

const updateSlots = () => {
  stripSlots.forEach((slot, index) => {
    const img = slot.querySelector(".strip-photo");
    const frame = slot.querySelector(".strip-frame");
    const photo = selectedSlots[index];
    img.src = photo || "";
    slot.classList.toggle("is-filled", Boolean(photo));
    if (selectedFrameSet && selectedFrameSet[index]) {
      frame.src = selectedFrameSet[index];
      frame.classList.remove("is-hidden");
    } else {
      frame.src = "";
      frame.classList.add("is-hidden");
    }
  });
};

// Selection screen rendering
const renderThumbnails = () => {
  thumbnailGrid.innerHTML = "";
  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.className = "thumbnail";
    button.type = "button";
    button.dataset.photoIndex = index;

    const img = document.createElement("img");
    img.src = photo;
    img.alt = `Captured photo ${index + 1}`;
    button.appendChild(img);
    thumbnailGrid.appendChild(button);
  });
};

const showSelectionScreen = () => {
  captureScreen.classList.add("hidden");
  selectionScreen.classList.remove("hidden");
  renderThumbnails();
  updateSlots();
  setActiveSlot(0);
};

const getActiveSlotIndex = () => {
  const activeSlot = document.querySelector(".strip-slot.is-active");
  const index = activeSlot ? Number(activeSlot.dataset.slot) : activeSlotIndex;
  return Number.isNaN(index) ? activeSlotIndex : index;
};

const assignPhotoToSlot = (photoIndex) => {
  const index = getActiveSlotIndex();
  selectedSlots[index] = photos[photoIndex];
  slotImages[index] = getCachedImage(photos[photoIndex]);
  updateSlots();
};

// Image loading and caching
const getCachedImage = (src) => {
  if (!src) return null;
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.src = src;
  imageCache.set(src, img);
  return img;
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const loadFrameDataUrl = async (src) => {
  if (!src) return null;
  if (frameDataUrlCache.has(src)) return frameDataUrlCache.get(src);
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    frameDataUrlCache.set(src, dataUrl);
    return dataUrl;
  } catch (error) {
    console.warn("Failed to load frame data URL:", src, error);
    return null;
  }
};

// Canvas drawing
const drawCover = (context, img, x, y, width, height) => {
  const scale = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;
  context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
};

const drawImageSafe = (context, img, x, y, width, height) => {
  try {
    context.drawImage(img, x, y, width, height);
  } catch (error) {
    console.warn("Failed to draw image:", error);
  }
};

// Export
const downloadStrip = async () => {
  if (selectedSlots.some((slot) => !slot)) {
    alert("Please fill all 4 slots before downloading.");
    return;
  }

  if (slotImages.some((img) => !img || !img.complete)) {
    alert("Photos are still loading. Please try again.");
    return;
  }

  const images = slotImages;
  const frameImages = selectedFrameSet
    ? await Promise.all(
        selectedFrameSet.map(async (src) => {
          const dataUrl = await loadFrameDataUrl(src);
          if (dataUrl) {
            return await loadImage(dataUrl);
          }
          try {
            return await loadImage(src);
          } catch (error) {
            console.warn("Failed to load frame image:", src, error);
            return null;
          }
        })
      )
    : [];
  const stripWidth = 700;
  const padding = 32;
  const gap = 20;
  const photoWidth = stripWidth - padding * 2;
  const photoHeight = Math.round(photoWidth * 0.75);
  const stripHeight =
    padding * 2 + photoHeight * STRIP_SLOTS + gap * (STRIP_SLOTS - 1);

  const stripCanvas = document.createElement("canvas");
  stripCanvas.width = stripWidth;
  stripCanvas.height = stripHeight;
  const context = stripCanvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, stripWidth, stripHeight);

  images.forEach((img, index) => {
    const y = padding + index * (photoHeight + gap);
    drawCover(context, img, padding, y, photoWidth, photoHeight);
    const frameImage = frameImages[index];
    if (
      frameImage &&
      frameImage.complete &&
      frameImage.naturalWidth > 0 &&
      frameImage.naturalHeight > 0
    ) {
      drawImageSafe(context, frameImage, padding, y, photoWidth, photoHeight);
    }
  });

  const link = document.createElement("a");
  try {
    link.href = stripCanvas.toDataURL("image/png");
  } catch (error) {
    console.error("Failed to export strip:", error);
    alert("Unable to export the strip. Try again without a frame set.");
    return;
  }
  link.download = "aot-photobooth-strip.png";
  link.click();
};

// Reset flow
const startOver = () => {
  photos.length = 0;
  selectedSlots.fill(null);
  slotImages.fill(null);
  frameLocked = false;
  updateCaptureCount();
  updateSlots();
  renderThumbnails();
  selectionScreen.classList.add("hidden");
  captureScreen.classList.remove("hidden");
  setButtonsState({ cameraOn: Boolean(stream) });
  setFrameListState(Boolean(stream));
};

// Event listeners
frameList.addEventListener("click", (event) => {
  if (frameLocked) return;
  const button = event.target.closest(".frame-option");
  if (!button) return;
  const framePath = button.dataset.frame || "";
  const frameSetKey = button.dataset.frameSet || "";

  document
    .querySelectorAll(".frame-option")
    .forEach((option) => option.classList.remove("is-active"));
  button.classList.add("is-active");
  if (frameSetKey) {
    setFrameSet(frameSetKey);
  } else {
    setFrame(framePath);
  }
  updateSlots();
  setButtonsState({ cameraOn: Boolean(stream) });
});

thumbnailGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".thumbnail");
  if (!button) return;
  const photoIndex = Number(button.dataset.photoIndex);
  assignPhotoToSlot(photoIndex);
});

if (strip) {
  strip.addEventListener("click", (event) => {
    const slot = event.target.closest(".strip-slot");
    if (!slot) return;
    const index = Number(slot.dataset.slot);
    if (Number.isNaN(index)) return;
    setActiveSlot(index);
  });
}

startButton.addEventListener("click", startCamera);
captureButton.addEventListener("click", capturePhoto);
downloadStripButton.addEventListener("click", downloadStrip);
startOverButton.addEventListener("click", startOver);

// Initial state
setButtonsState({ cameraOn: false });
updateCaptureCount();
setFrame("");
setFrameListState(false);