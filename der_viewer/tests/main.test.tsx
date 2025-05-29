import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import DerViewer from '../main'; // Adjust path as necessary

describe('DerViewer Component', () => {
  let fileContent: ArrayBuffer;

  beforeAll(() => {
    // Construct the path to the sample.der file
    // __dirname in Jest will be the directory of the test file (der_viewer/tests/)
    const filePath = path.join(__dirname, '../examples/sample.der');
    
    // Read the file into a Node.js Buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Convert Node.js Buffer to ArrayBuffer
    // Create a new ArrayBuffer with the same byte length as the Buffer
    const arrayBuffer = new ArrayBuffer(fileBuffer.length);
    // Create a Uint8Array view on the ArrayBuffer
    const uint8Array = new Uint8Array(arrayBuffer);
    // Copy the data from the Buffer to the Uint8Array
    for (let i = 0; i < fileBuffer.length; ++i) {
      uint8Array[i] = fileBuffer[i];
    }
    fileContent = arrayBuffer;
  });

  test('renders certificate details from sample.der', async () => {
    render(<DerViewer fileContent={fileContent} />);

    // Check for general structure/labels
    // Using findByText for asynchronous rendering if data parsing takes time
    expect(await screen.findByText('X.509 Certificate Details')).toBeInTheDocument();
    expect(await screen.findByText('General')).toBeInTheDocument();
    expect(await screen.findByText('Subject')).toBeInTheDocument();
    expect(await screen.findByText('Issuer')).toBeInTheDocument();
    
    // Check for specific issuer information from the badssl.com-client certificate
    // The issuer is "C=US, ST=California, L=San Francisco, O=BadSSL, CN=BadSSL Intermediate Certificate Authority"
    // The formatRDNs function turns this into "C=US, O=BadSSL, CN=BadSSL Intermediate Certificate Authority"
    // (or similar based on what OIDs it explicitly handles)
    // We will look for a significant part of it.
    const issuerValue = await screen.findByText(/BadSSL Intermediate Certificate Authority/i);
    expect(issuerValue).toBeInTheDocument();

    // Check for a part of the subject: CN=badssl.com, O=BadSSL, L=San Francisco, ST=California, C=US
    // formatRDNs might simplify this, so we'll look for "badssl.com"
    const subjectValue = await screen.findByText(/badssl.com/i);
    expect(subjectValue).toBeInTheDocument();

    // Check if the serial number is displayed. The actual value might be too brittle for a test,
    // but we can check for its label.
    expect(await screen.findByText('Serial Number')).toBeInTheDocument();
    
    // Example of checking an extension, if we know one from sample.der
    // For instance, if we know Subject Key Identifier is present:
    // const skiExtension = await screen.findByText('Subject Key Identifier');
    // expect(skiExtension).toBeInTheDocument();
    // This part would require prior knowledge of sample.der's extensions.
    // The sample.der from badssl.com-client.pem includes a Subject Key Identifier.
    // The OID is 2.5.29.14
    const skiExtName = await screen.findByText(/Subject Key Identifier/i);
    expect(skiExtName).toBeInTheDocument();

  });

  test('handles null fileContent gracefully', async () => {
    render(<DerViewer fileContent={null as any} />);
    // Expect to see the loading/no file message, or at least no error thrown
    expect(await screen.findByText(/Loading certificate data or no file selected.../i)).toBeInTheDocument();
  });

  test('handles empty fileContent gracefully', async () => {
    render(<DerViewer fileContent={new ArrayBuffer(0)} />);
    expect(await screen.findByText(/Loading certificate data or no file selected.../i)).toBeInTheDocument();
  });

  test('handles invalid DER content', async () => {
    const invalidContent = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]).buffer;
    render(<DerViewer fileContent={invalidContent} />);
    // Check for the error message
    expect(await screen.findByText(/Error: Could not parse DER content./i)).toBeInTheDocument();
  });

});
