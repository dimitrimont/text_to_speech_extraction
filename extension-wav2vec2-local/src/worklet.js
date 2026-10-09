class RecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(4096);
        this.offset = 0;
    }
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
            const channelData = input[0];
            for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.offset++] = channelData[i];
                if (this.offset >= 4096) {
                    // Send a copy of the buffer
                    this.port.postMessage(new Float32Array(this.buffer));
                    this.offset = 0;
                }
            }
        }
        return true;
    }
}
registerProcessor('recorder-worklet', RecorderProcessor);

