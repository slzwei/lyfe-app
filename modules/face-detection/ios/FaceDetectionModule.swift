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

        /// Extract an ALIGNED 112x112 face chip using 5-point landmark alignment.
        /// Returns BGR CHW Float32 pixels ready for SFace ONNX inference.
        AsyncFunction("extractFaceChip") { (imagePath: String) -> [String: Any]? in
            guard let uiImage = Self.loadImage(from: imagePath) else {
                throw FaceDetectionError.invalidImage
            }

            // Render to bitmap (applies EXIF rotation)
            let imgW = Int(uiImage.size.width * uiImage.scale)
            let imgH = Int(uiImage.size.height * uiImage.scale)
            guard let cgImage = Self.renderToBitmap(uiImage, width: imgW, height: imgH) else {
                throw FaceDetectionError.invalidImage
            }

            // Detect face with landmarks
            let ciImage = CIImage(cgImage: cgImage)
            let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
            let request = VNDetectFaceLandmarksRequest()
            request.revision = VNDetectFaceLandmarksRequestRevision3
            try handler.perform([request])

            guard let face = request.results?.first,
                  let landmarks = face.landmarks else {
                return nil
            }

            let bbox = face.boundingBox

            // Vision bbox is in normalised bottom-left coords.
            // CIImage also uses bottom-left origin, so keep y as-is for CIImage warp.
            let bboxX = bbox.origin.x * CGFloat(imgW)
            let bboxY = bbox.origin.y * CGFloat(imgH)  // bottom-left origin (CIImage native)
            let bboxW = bbox.size.width * CGFloat(imgW)
            let bboxH = bbox.size.height * CGFloat(imgH)

            guard let srcPoints = Self.extract5Points(
                landmarks: landmarks, bboxX: bboxX, bboxY: bboxY,
                bboxW: bboxW, bboxH: bboxH
            ) else {
                return Self.simpleCrop(cgImage: cgImage, bbox: bbox, imgW: imgW, imgH: imgH)
            }

            // SFace reference landmarks (112x112, top-left origin) → flip to bottom-left for CIImage
            let dstPoints: [(CGFloat, CGFloat)] = [
                (38.29, 112.0 - 51.70),  // left eye
                (73.53, 112.0 - 51.50),  // right eye
                (56.03, 112.0 - 71.74),  // nose
                (41.55, 112.0 - 92.37),  // left mouth
                (70.73, 112.0 - 92.20),  // right mouth
            ]

            let transform = Self.computeSimilarityTransform(src: srcPoints, dst: dstPoints)

            guard let aligned = Self.warpAffine(cgImage: cgImage, transform: transform, outputSize: 112) else {
                return Self.simpleCrop(cgImage: cgImage, bbox: bbox, imgW: imgW, imgH: imgH)
            }

            let pixels = Self.extractBGRPixels(aligned, size: 112)

            return [
                "pixels": pixels,
                "boundingBox": [
                    "x": bbox.origin.x, "y": bbox.origin.y,
                    "width": bbox.size.width, "height": bbox.size.height,
                ],
                "yaw": face.yaw?.doubleValue ?? 0.0,
                "aligned": true,
            ]
        }
    }

    // MARK: - 5-Point Landmark Extraction

    private static func extract5Points(
        landmarks: VNFaceLandmarks2D,
        bboxX: CGFloat, bboxY: CGFloat,
        bboxW: CGFloat, bboxH: CGFloat
    ) -> [(CGFloat, CGFloat)]? {
        // Vision landmarks are normalised to the face bounding box (0-1),
        // with origin at bottom-left. Keep bottom-left origin to match CIImage.
        func toPixel(_ points: [CGPoint]) -> [(CGFloat, CGFloat)] {
            points.map { p in
                let x = bboxX + p.x * bboxW
                let y = bboxY + p.y * bboxH  // bottom-left origin preserved
                return (x, y)
            }
        }

        func average(_ points: [(CGFloat, CGFloat)]) -> (CGFloat, CGFloat) {
            let sumX = points.reduce(0.0) { $0 + $1.0 }
            let sumY = points.reduce(0.0) { $0 + $1.1 }
            let n = CGFloat(points.count)
            return (sumX / n, sumY / n)
        }

        // Left eye center
        let leftEyePoints: [(CGFloat, CGFloat)]
        if let pupil = landmarks.leftPupil?.normalizedPoints, !pupil.isEmpty {
            leftEyePoints = toPixel(pupil)
        } else if let eye = landmarks.leftEye?.normalizedPoints, !eye.isEmpty {
            leftEyePoints = toPixel(eye)
        } else { return nil }

        // Right eye center
        let rightEyePoints: [(CGFloat, CGFloat)]
        if let pupil = landmarks.rightPupil?.normalizedPoints, !pupil.isEmpty {
            rightEyePoints = toPixel(pupil)
        } else if let eye = landmarks.rightEye?.normalizedPoints, !eye.isEmpty {
            rightEyePoints = toPixel(eye)
        } else { return nil }

        // Nose tip
        let nosePoints: [(CGFloat, CGFloat)]
        if let nose = landmarks.nose?.normalizedPoints, !nose.isEmpty {
            nosePoints = toPixel(nose)
        } else if let crest = landmarks.noseCrest?.normalizedPoints, !crest.isEmpty {
            nosePoints = toPixel(crest)
        } else { return nil }

        // Mouth corners
        guard let lips = landmarks.outerLips?.normalizedPoints, lips.count >= 6 else {
            return nil
        }
        let lipPixels = toPixel(lips)

        let leftEye = average(leftEyePoints)
        let rightEye = average(rightEyePoints)
        let noseTip = nosePoints.last!  // tip is usually the last point
        let leftMouth = lipPixels.first!
        let rightMouth = lipPixels[lipPixels.count / 2]

        return [leftEye, rightEye, noseTip, leftMouth, rightMouth]
    }

    // MARK: - Similarity Transform (least squares)

    private static func computeSimilarityTransform(
        src: [(CGFloat, CGFloat)],
        dst: [(CGFloat, CGFloat)]
    ) -> CGAffineTransform {
        // Solve for similarity transform: dst = [a -b; b a] * src + [tx; ty]
        // Using least squares on all point pairs.
        let n = min(src.count, dst.count)
        var sumSxSx: CGFloat = 0, sumSxSy: CGFloat = 0
        var sumSxDx: CGFloat = 0, sumSxDy: CGFloat = 0
        var sumSyDx: CGFloat = 0, sumSyDy: CGFloat = 0
        var sumSx: CGFloat = 0, sumSy: CGFloat = 0
        var sumDx: CGFloat = 0, sumDy: CGFloat = 0

        for i in 0..<n {
            let sx = src[i].0, sy = src[i].1
            let dx = dst[i].0, dy = dst[i].1
            sumSxSx += sx * sx + sy * sy
            sumSxSy += sx * sy - sy * sx  // always 0, but kept for clarity
            sumSxDx += sx * dx + sy * dy
            sumSxDy += sx * dy - sy * dx
            sumSyDx += sy * dx - sx * dy  // = -sumSxDy
            sumSyDy += sy * dy + sx * dx  // = sumSxDx
            sumSx += sx
            sumSy += sy
            sumDx += dx
            sumDy += dy
        }

        let nf = CGFloat(n)

        // Solve the 4x4 system:
        // [sumSxSx  0       sumSx  -sumSy] [a ]   [sumSxDx]
        // [0        sumSxSx sumSy   sumSx] [b ]   [sumSxDy]
        // [sumSx    sumSy   n       0    ] [tx] = [sumDx  ]
        // [-sumSy   sumSx   0       n    ] [ty]   [sumDy  ]
        //
        // Simplified solution for similarity transform:
        let det = sumSxSx * nf - sumSx * sumSx - sumSy * sumSy
        guard abs(det) > 1e-6 else {
            // Fallback to identity
            return CGAffineTransform.identity
        }

        let a = (sumSxDx * nf - sumSx * sumDx - sumSy * sumDy) / det
        let b = (sumSxDy * nf - sumSy * sumDx + sumSx * sumDy) / det
        let tx = (sumDx - a * sumSx + b * sumSy) / nf
        let ty = (sumDy - b * sumSx - a * sumSy) / nf

        // CGAffineTransform: [a b 0; c d 0; tx ty 1] (row-major for CG)
        return CGAffineTransform(a: a, b: -b, c: b, d: a, tx: tx, ty: ty)
    }

    // MARK: - Affine Warp (CIImage-based)

    private static func warpAffine(cgImage: CGImage, transform: CGAffineTransform, outputSize: Int) -> CGImage? {
        let ciInput = CIImage(cgImage: cgImage)
        let size = CGFloat(outputSize)

        // The similarity transform maps source→dest. CIImage transform applies forward,
        // but we need inverse mapping (for each dest pixel, find source pixel).
        let inverse = transform.inverted()

        let warped = ciInput
            .transformed(by: inverse)
            .cropped(to: CGRect(x: 0, y: 0, width: size, height: size))

        let ctx = CIContext(options: [.useSoftwareRenderer: false])
        return ctx.createCGImage(warped, from: warped.extent)
    }

    // MARK: - Simple Crop Fallback

    private static func simpleCrop(cgImage: CGImage, bbox: CGRect, imgW: Int, imgH: Int) -> [String: Any] {
        let faceX = Int(bbox.origin.x * CGFloat(imgW))
        let faceY = Int((1.0 - bbox.origin.y - bbox.size.height) * CGFloat(imgH))
        let faceW = Int(bbox.size.width * CGFloat(imgW))
        let size = Int(Double(faceW) * 1.4)
        let centerX = faceX + faceW / 2
        let faceH = Int(bbox.size.height * CGFloat(imgH))
        let centerY = faceY + faceH / 2
        let cropX = max(0, centerX - size / 2)
        let cropY = max(0, centerY - size / 2)
        let cropW = min(size, imgW - cropX)
        let cropH = min(size, imgH - cropY)

        let cropRect = CGRect(x: cropX, y: cropY, width: cropW, height: cropH)
        let cropped = cgImage.cropping(to: cropRect) ?? cgImage
        let resized = Self.resizeImage(cropped, to: 112)
        let pixels = Self.extractBGRPixels(resized, size: 112)

        return [
            "pixels": pixels,
            "boundingBox": [
                "x": bbox.origin.x, "y": bbox.origin.y,
                "width": bbox.size.width, "height": bbox.size.height,
            ],
            "yaw": 0.0,
            "aligned": false,
        ]
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

    // MARK: - Bitmap Rendering (handles EXIF rotation)

    private static func renderToBitmap(_ image: UIImage, width: Int, height: Int) -> CGImage? {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil, width: width, height: height,
            bitsPerComponent: 8, bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        // UIGraphics drawing applies EXIF orientation
        UIGraphicsPushContext(context)
        image.draw(in: CGRect(x: 0, y: 0, width: width, height: height))
        UIGraphicsPopContext()

        return context.makeImage()
    }

    // MARK: - Resize

    private static func resizeImage(_ image: CGImage, to size: Int) -> CGImage {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let context = CGContext(
            data: nil, width: size, height: size,
            bitsPerComponent: 8, bytesPerRow: size * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
        return context.makeImage()!
    }

    // MARK: - BGR CHW Pixel Extraction (SFace format: 0-255 Float32)

    private static func extractBGRPixels(_ image: CGImage, size: Int) -> [Float] {
        let pixelCount = size * size
        var pixels = [Float](repeating: 0, count: 3 * pixelCount)

        var rawData = [UInt8](repeating: 0, count: size * size * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: &rawData, width: size, height: size,
            bitsPerComponent: 8, bytesPerRow: size * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return pixels }

        context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))

        for i in 0..<pixelCount {
            let srcIdx = i * 4  // RGBA layout
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
        case .invalidImage: return "Could not load image for face detection"
        }
    }
}
