/**
 * Quick test: AWS Rekognition CompareFaces
 *
 * Usage:
 *   node scripts/test-rekognition.mjs <source.jpg> <target.jpg>
 *
 * Both images should be face photos. Returns similarity percentage.
 */
import { readFileSync } from "fs";
import {
  RekognitionClient,
  CompareFacesCommand,
} from "@aws-sdk/client-rekognition";

const client = new RekognitionClient({
  region: "ap-southeast-1",
  credentials: {
    accessKeyId: "AKIA4WPT62WSHGL443GB",
    secretAccessKey: "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",
  },
});

const [sourceFile, targetFile] = process.argv.slice(2);
if (!sourceFile || !targetFile) {
  console.error("Usage: node test-rekognition.mjs <source.jpg> <target.jpg>");
  process.exit(1);
}

const source = readFileSync(sourceFile);
const target = readFileSync(targetFile);

const resp = await client.send(
  new CompareFacesCommand({
    SourceImage: { Bytes: source },
    TargetImage: { Bytes: target },
    SimilarityThreshold: 0,
  })
);

console.log(`Source face confidence: ${resp.SourceImageFace?.Confidence?.toFixed(1)}%`);

if (resp.FaceMatches?.length) {
  for (const match of resp.FaceMatches) {
    console.log(`MATCH: ${match.Similarity?.toFixed(6)}% similarity`);
  }
} else {
  console.log("NO MATCH");
}

if (resp.UnmatchedFaces?.length) {
  console.log(`Unmatched faces in target: ${resp.UnmatchedFaces.length}`);
}
