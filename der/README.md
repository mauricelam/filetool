# DER Certificate Handler

A handler for X.509 certificates and other DER-encoded files that displays certificate information and structure.

## Features

- Parse and display X.509 certificates
- Support for DER and PEM encoded files
- Certificate chain visualization
- Subject and issuer information
- Validity period display
- Public key details
- Signature verification status

## Supported File Types

- **.der** - Distinguished Encoding Rules binary files
- **.crt** - Certificate files
- **.cer** - Certificate files
- **.pem** - Privacy Enhanced Mail encoded certificates
- **.p7b** - PKCS#7 certificate bundles
- **.p12** - PKCS#12 certificate stores

## Usage

1. Drag and drop a certificate file into the main application
2. The DER handler will automatically open for supported files
3. View certificate details and structure
4. Examine the certificate chain
5. Check validity and signature information

## Implementation Details

- Built with Go and compiled to WebAssembly
- Uses custom Go libraries for DER parsing and certificate handling
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **Go crypto libraries** - X.509 certificate parsing and validation
- **der-ascii** - DER to ASCII conversion utilities
- WebAssembly - Go-compiled binary

## Development

```bash
# Install Go dependencies
go mod tidy

# Build the handler
npm run build

# Watch for changes
npm run watch
```

## Testing

```bash
npm test
```

## File Structure

```
der/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── main.go            # Go certificate parsing code
├── go.mod             # Go dependencies
├── go.sum             # Go dependency checksums
├── wasm/              # WebAssembly build output
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file loading and certificate display
- **main.go** - Go code that parses DER-encoded certificate files
- **wasm/** - Compiled WebAssembly output from Go code

The handler uses Go crypto libraries compiled to WebAssembly to parse X.509 certificates. Certificate information is displayed in a structured format showing subject, issuer, validity, and key details.

## TODO

- Add support for certificate chain validation

## Certificate Features

- **X.509 Parsing** - Full certificate structure analysis
- **Subject/Issuer** - Distinguished name information
- **Validity Period** - Not before/after dates
- **Public Key** - Algorithm and key details
- **Extensions** - Certificate extensions and policies
- **Signature** - Algorithm and verification status

## DER Processing

- Binary format parsing
- ASN.1 structure analysis
- Certificate validation
- Chain building
- Error reporting
- Performance optimization
