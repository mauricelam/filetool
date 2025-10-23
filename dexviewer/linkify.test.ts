/**
 * Unit tests for linkify functionality
 */

import {
    parseMethodReference,
    parseClassReference,
    generateMethodId,
    generateClassId,
    linkifySmaliInstruction,
    MethodReference
} from './linkify';

// Test data
const sampleMethodReference = 'processing/core/PShapeSVG:<init>:([Lprocessing/core/PShapeSVG; Lprocessing/data/XML; Z]):V';
const sampleClassReference = 'Lprocessing/core/PShapeSVG;';
const sampleInstruction = 'invoke-direct {v0, v1, v2, v3}, Lprocessing/core/PShapeSVG;-><init>([Lprocessing/core/PShapeSVG; Lprocessing/data/XML; Z])V';

describe('parseMethodReference', () => {
    test('should parse valid method reference correctly', () => {
        const result = parseMethodReference(sampleMethodReference);
        expect(result).not.toBeNull();
        expect(result!.className).toBe('processing.core.PShapeSVG');
        expect(result!.methodName).toBe('<init>');
        expect(result!.parameters).toBe('([Lprocessing/core/PShapeSVG; Lprocessing/data/XML; Z])');
        expect(result!.returnType).toBe('V');
        expect(result!.fullSignature).toBe(sampleMethodReference);
    });

    test('should handle static method references', () => {
        const staticMethod = 'java/lang/String:valueOf:(I)Ljava/lang/String;';
        const result = parseMethodReference(staticMethod);
        expect(result).not.toBeNull();
        expect(result!.className).toBe('java.lang.String');
        expect(result!.methodName).toBe('valueOf');
        expect(result!.parameters).toBe('(I)');
        expect(result!.returnType).toBe('Ljava/lang/String;');
    });

    test('should handle constructor references', () => {
        const constructor = 'java/util/ArrayList:<init>:()V';
        const result = parseMethodReference(constructor);
        expect(result).not.toBeNull();
        expect(result!.className).toBe('java.util.ArrayList');
        expect(result!.methodName).toBe('<init>');
        expect(result!.parameters).toBe('()');
        expect(result!.returnType).toBe('V');
    });

    test('should return null for invalid method reference', () => {
        const invalid = 'not-a-valid-method-reference';
        const result = parseMethodReference(invalid);
        expect(result).toBeNull();
    });

    test('should handle complex parameter types', () => {
        const complexMethod = 'com/example/Test:process:([Ljava/lang/String; [I Ljava/util/Map;)Ljava/util/List;';
        const result = parseMethodReference(complexMethod);
        expect(result).not.toBeNull();
        expect(result!.parameters).toBe('([Ljava/lang/String; [I Ljava/util/Map;)');
        expect(result!.returnType).toBe('Ljava/util/List;');
    });
});

describe('parseClassReference', () => {
    test('should parse valid class reference correctly', () => {
        const result = parseClassReference(sampleClassReference);
        expect(result).toBe('processing.core.PShapeSVG');
    });

    test('should handle nested class references', () => {
        const nestedClass = 'Lcom/example/OuterClass$InnerClass;';
        const result = parseClassReference(nestedClass);
        expect(result).toBe('com.example.OuterClass$InnerClass');
    });

    test('should return null for invalid class reference', () => {
        const invalid = 'not-a-class-reference';
        const result = parseClassReference(invalid);
        expect(result).toBeNull();
    });

    test('should handle array class references', () => {
        const arrayClass = 'L[Ljava/lang/String;;';
        const result = parseClassReference(arrayClass);
        expect(result).toBe('[Ljava.lang.String;');
    });
});

describe('generateMethodId', () => {
    test('should generate valid HTML ID for method', () => {
        const id = generateMethodId('processing.core.PShapeSVG', '<init>', '([Lprocessing/core/PShapeSVG; Lprocessing/data/XML; Z])');
        expect(id).toBe('method_processing_core_PShapeSVG__init___Lprocessing_core_PShapeSVG__Lprocessing_data_XML__Z__');
        expect(id).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    });

    test('should handle special characters in method names', () => {
        const id = generateMethodId('com.example.Test', 'method$with$special', '()');
        expect(id).toBe('method_com_example_Test_method_with_special___');
    });
});

describe('generateClassId', () => {
    test('should generate valid HTML ID for class', () => {
        const id = generateClassId('processing.core.PShapeSVG');
        expect(id).toBe('class_processing_core_PShapeSVG');
        expect(id).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    });

    test('should handle special characters in class names', () => {
        const id = generateClassId('com.example.OuterClass$InnerClass');
        expect(id).toBe('class_com_example_OuterClass_InnerClass');
    });
});

describe('linkifySmaliInstruction', () => {
    // Mock DOM environment for testing
    beforeEach(() => {
        // Setup basic DOM environment
        document.body.innerHTML = '';
    });

    test('should create links for method references in instruction', () => {
        const instruction = 'invoke-direct {v0, v1, v2, v3}, processing/core/PShapeSVG:<init>:([Lprocessing/core/PShapeSVG; Lprocessing/data/XML; Z]):V';
        let clickedMethod: MethodReference | null = null;
        
        const fragment = linkifySmaliInstruction(instruction, (ref) => {
            clickedMethod = ref;
        });
        
        // Convert fragment to container for easier testing
        const container = document.createElement('div');
        container.appendChild(fragment);
        
        const methodLink = container.querySelector('.method-link');
        expect(methodLink).not.toBeNull();
        expect(methodLink!.textContent).toBe('processing/core/PShapeSVG:<init>:([Lprocessing/core/PShapeSVG; Lprocessing/data/XML; Z]):V');
        
        // Test click functionality
        (methodLink as HTMLElement).click();
        expect(clickedMethod).not.toBeNull();
        expect(clickedMethod!.className).toBe('processing.core.PShapeSVG');
        expect(clickedMethod!.methodName).toBe('<init>');
    });

    test('should create links for class references in instruction', () => {
        const instruction = 'new-instance v0, Ljava/util/ArrayList;';
        let clickedClass: string | null = null;
        
        const fragment = linkifySmaliInstruction(instruction, undefined, (className) => {
            clickedClass = className;
        });
        
        const container = document.createElement('div');
        container.appendChild(fragment);
        
        const classLink = container.querySelector('.class-link');
        expect(classLink).not.toBeNull();
        expect(classLink!.textContent).toBe('Ljava/util/ArrayList;');
        
        // Test click functionality
        (classLink as HTMLElement).click();
        expect(clickedClass).toBe('java.util.ArrayList');
    });

    test('should handle instruction with no references', () => {
        const instruction = 'const/4 v0, 0x0';
        const fragment = linkifySmaliInstruction(instruction);
        
        const container = document.createElement('div');
        container.appendChild(fragment);
        
        expect(container.textContent).toBe(instruction);
        expect(container.querySelector('.method-link')).toBeNull();
        expect(container.querySelector('.class-link')).toBeNull();
    });

    test('should handle instruction with multiple references', () => {
        const instruction = 'invoke-virtual {v0, v1}, Ljava/util/List;->add:(Ljava/lang/Object;)Z';
        const fragment = linkifySmaliInstruction(instruction);
        
        const container = document.createElement('div');
        container.appendChild(fragment);
        
        const links = container.querySelectorAll('.method-link, .class-link');
        expect(links.length).toBeGreaterThan(0);
    });

    test('should preserve original text structure', () => {
        const instruction = 'simple instruction without references';
        const fragment = linkifySmaliInstruction(instruction);
        
        const container = document.createElement('div');
        container.appendChild(fragment);
        
        expect(container.textContent).toBe(instruction);
    });
});

// Integration test helpers
export function createMockMethodElement(className: string, methodName: string, parameters: string): HTMLElement {
    const element = document.createElement('div');
    element.className = 'method';
    element.id = generateMethodId(className, methodName, parameters);
    
    const header = document.createElement('div');
    header.className = 'method-header';
    header.textContent = `${methodName}${parameters}`;
    
    element.appendChild(header);
    return element;
}

export function createMockClassElement(className: string): HTMLElement {
    const element = document.createElement('div');
    element.className = 'dexclass';
    element.id = generateClassId(className);
    
    const header = document.createElement('div');
    header.className = 'class-header';
    
    const memberName = document.createElement('span');
    memberName.className = 'membername';
    memberName.textContent = className;
    
    header.appendChild(memberName);
    element.appendChild(header);
    return element;
}
