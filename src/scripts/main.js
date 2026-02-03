const video = document.querySelector("#camera");
const canvas = document.querySelector("#canvas");
const frameOverlay = document.querySelector("#frameOverlay");
const startButton = document.querySelector("#startCamera");
const captureButton = document.querySelector("#capturePhoto");
const downloadButton = document.querySelector("#downloadPhoto");
const frameList = document.querySelector("#frameList");

let stream = null;
let capturedDataUrl = "";

const setFrame = (framePath) => {
  frameOverlay.src = framePath;
  frameOverlay.classList.toggle("hidden", !framePath);
};

const setButtonsState = (state) => {
  captureButton.disabled = !state.cameraOn;
  downloadButton.disabled = !state.hasPhoto;
};

const startCamera = async () => {
  if (stream) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    setButtonsState({ cameraOn: true, hasPhoto: false });
  } catch (error) {
    console.error("Camera access failed:", error);
    alert("Unable to access the camera. Please allow camera permissions.");
  }
};

const capturePhoto = () => {
  if (!stream) return;

  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (frameOverlay.src) {
    const frameImage = new Image();
    frameImage.src = frameOverlay.src;
    frameImage.onload = () => {
      context.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
      capturedDataUrl = canvas.toDataURL("image/png");
      setButtonsState({ cameraOn: true, hasPhoto: true });
    };
    return;
  }

  capturedDataUrl = canvas.toDataURL("image/png");
  setButtonsState({ cameraOn: true, hasPhoto: true });
};

const downloadPhoto = () => {
  if (!capturedDataUrl) return;
  const link = document.createElement("a");
  link.href = capturedDataUrl;
  link.download = "puppy-photobooth.png";
  link.click();
};

frameList.addEventListener("click", (event) => {
  const button = event.target.closest(".frame-option");
  if (!button) return;
  const framePath = button.dataset.frame || "";

  document
    .querySelectorAll(".frame-option")
    .forEach((option) => option.classList.remove("is-active"));
  button.classList.add("is-active");
  setFrame(framePath);
});

startButton.addEventListener("click", startCamera);
captureButton.addEventListener("click", capturePhoto);
downloadButton.addEventListener("click", downloadPhoto);

setButtonsState({ cameraOn: false, hasPhoto: false });
setFrame("");