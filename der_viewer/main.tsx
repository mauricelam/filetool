import React, { useEffect, useState } from 'react';
import { Certificate, GeneralName, RelativeDistinguishedNames, Extension, BasicConstraints, KeyUsage, ExtKeyUsage, RSAPublicKey } from 'pkijs';
import { fromBER } from 'asn1js';

interface DerViewerProps {
  fileContent: ArrayBuffer;
}

// Helper function to convert ArrayBuffer to hex string
const bufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Helper function to format RDNs (Relative Distinguished Names)
const formatRDNs = (rdn: RelativeDistinguishedNames): string => {
  return rdn.typesAndValues.map(tv => {
    let typeStr = tv.type;
    // Attempt to map OID to a friendly name
    // Common OIDs can be added here
    if (tv.type === '2.5.4.6') typeStr = 'C';
    else if (tv.type === '2.5.4.10') typeStr = 'O';
    else if (tv.type === '2.5.4.11') typeStr = 'OU';
    else if (tv.type === '2.5.4.3') typeStr = 'CN';
    else if (tv.type === '2.5.4.7') typeStr = 'L';
    else if (tv.type === '2.5.4.8') typeStr = 'ST';
    else if (tv.type === '0.9.2342.19200300.100.1.25') typeStr = 'DC';
    else if (tv.type === '1.2.840.113549.1.9.1') typeStr = 'emailAddress';
    return `${typeStr}=${tv.value.valueBlock.value}`;
  }).join(', ');
};

const oidNameMapping: { [oid: string]: string } = {
  '2.5.29.14': 'Subject Key Identifier',
  '2.5.29.15': 'Key Usage',
  '2.5.29.17': 'Subject Alternative Name',
  '2.5.29.19': 'Basic Constraints',
  '2.5.29.31': 'CRL Distribution Points',
  '2.5.29.32': 'Certificate Policies',
  '2.5.29.35': 'Authority Key Identifier',
  '2.5.29.37': 'Extended Key Usage',
  '1.3.6.1.5.5.7.1.1': 'Authority Information Access',
  // Add more common OIDs here
};

const getOidName = (oid: string): string => {
  return oidNameMapping[oid] || oid;
}

const DerViewer: React.FC<DerViewerProps> = ({ fileContent }) => {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsedCertData, setParsedCertData] = useState<any | null>(null);

  useEffect(() => {
    if (!fileContent || fileContent.byteLength === 0) {
      setError(null);
      setCertificate(null);
      setParsedCertData(null);
      return;
    }

    try {
      setError(null);
      setCertificate(null); // Clear previous cert
      setParsedCertData(null); // Clear previous data

      const asn1 = fromBER(fileContent);
      if (asn1.offset === -1) {
        throw new Error("Failed to parse ASN.1 from BER. The file might not be in DER format or is corrupted.");
      }

      const cert = new Certificate({ schema: asn1.result });
      setCertificate(cert); // Storing the full cert object might be useful for debugging or future features

      const data: any = {};
      data.version = cert.version + 1; // PKIjs version is 0-indexed
      data.serialNumber = bufferToHex(cert.serialNumber.valueBlock.valueHexView);
      
      data.subject = formatRDNs(cert.subject);
      data.issuer = formatRDNs(cert.issuer);

      data.notBefore = cert.notBefore.value.toLocaleString();
      data.notAfter = cert.notAfter.value.toLocaleString();

      data.signatureAlgorithm = getOidName(cert.signatureAlgorithm.algorithmId);
      data.signatureValue = bufferToHex(cert.signatureValue.valueBlock.valueHexView);
      
      data.publicKeyAlgorithm = getOidName(cert.subjectPublicKeyInfo.algorithm.algorithmId);
      // Extract public key details
      if (cert.subjectPublicKeyInfo.algorithm.algorithmId === "1.2.840.113549.1.1.1") { // RSA
        const rsaPublicKey = new RSAPublicKey({ schema: cert.subjectPublicKeyInfo.parsedKey.fromBER(cert.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView) });
        data.publicKey = {
          modulus: bufferToHex(rsaPublicKey.modulus.valueBlock.valueHexView),
          publicExponent: bufferToHex(rsaPublicKey.publicExponent.valueBlock.valueHexView),
        };
      } else {
         data.publicKey = bufferToHex(cert.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView);
      }


      // Extensions
      data.extensions = [];
      if (cert.extensions) {
        for (const ext of cert.extensions) {
          const extEntry: any = {
            oid: ext.extnID,
            name: getOidName(ext.extnID),
            critical: ext.critical,
            value: null, // Placeholder for parsed value
          };

          try {
            if (ext.parsedValue) { // PKIjs often provides a parsedValue
                if (ext.extnID === '2.5.29.17') { // Subject Alternative Name
                    const altNames = ext.parsedValue as GeneralName; // Assuming GeneralName type based on common usage
                    // This is a simplification. SAN can have various forms (DNS, IP, etc.)
                    // and `altNames.toJSON()` might be a good way to get a serializable form.
                    // For a more detailed display, you'd iterate `altNames.names` if it's an array
                    // or handle different GeneralName types.
                     extEntry.value = altNames.names.map((name: GeneralName) => {
                        let value = name.value;
                        if (typeof name.value !== "string" && name.value.valueBlock && name.value.valueBlock.value) {
                           value = name.value.valueBlock.value; // for things like DirectoryName
                        }
                        return `Type: ${name.type}, Value: ${value}`;
                    }).join('; ');

                } else if (ext.extnID === '2.5.29.19') { // Basic Constraints
                    const basicConstraints = ext.parsedValue as BasicConstraints;
                    extEntry.value = {
                        isCA: basicConstraints.cA || false,
                        pathLenConstraint: basicConstraints.pathLenConstraint !== undefined ? basicConstraints.pathLenConstraint : 'None',
                    };
                } else if (ext.extnID === '2.5.29.15') { // Key Usage
                    const keyUsage = ext.parsedValue as KeyUsage;
                    const usages = [];
                    if (keyUsage.digitalSignature) usages.push("Digital Signature");
                    if (keyUsage.contentCommitment) usages.push("Content Commitment");
                    if (keyUsage.keyEncipherment) usages.push("Key Encipherment");
                    if (keyUsage.dataEncipherment) usages.push("Data Encipherment");
                    if (keyUsage.keyAgreement) usages.push("Key Agreement");
                    if (keyUsage.keyCertSign) usages.push("Key Cert Sign");
                    if (keyUsage.cRLSign) usages.push("CRL Sign");
                    if (keyUsage.encipherOnly) usages.push("Encipher Only");
                    if (keyUsage.decipherOnly) usages.push("Decipher Only");
                    extEntry.value = usages.join(', ');
                } else if (ext.extnID === '2.5.29.37') { // Extended Key Usage
                    const extKeyUsage = ext.parsedValue as ExtKeyUsage;
                    extEntry.value = extKeyUsage.keyPurposes.map(kp => getOidName(kp)).join(', ');
                } else if (ext.parsedValue.toJSON) {
                   extEntry.value = ext.parsedValue.toJSON(); // Generic fallback
                } else {
                   // If no specific parser and no toJSON, try to get raw hex
                   extEntry.value = `Raw Value (Hex): ${bufferToHex(ext.extnValue.valueBlock.valueHexView)}`;
                }
            } else {
              // Fallback for extensions where PKIjs doesn't provide a direct parsedValue
              // or if you need to handle specific OIDs manually without relying on parsedValue
              extEntry.value = `Raw Value (Hex): ${bufferToHex(ext.extnValue.valueBlock.valueHexView)}`;
            }
          } catch (parseError: any) {
            console.warn(`Could not parse extension ${ext.extnID}:`, parseError);
            extEntry.value = `Error parsing extension value: ${parseError.message || 'Unknown error'}. Raw (Hex): ${bufferToHex(ext.extnValue.valueBlock.valueHexView)}`;
          }
          data.extensions.push(extEntry);
        }
      }
      setParsedCertData(data);

    } catch (e: any) {
      console.error("Error parsing X.509 certificate:", e);
      setError(`Error: Could not parse DER content. ${e.message || 'Is this a valid X.509 certificate in DER format?'}`);
    }
  }, [fileContent]);

  if (error) {
    return <div style={{ color: 'red', padding: '10px' }}>{error}</div>;
  }

  if (!parsedCertData) {
    return <div style={{ padding: '10px' }}>Loading certificate data or no file selected...</div>;
  }

  // --- Rendering Logic Here ---
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '15px' }}>
      <h1>X.509 Certificate Details</h1>
      
      <Section title="General">
        <Detail label="Version" value={parsedCertData.version} />
        <Detail label="Serial Number" value={parsedCertData.serialNumber} pre />
      </Section>

      <Section title="Subject">
        <Detail label="Subject" value={parsedCertData.subject} />
      </Section>

      <Section title="Issuer">
        <Detail label="Issuer" value={parsedCertData.issuer} />
      </Section>

      <Section title="Validity Period">
        <Detail label="Not Before" value={parsedCertData.notBefore} />
        <Detail label="Not After" value={parsedCertData.notAfter} />
      </Section>

      <Section title="Public Key Information">
        <Detail label="Algorithm" value={parsedCertData.publicKeyAlgorithm} />
        {typeof parsedCertData.publicKey === 'object' ? (
          <>
            <Detail label="Modulus (Hex)" value={parsedCertData.publicKey.modulus} pre />
            <Detail label="Public Exponent (Hex)" value={parsedCertData.publicKey.publicExponent} pre />
          </>
        ) : (
          <Detail label="Key (Hex)" value={parsedCertData.publicKey} pre />
        )}
      </Section>

      <Section title="Signature">
        <Detail label="Signature Algorithm" value={parsedCertData.signatureAlgorithm} />
        <Detail label="Signature Value (Hex)" value={parsedCertData.signatureValue} pre />
      </Section>

      {parsedCertData.extensions && parsedCertData.extensions.length > 0 && (
        <Section title="Extensions">
          {parsedCertData.extensions.map((ext: any, index: number) => (
            <div key={index} style={{ marginBottom: '15px', paddingLeft: '10px', borderLeft: '2px solid #eee' }}>
              <h3>{ext.name} ({ext.oid}) {ext.critical ? <strong style={{color: 'red'}}>(Critical)</strong> : ''}</h3>
              {typeof ext.value === 'string' ? (
                <p>{ext.value}</p>
              ) : ext.value && typeof ext.value === 'object' ? (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                  {JSON.stringify(ext.value, null, 2)}
                </pre>
              ) : (
                 <p>No value or value could not be displayed.</p>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
};

// Helper components for consistent styling
const Section: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
    <h2 style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '10px' }}>{title}</h2>
    {children}
  </div>
);

const Detail: React.FC<{ label: string, value: string | number, pre?: boolean }> = ({ label, value, pre }) => (
  <div style={{ marginBottom: '8px' }}>
    <strong style={{ marginRight: '8px' }}>{label}:</strong>
    {pre ? <pre style={{ display: 'inline', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{value}</pre> : <span>{value}</span>}
  </div>
);

export default DerViewer;
```
