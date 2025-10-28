import { WASMagic, WASMagicFlags } from "wasmagic";
import HANDLERS from '../main/handlers';
import { matchMimetype } from '../main/handlers';

const MAGIC = WASMagic.create({
    flags: WASMagicFlags.NONE,
    stdio: (name, text) => console.log(text)
});

const MIMEMAGIC = WASMagic.create({
    flags: WASMagicFlags.MIME_TYPE,
    stdio: (name, text) => console.log(text)
});

export async function getHandlerForFile(file: File): Promise<string | null> {
    const [magic, mimeMagic] = await Promise.all([MAGIC, MIMEMAGIC]);
    const fileBuf = new Uint8Array(await file.arrayBuffer());
    const mime = mimeMagic.detect(fileBuf);
    const fileDescription = magic.detect(fileBuf);
    let handlerUrl: string | null = null;
    for (const handler of HANDLERS) {
        const match = handler.mimetypes.some(m => matchMimetype(m, mime, file.name, fileDescription));
        if (match) {
            handlerUrl = handler.handler;
            break;
        }
    }
    return handlerUrl;
}
