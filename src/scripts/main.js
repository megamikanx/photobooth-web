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
const stripSlots = document.querySelectorAll(".strip-slot");
const downloadStripButton = document.querySelector("#downloadStrip");
const startOverButton = document.querySelector("#startOver");

const MAX_PHOTOS = 10;
const STRIP_SLOTS = 4;
const FRAME_SETS = {
  "set-01": [
    "./assets/frames/set-01-1.png",
    "./assets/frames/set-01-2.png",
    "./assets/frames/set-01-3.png",
    "./assets/frames/set-01-4.png",
  ],
};
const photos = [];
const selectedSlots = Array.from({ length: STRIP_SLOTS }, () => null);

let stream = null;
let selectedFramePath = "";
let selectedFrameSet = null;
let activeSlotIndex = 0;

const setFrame = (framePath) => {
  selectedFramePath = framePath;
  selectedFrameSet = null;
  frameOverlay.src = framePath;
  frameOverlay.classList.toggle("hidden", !framePath);
};

const setFrameSet = (frameSetKey) => {
  selectedFrameSet = FRAME_SETS[frameSetKey] || null;
  selectedFramePath = "";
  frameOverlay.src = "";
  frameOverlay.classList.add("hidden");
};

const updateCaptureCount = () => {
  captureCount.textContent = photos.length;
  captureMax.textContent = MAX_PHOTOS;
};

const setButtonsState = (state) => {
  captureButton.disabled =
    !state.cameraOn || photos.length >= MAX_PHOTOS;
};

const startCamera = async () => {
  if (stream) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    setButtonsState({ cameraOn: true });
  } catch (error) {
    console.error("Camera access failed:", error);
    alert("Unable to access the camera. Please allow camera permissions.");
  }
};

const drawFrameIfNeeded = (context, callback) => {
  if (!selectedFramePath) {
    callback();
    return;
  }

  const frameImage = new Image();
  frameImage.src = selectedFramePath;
  frameImage.onload = () => {
    context.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
    callback();
  };
};

const capturePhoto = () => {
  if (!stream || photos.length >= MAX_PHOTOS) return;

  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  context.filter = "blur(0.4px) brightness(1.1) hue-rotate(12deg) grayscale(10%) constrast(115%)";
  context.save();
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.restore();
  context.filter = "none";

  drawFrameIfNeeded(context, () => {
    photos.push(canvas.toDataURL("image/png"));
    updateCaptureCount();
    setButtonsState({ cameraOn: true });

    if (photos.length === MAX_PHOTOS) {
      showSelectionScreen();
    }
  });
};

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
    frame.src = selectedFrameSet ? selectedFrameSet[index] || "" : "";
  });
};

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

const assignPhotoToSlot = (photoIndex) => {
  selectedSlots[activeSlotIndex] = photos[photoIndex];
  updateSlots();
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const drawCover = (context, img, x, y, width, height) => {
  const scale = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;
  context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
};

const downloadStrip = async () => {
  if (selectedSlots.some((slot) => !slot)) {
    alert("Please fill all 4 slots before downloading.");
    return;
  }

  const images = await Promise.all(
    selectedSlots.map((slot) => loadImage(slot))
  );
  const frameImages = selectedFrameSet
    ? await Promise.all(selectedFrameSet.map((src) => loadImage(src)))
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
    if (frameImages[index]) {
      context.drawImage(frameImages[index], padding, y, photoWidth, photoHeight);
    }
  });

  const link = document.createElement("a");
  link.href = stripCanvas.toDataURL("image/png");
  link.download = "puppy-photobooth-strip.png";
  link.click();
};

const startOver = () => {
  photos.length = 0;
  selectedSlots.fill(null);
  updateCaptureCount();
  updateSlots();
  renderThumbnails();
  selectionScreen.classList.add("hidden");
  captureScreen.classList.remove("hidden");
  setButtonsState({ cameraOn: Boolean(stream) });
};

frameList.addEventListener("click", (event) => {
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
});

thumbnailGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".thumbnail");
  if (!button) return;
  const photoIndex = Number(button.dataset.photoIndex);
  assignPhotoToSlot(photoIndex);
});

stripSlots.forEach((slot, index) => {
  slot.addEventListener("click", () => setActiveSlot(index));
});

startButton.addEventListener("click", startCamera);
captureButton.addEventListener("click", capturePhoto);
downloadStripButton.addEventListener("click", downloadStrip);
startOverButton.addEventListener("click", startOver);

setButtonsState({ cameraOn: false });
updateCaptureCount();
setFrame("");