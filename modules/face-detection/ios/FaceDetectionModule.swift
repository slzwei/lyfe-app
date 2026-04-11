import ExpoModulesCore
import Vision
import UIKit
import CoreGraphics
import Accelerate

public class FaceDetectionModule: Module {
    public func definition() -> ModuleDefinition {
        Name("FaceDetection")

        /// Detect faces in an image file. Returns yaw, roll, bounding box.
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

        /// Extract a 112x112 face chip from a photo in BGR format (SFace-ready).
        /// Returns raw Float32 pixel data as [B,G,R,...] in CHW layout, 0-255 range.
        /// Size: 3 * 112 * 112 = 37632 floats.
        AsyncFunction("extractFaceChip") { (imagePath: String) -> [String: Any]? in
            guard let uiImage = Self.loadImage(from: imagePath) else {
                throw FaceDetectionError.invalidImage
            }

            let ciImage = CIImage(image: uiImage)!
            let imageWidth = Int(uiImage.size.width * uiImage.scale)
            let imageHeight = Int(uiImage.size.height * uiImage.scale)

            // Detect face with landmarks
            let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
            let request = VNDetectFaceLandmarksRequest()
            request.revision = VNDetectFaceLandmarksRequestRevision3
            try handler.perform([request])

            guard let face = request.results?.first else {
                return nil // No face found
            }

            // Get face bounding box in pixel coordinates
            let bbox = face.boundingBox
            let faceX = Int(bbox.origin.x * CGFloat(imageWidth))
            let faceY = Int((1.0 - bbox.origin.y - bbox.size.height) * CGFloat(imageHeight))
            let faceW = Int(bbox.size.width * CGFloat(imageWidth))
            let faceH = Int(bbox.size.height * CGFloat(imageHeight))

            // Square crop centered on face using width * 1.4
            let size = Int(Double(faceW) * 1.4)
            let centerX = faceX + faceW / 2
            let centerY = faceY + faceH / 2
            let cropX = max(0, centerX - size / 2)
            let cropY = max(0, centerY - size / 2)
            let cropW = min(size, imageWidth - cropX)
            let cropH = min(size, imageHeight - cropY)

            // Render the UIImage to a bitmap context (handles EXIF rotation)
            guard let cgImage = Self.renderToBitmap(uiImage) else {
                throw FaceDetectionError.invalidImage
            }

            // Crop the face region
            let cropRect = CGRect(x: cropX, y: cropY, width: cropW, height: cropH)
            guard let croppedCG = cgImage.cropping(to: cropRect) else {
                throw FaceDetectionError.invalidImage
            }

            // Resize to 112x112
            let targetSize = 112
            guard let resizedCG = Self.resize(croppedCG, to: targetSize) else {
                throw FaceDetectionError.invalidImage
            }

            // Extract pixels as BGR CHW Float32 (SFace format)
            let pixelData = Self.extractBGRPixels(resizedCG, size: targetSize)

            return [
                "pixels": pixelData,
                "boundingBox": [
                    "x": bbox.origin.x,
                    "y": bbox.origin.y,
                    "width": bbox.size.width,
                    "height": bbox.size.height,
                ],
                "yaw": (face.yaw?.doubleValue ?? 0.0) * 180.0 / .pi,
            ]
        }
    }

    // MARK: - Image Loading

    private static func loadImage(from path: String) -> UIImage? {
        let cleanPath: String
        if path.hasPrefix("file://") {
            cleanPath = String(path.dropFirst(7))
        } else {
            cleanPath = path
        }
        return UIImage(contentsOfFile: cleanPath)
    }

    // MARK: - Bitmap Rendering (handles EXIF rotation)

    private static func renderToBitmap(_ image: UIImage) -> CGImage? {
        let width = Int(image.size.width * image.scale)
        let height = Int(image.size.height * image.scale)

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        // Drawing UIImage into CGContext applies EXIF orientation
        context.draw(image.cgImage!, in: CGRect(x: 0, y: 0, width: width, height: height))
        return context.makeImage()
    }

    // MARK: - Resize

    private static func resize(_ image: CGImage, to size: Int) -> CGImage? {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: size * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
        return context.makeImage()
    }

    // MARK: - Pixel Extraction (BGR CHW, 0-255 Float32)

    private static func extractBGRPixels(_ image: CGImage, size: Int) -> [Float] {
        let pixelCount = size * size
        var pixels = [Float](repeating: 0, count: 3 * pixelCount)

        // Get raw RGBA pixel data
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        var rawData = [UInt8](repeating: 0, count: size * size * 4)
        guard let context = CGContext(
            data: &rawData,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: size * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return pixels }

        context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))

        // Convert RGBA to BGR CHW layout
        for i in 0..<pixelCount {
            let srcIdx = i * 4
            pixels[0 * pixelCount + i] = Float(rawData[srcIdx + 2]) // B
            pixels[1 * pixelCount + i] = Float(rawData[srcIdx + 1]) // G
            pixels[2 * pixelCount + i] = Float(rawData[srcIdx + 0]) // R
        }

        return pixels
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
