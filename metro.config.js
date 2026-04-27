const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.onnx` was previously added to assetExts to allow bundling the sface
// face-detection model. The on-device ONNX path is no longer used —
// face verification runs through AWS Rekognition via the verify-face
// edge function. The model files live on disk in assets/models/ but
// nothing require()s them, so Metro doesn't include them in the bundle.
// .easignore additionally keeps them out of the EAS Build upload context.
//
// If on-device inference is reintroduced, restore:
//   config.resolver.assetExts.push('onnx');

module.exports = config;
