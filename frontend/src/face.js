import * as faceapi from '@vladmandic/face-api';

let loaded = false;
let loadingPromise = null;

export async function loadFaceModels() {
  if (loaded) return;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const modelPath = '/models';

      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
      ]);

      loaded = true;
      console.log('Face recognition models loaded.');
    })();
  }

  try {
    await loadingPromise;
  } catch (error) {
    loaded = false;
    loadingPromise = null;

    console.error('Face model loading failed:', error);

    throw new Error(
      'Unable to load face recognition models. Check frontend/public/models.'
    );
  }
}

/**
 * Crops the exact visible face-guide area from the camera.
 *
 * Accounts for object-fit: cover and the actual position and size
 * of the .attendance-face-oval element.
 */
function createGuideCrop(input, frameElement) {
  const width = input.videoWidth || input.width;
  const height = input.videoHeight || input.height;

  if (!width || !height) {
    throw new Error(
      'Camera is not ready. Wait for the video preview.'
    );
  }

  const frameRect = frameElement?.getBoundingClientRect();
  const guide = frameElement?.querySelector(
    '.attendance-face-oval'
  );

  const guideRect = guide?.getBoundingClientRect();

  if (
    !frameRect?.width ||
    !frameRect?.height ||
    !guideRect?.width ||
    !guideRect?.height
  ) {
    throw new Error(
      'The face guide is not ready. Please restart the camera.'
    );
  }

  // Calculate object-fit: cover scaling.
  const scale = Math.max(
    frameRect.width / width,
    frameRect.height / height
  );

  const renderedWidth = width * scale;
  const renderedHeight = height * scale;

  // Centered object-fit: cover offsets.
  const offsetX = (frameRect.width - renderedWidth) / 2;
  const offsetY = (frameRect.height - renderedHeight) / 2;

  // Guide coordinates relative to the camera frame.
  const left = Math.max(
    0,
    guideRect.left - frameRect.left
  );

  const top = Math.max(
    0,
    guideRect.top - frameRect.top
  );

  const right = Math.min(
    frameRect.width,
    guideRect.right - frameRect.left
  );

  const bottom = Math.min(
    frameRect.height,
    guideRect.bottom - frameRect.top
  );

  // Convert screen coordinates into original video coordinates.
  const cropX = Math.max(
    0,
    Math.floor((left - offsetX) / scale)
  );

  const cropY = Math.max(
    0,
    Math.floor((top - offsetY) / scale)
  );

  const cropRight = Math.min(
    width,
    Math.ceil((right - offsetX) / scale)
  );

  const cropBottom = Math.min(
    height,
    Math.ceil((bottom - offsetY) / scale)
  );

  const cropWidth = Math.max(
    1,
    cropRight - cropX
  );

  const cropHeight = Math.max(
    1,
    cropBottom - cropY
  );

  const canvas = document.createElement('canvas');

  canvas.width = cropWidth;
  canvas.height = cropHeight;

  const context = canvas.getContext('2d', {
    willReadFrequently: true
  });

  if (!context) {
    throw new Error(
      'Could not prepare the face scanning frame.'
    );
  }

  context.drawImage(
    input,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  return {
    canvas,
    width,
    height,
    cropX,
    cropY,
    cropWidth,
    cropHeight
  };
}

/**
 * Checks whether the detected face center is inside the guide.
 */
function isFaceCenterInsideOval(
  box,
  cropWidth,
  cropHeight
) {
  const centerX =
    (box.x + box.width / 2) / cropWidth;

  const centerY =
    (box.y + box.height / 2) / cropHeight;

  const dx = (centerX - 0.5) / 0.49;
  const dy = (centerY - 0.5) / 0.49;

  return dx * dx + dy * dy <= 1;
}

export async function getFaceAnalysis(
  input,
  options = {}
) {
  if (!loaded) {
    await loadFaceModels();
  }

  if (!input) {
    throw new Error(
      'Camera input is not available.'
    );
  }

  const frameOnly = options.frameOnly === true;

  const sourceWidth =
    input.videoWidth || input.width;

  const sourceHeight =
    input.videoHeight || input.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error(
      'Camera is not ready. Wait for the video preview.'
    );
  }

  let analysisInput = input;
  let cropInfo = null;

  if (frameOnly) {
    cropInfo = createGuideCrop(
      input,
      options.frameElement
    );

    analysisInput = cropInfo.canvas;
  }

  let detections;

  try {
    detections = await faceapi
      .detectAllFaces(
        analysisInput,
        new faceapi.SsdMobilenetv1Options({
          minConfidence: 0.35
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();
  } catch (error) {
    console.error(
      'Face detection failed:',
      error
    );

    throw new Error(
      'Face detection failed. Check that the face models loaded correctly.'
    );
  }

  if (!detections?.length) {
    throw new Error(
      frameOnly
        ? 'No face inside the scanning frame. Center your face inside the oval.'
        : 'No face detected. Improve the lighting and face the camera.'
    );
  }

  const eligibleFaces = frameOnly
    ? detections.filter(item =>
        isFaceCenterInsideOval(
          item.detection.box,
          cropInfo.cropWidth,
          cropInfo.cropHeight
        )
      )
    : detections;

  if (!eligibleFaces.length) {
    throw new Error(
      'No face inside the scanning frame. Center your face inside the oval.'
    );
  }

  if (eligibleFaces.length > 1) {
    throw new Error(
      'Multiple faces are inside the scanning frame. Allow only one person inside the oval.'
    );
  }

  const result = eligibleFaces[0];
  const points = result.landmarks.positions;

  if (!points || points.length < 68) {
    throw new Error(
      'Unable to identify facial landmarks. Face the camera.'
    );
  }

  const average = items => ({
    x:
      items.reduce(
        (sum, point) => sum + point.x,
        0
      ) / items.length,

    y:
      items.reduce(
        (sum, point) => sum + point.y,
        0
      ) / items.length
  });

  const leftEye = average(
    points.slice(36, 42)
  );

  const rightEye = average(
    points.slice(42, 48)
  );

  const nose = points[30];

  const mouth = average(
    points.slice(48, 68)
  );

  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2
  };

  const eyeDistance = Math.max(
    1,
    Math.abs(rightEye.x - leftEye.x)
  );

  const eyeToMouth = Math.max(
    1,
    Math.abs(mouth.y - eyeCenter.y)
  );

  const yaw =
    (nose.x - eyeCenter.x) / eyeDistance;

  const pitch =
    (nose.y - eyeCenter.y) / eyeToMouth;

  const box = result.detection.box;

  const offsetX = cropInfo?.cropX || 0;
  const offsetY = cropInfo?.cropY || 0;

  const originalBox = {
    x: box.x + offsetX,
    y: box.y + offsetY,
    width: box.width,
    height: box.height
  };

  return {
    descriptor: Array.from(
      result.descriptor
    ),

    confidence: result.detection.score,

    yaw,
    pitch,

    centerX:
      (originalBox.x + originalBox.width / 2) /
      sourceWidth,

    centerY:
      (originalBox.y + originalBox.height / 2) /
      sourceHeight,

    widthRatio:
      originalBox.width / sourceWidth,

    heightRatio:
      originalBox.height / sourceHeight,

    box: originalBox,

    scannedInsideFrame: frameOnly
  };
}

export async function getDescriptor(
  input,
  options = {}
) {
  const analysis = await getFaceAnalysis(
    input,
    options
  );

  return analysis.descriptor;
}

export function findBestMatch(
  descriptor,
  templates,
  threshold = 0.48
) {
  if (
    !Array.isArray(descriptor) ||
    !Array.isArray(templates)
  ) {
    return null;
  }

  let best = null;

  for (const student of templates) {
    const enrolled = student.faceDescriptors?.length
      ? student.faceDescriptors
      : student.faceDescriptor?.length
        ? [student.faceDescriptor]
        : [];

    const validDescriptors = enrolled.filter(
      sample =>
        Array.isArray(sample) &&
        sample.length === descriptor.length &&
        sample.every(value =>
          Number.isFinite(Number(value))
        )
    );

    if (!validDescriptors.length) {
      continue;
    }

    const distance = Math.min(
      ...validDescriptors.map(sample =>
        faceapi.euclideanDistance(
          new Float32Array(descriptor),
          new Float32Array(sample)
        )
      )
    );

    if (!best || distance < best.distance) {
      best = {
        student,
        distance
      };
    }
  }

  return best && best.distance <= threshold
    ? best
    : null;
}
