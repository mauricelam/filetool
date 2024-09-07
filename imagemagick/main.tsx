import { ColorSpace, CompressionMethod, DensityUnit, ImageMagick, initializeImageMagick, Interlace, Magick, MagickFormat, MagickImageInfo, MagickReadSettings } from "@imagemagick/magick-wasm"
import React from "react"
import { createRoot } from "react-dom/client"
import wasm from "@imagemagick/magick-wasm/magick.wasm";

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const CANVAS = document.getElementById('canvas') as HTMLCanvasElement
const OUTPUT = createRoot(document.getElementById('output'))

async function handleFile(file: File) {
    await initializeImageMagick(new URL(wasm, import.meta.url))
    const buf = new Uint8Array(await file.arrayBuffer())
    const inputFormat = mimeTypeToFormat(file.type, file.name);
    ImageMagick.read(buf, inputFormat, (image) => {
        image.writeToCanvas(CANVAS)
    })
    const imageInfo = MagickImageInfo.create(buf, new MagickReadSettings({ format: inputFormat }))
    const downloadAs = async (format: MagickFormat) => {
        const data = ImageMagick.read(buf, inputFormat, (image) => {
            return image.write(format, (data) => data)
        })
        const outputFile = new File([data], `${getFileStem(file.name)}.${format.toLowerCase()}`)
        const url = URL.createObjectURL(outputFile)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = outputFile.name
        anchor.click()
    }
    OUTPUT.render(
        <div>
            <div>Color Space: {ColorSpace[imageInfo.colorSpace]}</div>
            <div>Compression: {CompressionMethod[imageInfo.compression]}</div>
            <div>Density: {imageInfo.density.x}{imageInfo.density.x != imageInfo.density.y ? ` x ${imageInfo.density.y}` : ''} {DensityUnit[imageInfo.density.units]}</div>
            <div>Format: {imageInfo.format}</div>
            <div>Size: {imageInfo.width} x {imageInfo.height}px</div>
            <div>Interlace: {Interlace[imageInfo.interlace]}</div>
            <div>Orientation: {OrientationType[imageInfo.orientation]}</div>
            <div>Quality: {imageInfo.quality}</div>
            <label>Convert to:</label>
            <select id="outputFormat" defaultValue={MagickFormat.Png}>
                {Object.values(MagickFormat).filter(v => v !== MagickFormat.Unknown).map(v => (<option key={v}>{v}</option>))}
            </select>
            <button onClick={() => downloadAs((document.getElementById('outputFormat') as HTMLSelectElement).value as MagickFormat)}>Download</button>
        </div>
    )
}

function mimeTypeToFormat(mime: string, filename: string): MagickFormat {
    switch (mime) {
        case "image/vnd.microsoft.icon":
            return MagickFormat.Ico
        case "image/x-portable-pixmap":
            return MagickFormat.Pnm
        case "image/tiff":
            return MagickFormat.Tiff
        case "image/vnd.adobe.photoshop":
            return MagickFormat.Psd
        case "image/heif":
            return MagickFormat.Heif
        case "font/sfnt":
            return MagickFormat.Ttf
        case "image/avif":
            return MagickFormat.Avif
        default:
            if (/.*\.raw/i.test(filename)) {
                return MagickFormat.Raw
            }
            return MagickFormat.Unknown
    }
}

function getFileStem(filename: string): string {
    const dotIndex = filename.lastIndexOf('.')
    if (dotIndex === -1) {
        return filename
    }
    return filename.slice(0, dotIndex)
}

// Copied from magick-wasm/OrientationType$1
enum OrientationType {
    Undefined = 0,
    TopLeft = 1,
    TopRight = 2,
    BottomRight = 3,
    BottomLeft = 4,
    LeftTop = 5,
    RightTop = 6,
    RightBottom = 7,
    LeftBottom = 8
}

async function describeMagick(file: File) {
    const formatElems = Magick.supportedFormats.map(f => (
        <div key={f.format}>
            <div>Supported format: {f.format} ({f.supportsReading ? 'R' : ''}{f.supportsWriting ? 'W' : ''}) -- {f.description}</div>
        </div>
    ))
    OUTPUT.render(
        <div>
            <div>{Magick.delegates}</div>
            <div>{Magick.features}</div>
            <div>{Magick.imageMagickVersion}</div>
            {formatElems}
        </div>
    )
}
