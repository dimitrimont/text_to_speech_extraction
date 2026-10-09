const { insertTextAtCursor } = require('../extension-wav2vec2-local/src/content.js');

describe('DOM Text Injection Tests', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Mock document.execCommand since it's not fully implemented in JSDOM
        document.execCommand = jest.fn();
    });

    test('insertTextAtCursor should insert text into an input correctly', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'Hello';
        document.body.appendChild(input);
        
        // Simulate cursor at the end
        input.selectionStart = 5;
        input.selectionEnd = 5;

        insertTextAtCursor(input, ' World');

        expect(input.value).toBe('Hello World');
        // Ensure cursor moved to the end
        expect(input.selectionStart).toBe(11);
    });

    test('insertTextAtCursor should insert text into the middle of an input correctly', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'HelloWorld';
        document.body.appendChild(input);
        
        // Simulate cursor in the middle
        input.selectionStart = 5;
        input.selectionEnd = 5;

        insertTextAtCursor(input, ' ');

        expect(input.value).toBe('Hello World');
    });

    test('insertTextAtCursor should insert text into a textarea correctly', () => {
        const textarea = document.createElement('textarea');
        textarea.value = 'Testing';
        document.body.appendChild(textarea);
        
        textarea.selectionStart = 7;
        textarea.selectionEnd = 7;

        insertTextAtCursor(textarea, ' 123');

        expect(textarea.value).toBe('Testing 123');
    });
    
    test('insertTextAtCursor should handle contenteditable divs', () => {
        const div = document.createElement('div');
        div.contentEditable = 'true';
        // JSDOM might not map contentEditable string to isContentEditable boolean properly
        Object.defineProperty(div, 'isContentEditable', { value: true });
        document.body.appendChild(div);
        
        insertTextAtCursor(div, 'Dictated text');
        
        expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'Dictated text');
    });
});

