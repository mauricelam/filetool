import React from 'react'; // Import React for JSX
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'; // For extended matchers like .toHaveClass
import { offset, renderAscii, renderHex } from './hex';

// Basic test structure - keep it if other tests for HexViewer component will be added later
describe('HexViewer component', () => {
  it('should render correctly', () => {
    // Add test logic here if needed for the component itself
  });
});

describe('offset function', () => {
  it('should return correct offset for line number 0', () => {
    expect(offset(0, new Uint8Array(256))).toBe('000000');
  });

  it('should return correct offset for different line numbers with small buffer', () => {
    expect(offset(1, new Uint8Array(256))).toBe('000010');
    expect(offset(10, new Uint8Array(256))).toBe('0000A0');
    expect(offset(15, new Uint8Array(256))).toBe('0000F0');
  });

  it('should return correct offset for buffer size where hex length of buffer.length is < 6 (e.g. 0xFFFFF)', () => {
    const bufferSize = 0xFFFFF; // buffer.length.toString(16) is "FFFFF" (length 5), so pad to 6
    expect(offset(0, new Uint8Array(bufferSize))).toBe('000000');
    expect(offset(1, new Uint8Array(bufferSize))).toBe('000010');
    expect(offset(255, new Uint8Array(bufferSize))).toBe('000FF0'); // 255*16 = 4080 = FF0
  });

  it('should return correct offset for buffer size where hex length of buffer.length is > 6 (e.g. 0x1000000)', () => {
    const bufferSize = 0x1000000; // buffer.length.toString(16) is "1000000" (length 7), so pad to 7
    expect(offset(0, new Uint8Array(bufferSize))).toBe('0000000');
    expect(offset(1, new Uint8Array(bufferSize))).toBe('0000010');
    expect(offset(256, new Uint8Array(bufferSize))).toBe('0001000'); // 256*16 = 4096 = 1000
    expect(offset(4095, new Uint8Array(bufferSize))).toBe('000FFF0'); // 4095*16 = 65520 = FFF0
  });

  it('should return correct offset for buffer size where hex length of buffer.length is 8 (e.g. 0x7FFFFFFF)', () => {
    const bufferSize = 0x7FFFFFFF; // buffer.length.toString(16) is "7FFFFFFF" (length 8), so pad to 8
    expect(offset(0, new Uint8Array(bufferSize))).toBe('00000000');
    expect(offset(1, new Uint8Array(bufferSize))).toBe('00000010');
    expect(offset(0xABCDE, new Uint8Array(bufferSize))).toBe('00ABCDE0'); // 0xABCDE * 16 = ABCDE0
  });

  it('should always return uppercase hex characters and handle padding correctly', () => {
    // buffer.length = 71168 (0x11600), length is 5. Pad to 6.
    // line = 278 (0x116). line * 16 = 4448 (0x1160)
    expect(offset(278, new Uint8Array(256 * 278))).toBe('001160');
  });

  it('should handle buffer length that is exactly 6 hex chars (e.g. 0x100000)', () => {
    const bufferSize = 0x100000; // buffer.length.toString(16) is "100000" (length 6). Pad to 6.
    expect(offset(0, new Uint8Array(bufferSize))).toBe('000000');
    expect(offset(1, new Uint8Array(bufferSize))).toBe('000010');
  });
});

describe('renderAscii function', () => {
  const renderAndGetSpansForAscii = (line: number, buffer: Uint8Array) => {
    const { container } = render(React.createElement(React.Fragment, null, renderAscii(line, buffer)));
    return container.querySelectorAll('span');
  };

  it('should render only printable ASCII characters correctly', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(5);
    expect(spans[0].textContent).toBe('H');
    expect(spans[0]).toHaveClass('char_ascii');
    expect(spans[4].textContent).toBe('o');
    expect(spans[4]).toHaveClass('char_ascii');
    expect(Array.from(spans).every(span => span.classList.contains('char_ascii'))).toBe(true);
  });

  it('should render only null characters correctly', () => {
    const data = new Uint8Array([0, 0, 0]);
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(3);
    spans.forEach(span => {
      expect(span.textContent).toBe('.');
      expect(span).toHaveClass('char_null');
    });
  });

  it('should render non-printable, non-null characters correctly based on function logic', () => {
    const data = new Uint8Array([0x01, 0x1f, 0x7f, 0x80, 0x9F, 0xA0, 0xFF]);
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(7);

    expect(spans[0].textContent).toBe('.'); expect(spans[0]).toHaveClass('char_unknown'); // 0x01
    expect(spans[1].textContent).toBe('.'); expect(spans[1]).toHaveClass('char_unknown'); // 0x1f
    expect(spans[2].textContent).toBe('.'); expect(spans[2]).toHaveClass('char_unknown'); // 0x7f
    expect(spans[3].textContent).toBe('.'); expect(spans[3]).toHaveClass('char_unknown'); // 0x80
    expect(spans[4].textContent).toBe('.'); expect(spans[4]).toHaveClass('char_unknown'); // 0x9F
    expect(spans[5].textContent).toBe('\u00A0'); expect(spans[5]).toHaveClass('char_ascii');   // 0xA0 (NBSP)
    expect(spans[6].textContent).toBe('ÿ'); expect(spans[6]).toHaveClass('char_ascii');   // 0xFF (Latin y with diaeresis)
  });

  it('should render a mix of ASCII, null, and other characters', () => {
    const data = new Uint8Array([0x41, 0, 0x05, 0x42, 0x81, 0xA5]); // 'A', NULL, ENQ, 'B', 0x81 (unknown), 0xA5 (ascii)
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(6);

    expect(spans[0].textContent).toBe('A'); expect(spans[0]).toHaveClass('char_ascii');
    expect(spans[1].textContent).toBe('.'); expect(spans[1]).toHaveClass('char_null');
    expect(spans[2].textContent).toBe('.'); expect(spans[2]).toHaveClass('char_unknown'); // 0x05
    expect(spans[3].textContent).toBe('B'); expect(spans[3]).toHaveClass('char_ascii');
    expect(spans[4].textContent).toBe('.'); expect(spans[4]).toHaveClass('char_unknown'); // 0x81 (129)
    expect(spans[5].textContent).toBe('¥'); expect(spans[5]).toHaveClass('char_ascii'); // 0xA5 (YEN SIGN)
  });

  it('should render an empty buffer correctly', () => {
    const data = new Uint8Array([]);
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(0);
  });

  it('should render a buffer smaller than 16 bytes correctly', () => {
    const data = new Uint8Array([0x31, 0x32, 0x33]); // "123"
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(3);
    expect(spans[0].textContent).toBe('1');
    expect(spans[1].textContent).toBe('2');
    expect(spans[2].textContent).toBe('3');
    Array.from(spans).forEach(s => expect(s).toHaveClass('char_ascii'));
  });

  it('should render the first line of a buffer larger than 16 bytes', () => {
    const data = new Uint8Array(20);
    for(let i=0; i<16; i++) data[i] = 0x41 + i; // A, B, C ... P
    data[16] = 0x5A; // Z on next line
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(16);
    expect(spans[0].textContent).toBe('A');
    expect(spans[0]).toHaveClass('char_ascii');
    expect(spans[15].textContent).toBe('P');
    expect(spans[15]).toHaveClass('char_ascii');
  });

  it('should render the second line of a buffer larger than 16 bytes', () => {
    const data = new Uint8Array(20);
    for(let i=0; i<16; i++) data[i] = 0x41 + i; // A...P on first line
    data[16] = 0x5A; // Z
    data[17] = 0x00; // NULL
    data[18] = 0x07; // BEL (char_unknown)
    data[19] = 0x61; // a (char_ascii)
    const spans = renderAndGetSpansForAscii(1, data); // Render line 1 (second line)
    expect(spans.length).toBe(4); // 20 - 16 = 4 bytes on the second line

    expect(spans[0].textContent).toBe('Z');
    expect(spans[0]).toHaveClass('char_ascii');

    expect(spans[1].textContent).toBe('.');
    expect(spans[1]).toHaveClass('char_null');

    expect(spans[2].textContent).toBe('.');
    expect(spans[2]).toHaveClass('char_unknown');

    expect(spans[3].textContent).toBe('a');
    expect(spans[3]).toHaveClass('char_ascii');
  });

  it('should handle extended ASCII characters (values > 159) as printable', () => {
    const data = new Uint8Array([0xA0, 0xC4, 0xFF]); // NBSP, A-diaeresis, y-diaeresis
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(3);

    expect(spans[0].textContent).toBe('\u00A0'); // Non-breaking space
    expect(spans[0]).toHaveClass('char_ascii');
    expect(spans[1].textContent).toBe('Ä');   // Latin A with diaeresis
    expect(spans[1]).toHaveClass('char_ascii');
    expect(spans[2].textContent).toBe('ÿ');   // Latin y with diaeresis
    expect(spans[2]).toHaveClass('char_ascii');
  });

  it('should handle boundary control characters (0x01-0x1F, 0x7F) and midrange non-standard (0x80-0x9F)', () => {
    const data = new Uint8Array([0x1E, 0x1F, 0x7F, 0x80, 0x9F]); // RS, US, DEL, PUA, unspecified
    const spans = renderAndGetSpansForAscii(0, data);
    expect(spans.length).toBe(5);
    expect(spans[0].textContent).toBe('.'); expect(spans[0]).toHaveClass('char_unknown'); // 0x1E
    expect(spans[1].textContent).toBe('.'); expect(spans[1]).toHaveClass('char_unknown'); // 0x1F
    expect(spans[2].textContent).toBe('.'); expect(spans[2]).toHaveClass('char_unknown'); // 0x7F
    expect(spans[3].textContent).toBe('.'); expect(spans[3]).toHaveClass('char_unknown'); // 0x80
    expect(spans[4].textContent).toBe('.'); expect(spans[4]).toHaveClass('char_unknown'); // 0x9F
  });
});

describe('renderHex function', () => {
  const renderAndGetSpansForHex = (line: number, buffer: Uint8Array) => {
    const { container } = render(React.createElement(React.Fragment, null, renderHex(line, buffer)));
    return container.querySelectorAll('span');
  };

  it('should render various byte values with correct hex, spacing, and classes', () => {
    const data = new Uint8Array([0x48, 0x00, 0x05, 0xFF, 0xA1]); // H, NULL, ENQ, 0xFF, 0xA1
    // Expected: 48 00 05 FF A1
    // Classes: ascii, null, unknown, ascii, ascii
    const spans = renderAndGetSpansForHex(0, data);
    expect(spans.length).toBe(5);

    expect(spans[0].textContent).toBe('48'); // No leading space
    expect(spans[0]).toHaveClass('char_ascii');
    expect(spans[1].textContent).toBe(' 00'); // Leading space
    expect(spans[1]).toHaveClass('char_null');
    expect(spans[2].textContent).toBe(' 05');
    expect(spans[2]).toHaveClass('char_unknown');
    expect(spans[3].textContent).toBe(' FF');
    expect(spans[3]).toHaveClass('char_ascii'); // 0xFF > 159
    expect(spans[4].textContent).toBe(' A1');
    expect(spans[4]).toHaveClass('char_ascii'); // 0xA1 > 159
  });

  it('should render an empty buffer correctly', () => {
    const data = new Uint8Array([]);
    const spans = renderAndGetSpansForHex(0, data);
    expect(spans.length).toBe(0);
  });

  it('should render a buffer smaller than 16 bytes correctly', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]); // 01 02 03
    const spans = renderAndGetSpansForHex(0, data);
    expect(spans.length).toBe(3);
    expect(spans[0].textContent).toBe('01');
    expect(spans[0]).toHaveClass('char_unknown');
    expect(spans[1].textContent).toBe(' 02');
    expect(spans[1]).toHaveClass('char_unknown');
    expect(spans[2].textContent).toBe(' 03');
    expect(spans[2]).toHaveClass('char_unknown');
  });

  it('should render the first line of a buffer larger than 16 bytes', () => {
    const data = new Uint8Array(20);
    for(let i=0; i<16; i++) data[i] = i; // 00 01 ... 0F
    data[16] = 0x10;
    const spans = renderAndGetSpansForHex(0, data);
    expect(spans.length).toBe(16);
    expect(spans[0].textContent).toBe('00');
    expect(spans[0]).toHaveClass('char_null');
    expect(spans[1].textContent).toBe(' 01');
    expect(spans[1]).toHaveClass('char_unknown');
    expect(spans[15].textContent).toBe(' 0F'); // 15 = 0F
    expect(spans[15]).toHaveClass('char_unknown');
  });

  it('should render the second line of a buffer larger than 16 bytes', () => {
    const data = new Uint8Array(20);
    for(let i=0; i<16; i++) data[i] = i; // First line 00-0F
    data[16] = 0xAA;
    data[17] = 0xBB;
    data[18] = 0xCC;
    data[19] = 0xDD;
    // Expected on line 2 (index 1): AA BB CC DD
    const spans = renderAndGetSpansForHex(1, data);
    expect(spans.length).toBe(4);

    expect(spans[0].textContent).toBe('AA'); // 0xAA > 159 -> char_ascii
    expect(spans[0]).toHaveClass('char_ascii');
    expect(spans[1].textContent).toBe(' BB'); // 0xBB > 159 -> char_ascii
    expect(spans[1]).toHaveClass('char_ascii');
    expect(spans[2].textContent).toBe(' CC'); // 0xCC > 159 -> char_ascii
    expect(spans[2]).toHaveClass('char_ascii');
    expect(spans[3].textContent).toBe(' DD'); // 0xDD > 159 -> char_ascii
    expect(spans[3]).toHaveClass('char_ascii');
  });

  it('should ensure all hex values are uppercase and zero-padded', () => {
    const data = new Uint8Array([0x0a, 0x0f, 0xa1, 0xf0]); // 0A 0F A1 F0
    const spans = renderAndGetSpansForHex(0, data);
    expect(spans.length).toBe(4);
    expect(spans[0].textContent).toBe('0A');
    expect(spans[1].textContent).toBe(' 0F');
    expect(spans[2].textContent).toBe(' A1');
    expect(spans[3].textContent).toBe(' F0');
  });
});
