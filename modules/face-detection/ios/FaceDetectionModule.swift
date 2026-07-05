import ExpoModulesCore
import Vision
import UIKit
import CoreGraphics

public class FaceDetectionModule: Module {
    private static var savedBrightness: CGFloat = -1

    public func definition() -> ModuleDefinition {
        Name("FaceDetection")

        /// Set screen brightness to maximum (acts as fill light for face capture).
        /// Saves current brightness to restore later.
        Function("setMaxBrightness") {
            DispatchQueue.main.async {
                Self.savedBrightness = UIScreen.main.brightness
                UIScreen.main.brightness = 1.0
            }
        }

        /// Restore screen brightness to the value before setMaxBrightness.
        Function("restoreBrightness") {
            DispatchQueue.main.async {
                if Self.savedBrightness >= 0 {
                    UIScreen.main.brightness = Self.savedBrightness
                    Self.savedBrightness = -1
                }
            }
        }

        /// Convert any image (HEIC, PNG, etc.) to JPEG and return the file path.
        /// When `maxDimension > 0`, the image is downscaled so its longest edge is
        /// at most that many pixels before encoding — keeps the upload small.
        AsyncFunction("convertToJpeg") { (imagePath: String, quality: Double, maxDimension: Double) -> String in
            guard let uiImage = Self.loadImage(from: imagePath) else {
                throw FaceDetectionError.invalidImage
            }
            let image = Self.downscale(uiImage, maxDimension: maxDimension)
            guard let jpegData = image.jpegData(compressionQuality: quality) else {
                throw FaceDetectionError.invalidImage
            }
            let tempDir = NSTemporaryDirectory()
            let fileName = UUID().uuidString + ".jpg"
            let outPath = (tempDir as NSString).appendingPathComponent(fileName)
            try jpegData.write(to: URL(fileURLWithPath: outPath))
            return outPath
        }

        /// Static-image face detection via Apple Vision. Kept as an emergency
        /// escape hatch for the pre-frame-processor snapshot pipeline (an OTA
        /// revert of the JS can reconstruct that flow without a new native build).
        AsyncFunction("detectFaces") { (imagePath: String) -> [[String: Any]] in
            guard let uiImage = Self.loadImage(from: imagePath) else {
                throw FaceDetectionError.invalidImage
            }

            let ciImage = CIImage(image: uiImage)!
            let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
            let request = VNDetectFaceLandmarksRequest()
            request.revision = VNDetectFaceLandmarksRequestRevision3
            try handler.perform([request])

            guard let results = request.results else { return [] }

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
                if #available(iOS 15.0, *) {
                    result["hasPitch"] = face.pitch != nil
                    result["pitch"] = (face.pitch?.doubleValue ?? 0.0) * 180.0 / .pi
                }
                return result
            }
        }
    }

    // MARK: - Image Loading

    private static func loadImage(from path: String) -> UIImage? {
        let cleanPath = path.hasPrefix("file://") ? String(path.dropFirst(7)) : path
        return UIImage(contentsOfFile: cleanPath)
    }

    // MARK: - Downscale (orientation-safe)

    /// Scale a UIImage so its longest edge is at most `maxDimension` pixels,
    /// preserving aspect ratio. Returns the original when `maxDimension <= 0` or
    /// the image is already small enough. UIGraphicsImageRenderer bakes in the
    /// image's EXIF orientation, so the result is always upright.
    private static func downscale(_ image: UIImage, maxDimension: Double) -> UIImage {
        guard maxDimension > 0 else { return image }
        let longest = max(image.size.width, image.size.height)
        guard longest > CGFloat(maxDimension) else { return image }
        let scale = CGFloat(maxDimension) / longest
        let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1  // newSize is already in pixels; don't multiply by device scale
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}

enum FaceDetectionError: Error, LocalizedError {
    case invalidImage
    var errorDescription: String? {
        switch self {
        case .invalidImage: return "Could not load image for face detection"
        }
    }
}
