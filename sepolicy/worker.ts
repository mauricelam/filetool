
import createModule from './sepolicy.js';

const init = async () => {
    const module = await createModule();

    self.onmessage = async (event) => {
        const { file, command } = event.data;

        const buffer = await file.arrayBuffer();
        const fileName = file.name;

        module.FS.writeFile(fileName, new Uint8Array(buffer));

        let output = '';
        const stdout = (char: number) => {
            output += String.fromCharCode(char);
        };

        module.stdout = stdout;
        module.stderr = stdout;

        try {
            module.callMain(command);
        } catch (e) {
            console.error(e);
        }

        self.postMessage({ output });
    };

    self.postMessage({ ready: true });
};

init();
