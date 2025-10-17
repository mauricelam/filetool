import React from 'react';

const styles = {
    container: {
        padding: '20px',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.6',
    },
    title: {
        marginTop: 0,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
    },
    section: {
        border: '1px solid #eee',
        padding: '15px',
        borderRadius: '5px',
    },
    sectionTitle: {
        marginTop: 0,
        borderBottom: '1px solid #eee',
        paddingBottom: '10px',
        marginBottom: '10px',
    },
    code: {
        backgroundColor: '#f5f5f5',
        padding: '2px 5px',
        borderRadius: '3px',
    }
};

const JQCheatsheet: React.FC = () => {
    return (
        <div style={styles.container}>
            <h2 style={styles.title}>JQ Cheatsheet</h2>
            <div style={styles.grid}>
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Basic Filters</h3>
                    <p><code style={styles.code}>.</code> - The identity operator.</p>
                    <p><code style={styles.code}>.foo</code>, <code style={styles.code}>.foo.bar</code> - Get nested values.</p>
                    <p><code style={styles.code}>.[0]</code>, <code style={styles.code}>.[-1]</code> - Array indexing.</p>
                    <p><code style={styles.code}>.[2:4]</code>, <code style={styles.code}>.[:3]</code>, <code style={styles.code}>.[-2:]</code> - Array slicing.</p>
                    <p><code style={styles.code}>.[]</code> - Iterate over array elements.</p>
                    <p><code style={styles.code}>.foo[]?</code> - Suppress errors for missing keys.</p>
                </div>
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Operators</h3>
                    <p><code style={styles.code}>+</code> - Addition, concatenation.</p>
                    <p><code style={styles.code}>-</code> - Subtraction.</p>
                    <p><code style={styles.code}>|</code> - Pipe output to another filter.</p>
                    <p><code style={styles.code}>,</code> - Produce multiple outputs.</p>
                </div>
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Functions</h3>
                    <p><code style={styles.code}>keys</code> - Get object keys.</p>
                    <p><code style={styles.code}>length</code> - Get array/string length.</p>
                    <p><code style={styles.code}>has(key)</code> - Check if object has key.</p>
                    <p><code style={styles.code}>to_entries</code>, <code style={styles.code}>from_entries</code> - Object to/from array.</p>
                    <p><code style={styles.code}>add</code> - Sum elements in an array.</p>
                    <p><code style={styles.code}>unique</code>, <code style={styles.code}>sort</code>, <code style={styles.code}>reverse</code> - Array operations.</p>
                </div>
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Selection & Mapping</h3>
                    <p><code style={styles.code}>select(.foo == "bar")</code></p>
                    <p><code style={styles.code}>map(. + 1)</code></p>
                    <p><code style={styles.code}>del(.foo)</code></p>
                    <p><code style={styles.code}>group_by(.foo)</code></p>
                </div>
            </div>
        </div>
    );
};

export default JQCheatsheet;