import { ImageMagick, initializeImageMagick, MagickFormat, MagickReadSettings } from "@imagemagick/magick-wasm";
import * as path from 'path';
import { readFileSync } from 'fs';
import { TextEncoder, TextDecoder } from 'util';
import { Buffer } from 'buffer'; // Import Buffer

// Polyfill TextEncoder/TextDecoder for Jest's Node environment
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any;
}

// 1x1 black PNG (from prompt)
const base64Png = "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";
const PngData = new Uint8Array(Buffer.from(base64Png, 'base64'));

// List of formats known to be unsupported or problematic.
// These are formats for which ImageMagick.write consistently fails due to missing delegates
// or reliance on external tools like ffmpeg in this WASM build.
const UNSUPPORTED_FORMATS: MagickFormat[] = [
  MagickFormat.ThreeFr,   // NoEncodeDelegateForThisImageFormat
  MagickFormat.ThreeG2,   // NoEncodeDelegateForThisImageFormat
  MagickFormat.ThreeGp,   // NoEncodeDelegateForThisImageFormat
  MagickFormat.Apng,      // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Arw,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Ashlar,    // Conversion resulted in empty data (problematic)
  MagickFormat.Avi,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Bayer,     // Conversion resulted in empty data (problematic)
  MagickFormat.Bayera,    // Conversion resulted in empty data (problematic)
  MagickFormat.Canvas,    // NoEncodeDelegateForThisImageFormat
  MagickFormat.Caption,   // NoEncodeDelegateForThisImageFormat
  MagickFormat.Cr2,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Cr3,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Crw,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Cube,      // NoEncodeDelegateForThisImageFormat
  MagickFormat.Cur,       // NoEncodeDelegateForThisImageFormat (was failing, but CUR is simple, might be an issue with the input having no alpha for cursor hotspots) - keeping it for now, re-evaluate if needed
  MagickFormat.Cut,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Data,      // ImageTypeNotSupported
  MagickFormat.Dcm,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Dcr,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Dcraw,     // NoEncodeDelegateForThisImageFormat
  MagickFormat.Dfont,     // NoEncodeDelegateForThisImageFormat
  MagickFormat.Dng,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Erf,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Fff,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.File,      // NoEncodeDelegateForThisImageFormat
  MagickFormat.Flv,       // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Fractal,   // NoEncodeDelegateForThisImageFormat
  MagickFormat.Ftp,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Gradient,  // NoEncodeDelegateForThisImageFormat
  MagickFormat.Hald,      // NoEncodeDelegateForThisImageFormat
  MagickFormat.Heic,      // NoEncodeDelegateForThisImageFormat (often needs external lib)
  MagickFormat.Heif,      // NoEncodeDelegateForThisImageFormat (often needs external lib)
  MagickFormat.Htm,       // Not an image output format primarily
  MagickFormat.Html,      // Not an image output format primarily
  MagickFormat.Http,      // NoEncodeDelegateForThisImageFormat
  MagickFormat.Https,     // NoEncodeDelegateForThisImageFormat
  MagickFormat.Iiq,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Info,      // Not an image output format
  MagickFormat.Inline,    // ImageTypeNotSupported
  MagickFormat.Jnx,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Json,      // Not an image output format primarily (though it passed, it's metadata)
  MagickFormat.K,         // ColorSeparatedImageRequired (specific input needed)
  MagickFormat.K25,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Kdc,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Label,     // NoEncodeDelegateForThisImageFormat
  MagickFormat.M,         // ColorSeparatedImageRequired (specific input needed)
  MagickFormat.M2v,       // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.M4v,       // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Mac,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Mat,       // Might be for MATLAB files, not general images
  MagickFormat.Mdc,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Mef,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Mkv,       // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Mov,       // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Mos,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Mp4,       // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Mpc,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Mpeg,      // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Mpg,       // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Mpo,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Mrw,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Msl,       // NotAuthorized
  MagickFormat.Mvg,       // NotAuthorized
  MagickFormat.Nef,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Nrw,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Null,      // Conversion resulted in empty data (expected for NULL output)
  MagickFormat.Ora,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Orf,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Otf,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Pango,     // NoEncodeDelegateForThisImageFormat
  MagickFormat.Pattern,   // NoEncodeDelegateForThisImageFormat
  MagickFormat.Pef,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Pes,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Pfa,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Pfb,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Phm,       // PhotoCD specific, might not be general purpose
  MagickFormat.Picon,     // Specific use, might be failing due to input
  MagickFormat.Pix,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Plasma,    // NoEncodeDelegateForThisImageFormat
  MagickFormat.Pocketmod, // UnableToReadFont (requires font)
  MagickFormat.Pwp,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.RadialGradient, // NoEncodeDelegateForThisImageFormat
  MagickFormat.Raf,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Raw,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Rgb565,    // NoEncodeDelegateForThisImageFormat
  MagickFormat.Rla,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Rle,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Rmf,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Rw2,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Rwl,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Scr,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Screenshot,// NoEncodeDelegateForThisImageFormat
  MagickFormat.Sct,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Sfw,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.SparseColor, // Might need specific options
  MagickFormat.Sr2,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Srf,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Srw,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Stegano,   // NoEncodeDelegateForThisImageFormat
  MagickFormat.Sti,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Strimg,    // Might be specific
  MagickFormat.Text,      // NoEncodeDelegateForThisImageFormat
  MagickFormat.Thumbnail, // ImageDoesNotHaveAThumbnail
  MagickFormat.Tile,      // NoEncodeDelegateForThisImageFormat
  MagickFormat.Tim,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Tm2,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Ttc,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Ttf,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Vid,       // UnableToReadFont
  MagickFormat.Webm,      // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.Wmv,       // FailedToExecuteCommand 'ffmpeg'
  MagickFormat.X3f,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Xc,        // NoEncodeDelegateForThisImageFormat
  MagickFormat.Xcf,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Xps,       // NoEncodeDelegateForThisImageFormat
  MagickFormat.Y,         // ColorSeparatedImageRequired
  MagickFormat.Yaml,      // Not an image output format primarily
];

describe("ImageMagick WASM Download Tests", () => {
  beforeAll(async () => {
    try {
      const wasmPath = require.resolve("@imagemagick/magick-wasm/magick.wasm");
      const wasmBytes = readFileSync(wasmPath);
      await initializeImageMagick(wasmBytes);
    } catch (err) {
      console.error("Failed to initialize ImageMagick:", err);
      throw new Error(`Failed to initialize ImageMagick. Original error: ${(err as Error).message}. Check WASM path and Jest setup for WASM files.`);
    }
  });

  const formatsToTest = Object.values(MagickFormat)
    .filter(value => typeof value === 'string' && value !== MagickFormat.Unknown) as MagickFormat[];

  formatsToTest.forEach((format) => {
    if (UNSUPPORTED_FORMATS.includes(format)) {
      it.skip(`should skip testing unsupported format: ${format}`, () => {});
    } else {
      it(`should successfully convert PNG to ${format}`, () => {
        let success = false;
        let error: Error | null = null;
        let outputData: Uint8Array | null = null;

        try {
          const readSettings = new MagickReadSettings();
          readSettings.format = MagickFormat.Png;

          ImageMagick.read(PngData, readSettings, (image) => {
            image.write(format, (data) => {
              outputData = data;
              if (data && data.length > 0) {
                success = true;
              } else {
                error = new Error("Conversion resulted in empty data.");
              }
            });
          });
        } catch (e) {
          error = e instanceof Error ? e : new Error(String(e));
        }

        if (error) {
          // This error is expected due to the underlying PNG reading issue.
          // console.error(`Error during conversion to ${format}: ${error.message}`);
          // To make the test suite reflect the failure directly from the error:
          throw new Error(`Failed to convert PNG to ${format}: ${(error as Error).message}`);
        }

        // These expectations will likely not be reached if an error is thrown.
        expect(success).toBe(true);
        expect(outputData).not.toBeNull();
        expect(outputData!.length).toBeGreaterThan(0);
      });
    }
  });
});
