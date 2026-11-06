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
 * Crop the same region that is visible inside the CSS guide.
 * The calculation accounts for object-fit: cover, so the source crop
 * corresponds to the visible camera preview rather than the uncropped stream.
 */
function createGuideCrop(input, frameElement) {
  const width = input.videoWidth || input.width;
  const height = input.videoHeight || input.height;

  if (!width || !height) {
    throw new Error('Camera is not ready. Wait for the video preview.');
  }

  const rect = frameElement?.getBoundingClientRect();
  const displayWidth = rect?.width || width;
  const displayHeight = rect?.height || height;
  const displayRatio = displayWidth / displayHeight;
  const sourceRatio = width / height;

  let visibleX = 0;
  let visibleY = 0;
  let visibleWidth = width;
  let visibleHeight = height;

  // Match object-fit: cover's centered crop.
  if (sourceRatio > displayRatio) {
    visibleWidth = height * displayRatio;
    visibleX = (width - visibleWidth) / 2;
  } else if (sourceRatio < displayRatio) {
    visibleHeight = width / displayRatio;
    visibleY = (height - visibleHeight) / 2;
  }

  // CSS guide: width 44%, height 78%, centered at 50% x and 46% y.
  const cropWidth = Math.max(1, Math.round(visibleWidth * 0.44));
  const cropHeight = Math.max(1, Math.round(visibleHeight * 0.78));
  const cropX = Math.max(0, Math.round(visibleX + visibleWidth * 0.28));
  const cropY = Math.max(0, Math.round(visibleY + visibleHeight * 0.07));

  const safeWidth = Math.min(cropWidth, width - cropX);
  const safeHeight = Math.min(cropHeight, height - cropY);

  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not prepare the face scanning frame.');
  }

  context.drawImage(
    input,
    cropX,
    cropY,
    safeWidth,
    safeHeight,
    0,
    0,
    safeWidth,
    safeHeight
  );

  return {
    canvas,
    width,
    height,
    cropX,
    cropY,
    cropWidth: safeWidth,
    cropHeight: safeHeight
  };
}

/**
 * The detector analyzes the guide crop. The center of a detected face must
 * also be inside the oval's ellipse; faces outside it are not eligible.
 */
function isFaceCenterInsideOval(box, cropWidth, cropHeight) {
  const centerX = (box.x + box.width / 2) / cropWidth;
  const centerY = (box.y + box.height / 2) / cropHeight;

  const dx = (centerX - 0.5) / 0.43;
  const dy = (centerY - 0.5) / 0.46;

  return dx * dx + dy * dy <= 1;
}

export async function getFaceAnalysis(input, options = {}) {
  if (!loaded) await loadFaceModels();

  if (!input) {
    throw new Error('Camera input is not available.');
  }

  const frameOnly = options.frameOnly === true;
  const sourceWidth = input.videoWidth || input.width;
  const sourceHeight = input.videoHeight || input.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Camera is not ready. Wait for the video preview.');
  }

  let analysisInput = input;
  let cropInfo = null;

  if (frameOnly) {
    cropInfo = createGuideCrop(input, options.frameElement);
    analysisInput = cropInfo.canvas;
  }

  let detections;

  try {
    detections = await faceapi
      .detectAllFaces(
        analysisInput,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();
  } catch (error) {
    console.error('Face detection failed:', error);
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
    throw new Error('Unable to identify facial landmarks. Face the camera.');
  }

  const average = items => ({
    x: items.reduce((sum, point) => sum + point.x, 0) / items.length,
    y: items.reduce((sum, point) => sum + point.y, 0) / items.length
  });

  const leftEye = average(points.slice(36, 42));
  const rightEye = average(points.slice(42, 48));
  const nose = points[30];
  const mouth = average(points.slice(48, 68));

  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2
  };

  const eyeDistance = Math.max(1, Math.abs(rightEye.x - leftEye.x));
  const eyeToMouth = Math.max(1, Math.abs(mouth.y - eyeCenter.y));

  const yaw = (nose.x - eyeCenter.x) / eyeDistance;
  const pitch = (nose.y - eyeCenter.y) / eyeToMouth;

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
    descriptor: Array.from(result.descriptor),
    confidence: result.detection.score,
    yaw,
    pitch,
    centerX: (originalBox.x + originalBox.width / 2) / sourceWidth,
    centerY: (originalBox.y + originalBox.height / 2) / sourceHeight,
    widthRatio: originalBox.width / sourceWidth,
    heightRatio: originalBox.height / sourceHeight,
    box: originalBox,
    scannedInsideFrame: frameOnly
  };
}

export async function getDescriptor(input, options = {}) {
  const analysis = await getFaceAnalysis(input, options);
  return analysis.descriptor;
}

export function findBestMatch(descriptor, templates, threshold = 0.48) {
  if (!Array.isArray(descriptor) || !Array.isArray(templates)) return null;

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
        sample.every(value => Number.isFinite(Number(value)))
    );

    if (!validDescriptors.length) continue;

    const distance = Math.min(
      ...validDescriptors.map(sample =>
        faceapi.euclideanDistance(
          new Float32Array(descriptor),
          new Float32Array(sample)
        )
      )
    );

    if (!best || distance < best.distance) {
      best = { student, distance };
    }
  }

  return best && best.distance <= threshold ? best : null;
}
