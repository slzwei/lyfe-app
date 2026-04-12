package com.lyfe.facedetection

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.view.WindowManager
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.tasks.await
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.math.max

class FaceDetectionModule : Module() {
    private var savedBrightness: Float = -1f

    override fun definition() = ModuleDefinition {
        Name("FaceDetection")

        Function<Unit>("setMaxBrightness") {
            appContext.currentActivity?.let { activity ->
                activity.runOnUiThread {
                    savedBrightness = activity.window.attributes.screenBrightness
                    val params = activity.window.attributes
                    params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
                    activity.window.attributes = params
                }
            }
        }

        Function<Unit>("restoreBrightness") {
            appContext.currentActivity?.let { activity ->
                activity.runOnUiThread {
                    if (savedBrightness >= 0f) {
                        val params = activity.window.attributes
                        params.screenBrightness = savedBrightness
                        activity.window.attributes = params
                        savedBrightness = -1f
                    }
                }
            }
        }

        AsyncFunction("convertToJpeg") { imagePath: String, quality: Double ->
            val bitmap = loadBitmap(imagePath) ?: throw FaceDetectionException("Could not load image")
            val tempFile = File.createTempFile("face_${UUID.randomUUID()}", ".jpg")
            FileOutputStream(tempFile).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt(), out)
            }
            bitmap.recycle()
            tempFile.absolutePath
        }

        AsyncFunction("detectFaces") Coroutine { imagePath: String ->
            val cleanPath = if (imagePath.startsWith("file://")) imagePath.substring(7) else imagePath
            val file = File(cleanPath)
            if (!file.exists()) throw FaceDetectionException("File not found: $cleanPath")

            // Load downsampled bitmap (max ~1024px) — much faster than full-res for face detection
            val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(cleanPath, opts)
            val maxDim = max(opts.outWidth, opts.outHeight)
            val sample = if (maxDim > 1024) (maxDim / 1024) else 1
            val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sample }
            val bitmap = BitmapFactory.decodeFile(cleanPath, decodeOpts)
                ?: throw FaceDetectionException("Could not decode bitmap")

            // Read EXIF rotation and pass to ML Kit
            val exif = ExifInterface(cleanPath)
            val rotation = when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90
                ExifInterface.ORIENTATION_ROTATE_180 -> 180
                ExifInterface.ORIENTATION_ROTATE_270 -> 270
                else -> 0
            }
            val image = InputImage.fromBitmap(bitmap, rotation)

            val options = FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
                .setMinFaceSize(0.15f)
                .build()

            val detector = FaceDetection.getClient(options)
            val faces = try {
                detector.process(image).await()
            } finally {
                detector.close()
            }

            // After rotation by ML Kit, effective image dimensions swap if rotated 90/270
            val imgW = (if (rotation == 90 || rotation == 270) bitmap.height else bitmap.width).toDouble()
            val imgH = (if (rotation == 90 || rotation == 270) bitmap.width else bitmap.height).toDouble()
            bitmap.recycle()

            faces.map { face ->
                mapOf(
                    "hasYaw" to true,
                    // ML Kit yaw: positive = right, negative = left (matches Apple Vision after our negation)
                    "yaw" to face.headEulerAngleY.toDouble(),
                    "hasRoll" to true,
                    "roll" to face.headEulerAngleZ.toDouble(),
                    "hasPitch" to true,
                    "pitch" to face.headEulerAngleX.toDouble(),
                    "boundingBox" to mapOf(
                        // Convert pixel coords to normalized 0-1 with bottom-left origin (matching iOS Vision)
                        "x" to face.boundingBox.left / imgW,
                        "y" to (imgH - face.boundingBox.bottom) / imgH,
                        "width" to face.boundingBox.width() / imgW,
                        "height" to face.boundingBox.height() / imgH,
                    ),
                    "confidence" to 1.0,
                )
            }
        }
    }

    private fun loadBitmap(path: String): Bitmap? {
        val cleanPath = if (path.startsWith("file://")) path.substring(7) else path
        val file = File(cleanPath)
        if (!file.exists()) return null

        // Decode with sample size to avoid OOM on large photos
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(cleanPath, opts)
        val maxDim = max(opts.outWidth, opts.outHeight)
        val sample = if (maxDim > 2048) (maxDim / 2048) else 1

        val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sample }
        val bitmap = BitmapFactory.decodeFile(cleanPath, decodeOpts) ?: return null

        // Apply EXIF rotation
        val exif = ExifInterface(cleanPath)
        val orientation = exif.getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL,
        )
        return when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> rotateBitmap(bitmap, 90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> rotateBitmap(bitmap, 180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> rotateBitmap(bitmap, 270f)
            else -> bitmap
        }
    }

    private fun rotateBitmap(bitmap: Bitmap, degrees: Float): Bitmap {
        val matrix = android.graphics.Matrix().apply { postRotate(degrees) }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated != bitmap) bitmap.recycle()
        return rotated
    }
}

class FaceDetectionException(message: String) : CodedException(message)
