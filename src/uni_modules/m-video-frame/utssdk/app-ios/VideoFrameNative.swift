import Foundation
import AVFoundation
import UIKit
import CoreMedia

/**
 * Native iOS video frame extractor.
 * API shape matches m-choose-file (cloud-pack proven):
 * only 0-arg / 1-arg @objc methods (UTS drops args on multi-positional calls).
 */
@objc(VideoFrameNative)
class VideoFrameNative: NSObject {

  private var optUrl: String = ""
  private var optTimeMs: Double = 0
  private var optFormat: String = "jpg"
  private var optQuality: Double = 90
  private var optMaxWidth: Double = 0
  private var optMaxHeight: Double = 0
  private var optFileName: String = ""

  private var resultPath: String = ""
  private var resultWidth: Double = 0
  private var resultHeight: Double = 0
  private var resultFormat: String = "jpg"
  private var resultTimeMs: Double = 0
  private var resultSize: Double = 0

  @objc func resetOptions() {
    optUrl = ""
    optTimeMs = 0
    optFormat = "jpg"
    optQuality = 90
    optMaxWidth = 0
    optMaxHeight = 0
    optFileName = ""
    resultPath = ""
    resultWidth = 0
    resultHeight = 0
    resultFormat = "jpg"
    resultTimeMs = 0
    resultSize = 0
  }

  @objc func setUrl(_ url: String) {
    optUrl = url
  }

  @objc func setTimeMs(_ value: NSNumber) {
    optTimeMs = value.doubleValue
  }

  @objc func setFormat(_ format: String) {
    optFormat = format
  }

  @objc func setQuality(_ value: NSNumber) {
    optQuality = value.doubleValue
  }

  @objc func setMaxWidth(_ value: NSNumber) {
    optMaxWidth = value.doubleValue
  }

  @objc func setMaxHeight(_ value: NSNumber) {
    optMaxHeight = value.doubleValue
  }

  @objc func setFileName(_ fileName: String) {
    optFileName = fileName
  }

  /// Run extract. Returns "1" on success, nil on failure.
  @objc func extract() -> String? {
    let trimmed = optUrl.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return nil
    }
    guard let videoURL = Self.buildVideoURL(trimmed) else {
      return nil
    }

    let asset = AVURLAsset(url: videoURL, options: nil)
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = CMTimeMakeWithSeconds(0.2, preferredTimescale: 600)
    generator.requestedTimeToleranceAfter = CMTimeMakeWithSeconds(0.2, preferredTimescale: 600)

    if optMaxWidth > 0 || optMaxHeight > 0 {
      generator.maximumSize = CGSize(
        width: CGFloat(optMaxWidth > 0 ? optMaxWidth : 0),
        height: CGFloat(optMaxHeight > 0 ? optMaxHeight : 0)
      )
    }

    let safeTimeMs = max(0.0, optTimeMs)
    // 请求时间超出视频时长时 iOS 会直接抛错，钳制到时长内（留 50ms 余量）
    var effectiveMs = safeTimeMs
    let durationSec = CMTimeGetSeconds(asset.duration)
    if durationSec.isFinite && durationSec > 0 {
      let maxMs = max(0.0, (durationSec - 0.05) * 1000.0)
      if effectiveMs > maxMs {
        effectiveMs = maxMs
      }
    }
    let cmTime = CMTimeMakeWithSeconds(effectiveMs / 1000.0, preferredTimescale: 600)

    let cgImage: CGImage
    do {
      cgImage = try generator.copyCGImage(at: cmTime, actualTime: nil)
    } catch {
      return nil
    }

    let image = UIImage(cgImage: cgImage)
    let outFormat = (optFormat.lowercased() == "png") ? "png" : "jpg"
    guard let data = Self.imageData(image: image, format: outFormat, quality: optQuality),
          data.count > 0 else {
      return nil
    }

    let outputURL = Self.buildOutputURL(format: outFormat, fileName: optFileName)
    do {
      let dir = outputURL.deletingLastPathComponent()
      if !FileManager.default.fileExists(atPath: dir.path) {
        try FileManager.default.createDirectory(
          at: dir,
          withIntermediateDirectories: true,
          attributes: nil
        )
      }
      try data.write(to: outputURL, options: .atomic)
    } catch {
      return nil
    }

    resultPath = outputURL.absoluteString
    resultWidth = Double(image.size.width)
    resultHeight = Double(image.size.height)
    resultFormat = outFormat
    resultTimeMs = effectiveMs
    resultSize = Double(data.count)
    return "1"
  }

  @objc func getPath() -> String {
    return resultPath
  }

  @objc func getWidth() -> NSNumber {
    return NSNumber(value: resultWidth)
  }

  @objc func getHeight() -> NSNumber {
    return NSNumber(value: resultHeight)
  }

  @objc func getFormat() -> String {
    return resultFormat
  }

  @objc func getTimeMs() -> NSNumber {
    return NSNumber(value: resultTimeMs)
  }

  @objc func getSize() -> NSNumber {
    return NSNumber(value: resultSize)
  }

  private static func buildVideoURL(_ input: String) -> URL? {
    let lower = input.lowercased()
    if lower.hasPrefix("http://") || lower.hasPrefix("https://") || lower.hasPrefix("file://") {
      return URL(string: input)
    }
    return URL(fileURLWithPath: input)
  }

  private static func buildOutputURL(format: String, fileName: String) -> URL {
    let dir = FileManager.default.temporaryDirectory
      .appendingPathComponent("m-video-frame", isDirectory: true)
    let safeName = sanitizeFileName(fileName)
    let millis = Int((Date().timeIntervalSince1970 * 1000.0).rounded())
    let name = safeName.isEmpty ? "frame_\(millis)" : safeName
    return dir.appendingPathComponent("\(name).\(format)")
  }

  private static func sanitizeFileName(_ fileName: String) -> String {
    let trimmed = fileName.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      return ""
    }
    let step1 = trimmed.replacingOccurrences(
      of: "[\\\\/:*?\"<>|\\s]+",
      with: "_",
      options: .regularExpression
    )
    return step1.replacingOccurrences(
      of: "\\.(jpg|jpeg|png)$",
      with: "",
      options: [.regularExpression, .caseInsensitive]
    )
  }

  private static func imageData(image: UIImage, format: String, quality: Double) -> Data? {
    if format == "png" {
      return image.pngData()
    }
    var q = quality
    if q < 1 { q = 1 }
    if q > 100 { q = 100 }
    return image.jpegData(compressionQuality: CGFloat(q / 100.0))
  }
}
