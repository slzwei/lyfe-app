import ExpoModulesCore
import Vision
import UIKit

public class FaceDetectionModule: Module {
    public func definition() -> ModuleDefinition {
        Name("FaceDetection")

        /// Detect faces in an image file. Returns array of face results
        /// with yaw, roll, bounding box. Runs on a background queue —
        /// does NOT touch the camera pipeline.
        AsyncFunction("detectFaces") { (imagePath: String) -> [[String: Any]] in
            guard let url = URL(string: imagePath) ?? URL(fileURLWithPath: imagePath) as URL?,
                  let imageData = try? Data(contentsOf: url),
                  let ciImage = CIImage(data: imageData) else {
                throw FaceDetectionError.invalidImage
            }

            let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
            let request = VNDetectFaceLandmarksRequest()
            request.revision = VNDetectFaceLandmarksRequestRevision3

            try handler.perform([request])

            guard let results = request.results else {
                return []
            }

            return results.map { face in
                var result: [String: Any] = [
                    "hasYaw": face.yaw != nil,
                    "yaw": (face.yaw?.doubleValue ?? 0.0) * 180.0 / .pi,
                    "hasRoll": face.roll != nil,
                    "roll": (face.roll?.doubleValue ?? 0.0) * 180.0 / .pi,
                    "boundingBox": [
                        "x": face.boundingBox.origin.x,
                        "y": face.boundingBox.origin.y,
                        "width": face.boundingBox.size.width,
                        "height": face.boundingBox.size.height,
                    ],
                    "confidence": face.confidence,
                ]

                // Face quality if available
                if #available(iOS 15.0, *) {
                    // Pitch available on iOS 15+
                    result["hasPitch"] = face.pitch != nil
                    result["pitch"] = (face.pitch?.doubleValue ?? 0.0) * 180.0 / .pi
                }

                return result
            }
        }
    }
}

enum FaceDetectionError: Error, LocalizedError {
    case invalidImage

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "Could not load image for face detection"
        }
    }
}
