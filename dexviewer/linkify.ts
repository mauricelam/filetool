/**
 * Linkify functionality for smali assembly output
 * Parses method references and creates internal links to corresponding sections
 */

export interface MethodReference {
    className: string;
    methodName: string;
    parameters: string;
    returnType: string;
    fullSignature: string;
}

export interface FieldReference {
    className: string;
    fieldName: string;
    fieldType: string;
    fullSignature: string;
}

/**
 * Regular expression to match method references in smali output
 * Matches patterns like: processing/core/PShapeSVG:<init>:([Lprocessing/core/PShapeSVG; Lprocessing/data/XML; Z]):V
 */
const METHOD_REFERENCE_REGEX = /([a-zA-Z_$][a-zA-Z0-9_$/]*(?:\/[a-zA-Z_$][a-zA-Z0-9_$]*)*):(<init>|<clinit>|[a-zA-Z_$][a-zA-Z0-9_$]*):(\([^)]*\)):([VZBSCIJFD]|\[+[VZBSCIJFD]|L[^;]+;)/g;

/**
 * Field reference: package/name/ClassName:fieldName:Type
 * Example: processing/core/PShapeSVG:stroke:Z
 */
const FIELD_REFERENCE_REGEX = /([a-zA-Z_$][a-zA-Z0-9_$/]*(?:\/[a-zA-Z_$][a-zA-Z0-9_$]*)*):([a-zA-Z_$][a-zA-Z0-9_$]*):([VZBSCIJFD]|\[+[VZBSCIJFD]|L[^;]+;)/g;

/**
 * Regular expression to match class references in smali output
 * Matches patterns like: Lprocessing/core/PShapeSVG;
 */
const CLASS_REFERENCE_REGEX = /L([a-zA-Z_$][a-zA-Z0-9_$/]*(?:\/[a-zA-Z_$][a-zA-Z0-9_$]*)*);/g;

/**
 * Parses a method reference string and extracts its components
 * Handles formats like:
 * - processing/core/PMatrix2D:apply:([F F F F F F]):V
 * - Lpackage/name/ClassName;->methodName(LparamTypes)ReturnType
 */
export function parseMethodReference(reference: string): MethodReference | null {
    // Try standard format first: processing/core/PMatrix2D:apply:([F F F F F F]):V
    let match = reference.match(/^([^:]+):([^:]+):(\([^)]*\)):(.+)$/);
    
    // If that fails, try JVM format: Lpackage/name/ClassName;->methodName(LparamTypes)ReturnType
    if (!match) {
        match = reference.match(/^L([^;]+);->([^(]+)\(([^)]*)\)(.+)$/);
    }
    
    if (!match) {
        console.error('[parseMethodReference] Could not parse method reference:', reference);
        return null;
    }
    
    const [, className, methodName, parameters, returnType] = match;
    
    // Clean up class name (remove L and ; if present, convert / to .)
    const cleanClassName = className
        .replace(/^L|;$/g, '')
        .replace(/\//g, '.');
    
    // Clean up method name (remove any -> or : if present)
    const cleanMethodName = methodName.replace(/^->|:/g, '');
    
    return {
        className: cleanClassName,
        methodName: cleanMethodName,
        parameters: parameters || '',
        returnType: returnType || 'V',
        fullSignature: reference
    };
}

/**
 * Parses a class reference string and extracts the class name
 */
export function parseClassReference(reference: string): string | null {
    const match = reference.match(/^L([^;]+);$/);
    if (!match) return null;
    
    return match[1].replace(/\//g, '.');
}

/**
 * Generates a unique ID for a method that can be used as an anchor
 * @param className Fully qualified class name (e.g., 'com.example.ClassName')
 * @param methodName Name of the method
 * @param parameters Method parameters signature
 * @returns A unique ID string for the method
 */
export function generateMethodId(className: string, methodName: string, parameters: string): string {
    // Clean up the class name (remove array markers and replace special chars)
    const cleanClassName = className
        .replace(/^\[+L?|;$/g, '')  // Remove array markers and trailing semicolon
        .replace(/[^a-zA-Z0-9]/g, '_');
        
    const cleanMethodName = methodName.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanParams = parameters
        .replace(/^\[+L?|;$/g, '')  // Clean up parameters similarly
        .replace(/[^a-zA-Z0-9]/g, '_');
        
    return `method_${cleanClassName}_${cleanMethodName}_${cleanParams}`.toLowerCase();
}

/**
 * Generates a unique ID for a class that can be used as an anchor
 */
export function generateClassId(className: string): string {
    return `class_${className.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Generates a unique ID for a field anchor
 */
export function generateFieldId(className: string, fieldName: string): string {
    const cleanClass = className.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanField = fieldName.replace(/[^a-zA-Z0-9]/g, '_');
    return `field_${cleanClass}_${cleanField}`.toLowerCase();
}

// Store click handlers in a WeakMap to avoid memory leaks
const methodClickHandlers = new WeakMap<HTMLElement, (reference: MethodReference) => void>();
const classClickHandlers = new WeakMap<HTMLElement, (className: string) => void>();

/**
 * Creates a clickable link element for a method reference
 */
export function createMethodLink(reference: MethodReference, onClick?: (reference: MethodReference) => void): HTMLElement {
    const link = document.createElement('span');
    link.className = 'method-link';
    link.textContent = reference.fullSignature;
    link.style.color = '#2563eb';
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';
    
    if (onClick) {
        // Store the click handler in our WeakMap
        methodClickHandlers.set(link, onClick);
        
        // Also store the reference as a data attribute for debugging
        link.setAttribute('data-method-ref', reference.fullSignature);
        
        // Add click event listener
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[createMethodLink] Clicked on method:', reference);
            onClick(reference);
        });
    }
    
    return link;
}

/**
 * Creates a clickable link element for a field reference
 * Navigates to the declaring class (field-level anchors not implemented yet)
 */
export function createFieldLink(reference: FieldReference, onClassClick?: (className: string) => void): HTMLElement {
    const link = document.createElement('span');
    link.className = 'field-link';
    link.textContent = reference.fullSignature;
    link.style.color = '#2563eb';
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';

    if (onClassClick) {
        link.setAttribute('data-field-ref', reference.fullSignature);
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[createFieldLink] Clicked on field:', reference);
            onClassClick(reference.className);
        });
    }

    return link;
}

/**
 * Creates a clickable link element for a class reference
 */
export function createClassLink(className: string, originalText: string, onClick?: (className: string) => void): HTMLElement {
    const link = document.createElement('span');
    link.className = 'class-link';
    link.textContent = originalText || className;
    link.style.color = '#2563eb';
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';
    
    if (onClick) {
        // Store the click handler in our WeakMap
        classClickHandlers.set(link, onClick);
        
        // Also store the className as a data attribute for debugging
        link.setAttribute('data-class-ref', className);
        
        // Add click event listener
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[createClassLink] Clicked on class:', className);
            onClick(className);
        });
    }
    
    return link;
}

/**
 * Main linkify function that processes smali instruction text and returns HTML with links
 */
export function linkifySmaliInstruction(
    instruction: string,
    onMethodClick?: (reference: MethodReference) => void,
    onClassClick?: (className: string) => void,
    onFieldClick?: (reference: FieldReference) => void
): DocumentFragment {
    const fragment = document.createDocumentFragment();
    
    if (!instruction) {
        return fragment;
    }
    
    // Track how much of the original instruction we've already emitted
    let lastIndex = 0;
    
    // Try to find method references in the format: package/name/ClassName:methodName(paramTypes)returnType
    const methodPattern = /([a-zA-Z_$][a-zA-Z0-9_$/]*(?:\/[a-zA-Z_$][a-zA-Z0-9_$]*)*):([^:]+):(\([^)]*\))([^\s,;)\}]*)/g;
    let methodMatch;
    
    while ((methodMatch = methodPattern.exec(instruction)) !== null) {
        const [fullMatch, className, methodName, parameters, returnType] = methodMatch;
        // console.log('[linkifySmaliInstruction] Found method reference:', { fullMatch, className, methodName, parameters, returnType });
        
        // Add any text before the match
        if (methodMatch.index > lastIndex) {
            const textBefore = instruction.substring(lastIndex, methodMatch.index);
            if (textBefore) {
                fragment.appendChild(document.createTextNode(textBefore));
            }
        }
        
        // Create method reference and link
        const methodRef: MethodReference = {
            className: className.replace(/\//g, '.'),
            methodName,
            parameters,
            returnType,
            fullSignature: fullMatch
        };
        
        const link = createMethodLink(methodRef, onMethodClick);
        fragment.appendChild(link);
        
        lastIndex = methodPattern.lastIndex;
    }
    
    // Next, try to find field references in the remaining text (avoid re-emitting prefix)
    const fieldPattern = FIELD_REFERENCE_REGEX;
    let fieldMatch;

    const searchTextForFields = instruction.substring(lastIndex);
    let lastIndexField = 0;

    while ((fieldMatch = fieldPattern.exec(searchTextForFields)) !== null) {
        const [fullMatch, className, fieldName, fieldType] = fieldMatch;

        // Add any text before the match
        if (fieldMatch.index > lastIndexField) {
            const textBefore = searchTextForFields.substring(lastIndexField, fieldMatch.index);
            if (textBefore) {
                fragment.appendChild(document.createTextNode(textBefore));
            }
        }

        // Build and append field link
        const fieldRef: FieldReference = {
            className: className.replace(/\//g, '.'),
            fieldName,
            fieldType,
            fullSignature: fullMatch,
        };
        const link = createFieldLink(fieldRef, (refClassName) => {
            // If a specific field handler is provided, prefer it. Otherwise, fall back to class navigation
            if (onFieldClick) {
                onFieldClick(fieldRef);
            } else if (onClassClick) {
                onClassClick(refClassName);
            }
        });
        fragment.appendChild(link);

        lastIndexField = fieldPattern.lastIndex;
    }

    // Move lastIndex forward by the amount consumed in fields phase
    lastIndex += lastIndexField;

    // Try to find class references in the format: Lpackage/name/ClassName;
    const classPattern = /L([a-zA-Z_$][a-zA-Z0-9_$/]*(?:\/[a-zA-Z_$][a-zA-Z0-9_$]*)*);/g;
    let classMatch;
    
    // Only process the remaining tail of the instruction that wasn't already emitted
    const searchText = instruction.substring(lastIndex);
    let lastIndex2 = 0;
    
    while ((classMatch = classPattern.exec(searchText)) !== null) {
        const fullMatch = classMatch[0];
        const className = classMatch[1];
        
        // Add any text before the match
        if (classMatch.index > lastIndex2) {
            const textBefore = searchText.substring(lastIndex2, classMatch.index);
            if (textBefore) {
                fragment.appendChild(document.createTextNode(textBefore));
            }
        }
        
        // Create class link
        const link = createClassLink(className, fullMatch, onClassClick);
        fragment.appendChild(link);
        
        lastIndex2 = classPattern.lastIndex;
    }
    
    // Add any remaining text after the last match
    if (lastIndex2 < searchText.length) {
        const remainingText = searchText.substring(lastIndex2);
        if (remainingText) {
            fragment.appendChild(document.createTextNode(remainingText));
        }
    }
    
    return fragment;
}

/**
 * Utility function to scroll to and highlight a specific element
 */
export function scrollToElement(elementId: string): void {
    console.log(`[scrollToElement] Looking for element with ID: ${elementId}`);
    
    // First try exact match
    let element = document.getElementById(elementId);
    
    // If not found, try case-insensitive search
    if (!element) {
        console.log(`[scrollToElement] Element not found with exact ID, trying case-insensitive search`);
        const elements = document.querySelectorAll(`[id]`);
        for (const el of elements) {
            if (el.id.toLowerCase() === elementId.toLowerCase()) {
                element = el as HTMLElement;
                console.log(`[scrollToElement] Found element with case-insensitive match:`, element);
                break;
            }
        }
    }
    
    if (!element) {
        console.error(`[scrollToElement] Element with ID ${elementId} not found`);
        // Log all elements with IDs for debugging
        console.log('[scrollToElement] All elements with IDs:', 
            Array.from(document.querySelectorAll('[id]')).map(el => ({
                id: el.id,
                tagName: el.tagName,
                className: el.className,
                text: el.textContent?.substring(0, 50) + '...'
            }))
        );
        return;
    }
    
    console.log(`[scrollToElement] Found element:`, element);
    
    // Function to expand the target element's parents without collapsing others
    const expandParents = (el: HTMLElement) => {
        let current: HTMLElement | null = el;
        const parents: HTMLElement[] = [];
        
        // Find all parent elements that might be collapsible
        while (current && current !== document.body) {
            parents.push(current);
            current = current.parentElement;
        }
        
        // Process parents from top to bottom
        for (let i = parents.length - 1; i >= 0; i--) {
            const parent = parents[i];
            
            // Handle package headers
            if (parent.classList.contains('package-header')) {
                console.log('[scrollToElement] Expanding package header:', parent);
                const content = parent.nextElementSibling as HTMLElement;
                if (content && content.classList.contains('package-content')) {
                    content.style.display = 'block';
                    parent.setAttribute('aria-expanded', 'true');
                }
            }
            
            // Handle method elements
            if (parent.classList.contains('method')) {
                console.log('[scrollToElement] Expanding method:', parent);
                parent.classList.add('expanded');
                const content = parent.querySelector('.method-content') as HTMLElement;
                if (content) {
                    content.style.display = 'block';
                }
            }
        }
    };
    
    // Expand the target element's parents
    expandParents(element);
    
    // Wait for any DOM updates
    requestAnimationFrame(() => {
        // Scroll to the element
        console.log('[scrollToElement] Scrolling to element...');
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight
        const originalBackground = element.style.backgroundColor;
        const originalTransition = element.style.transition;
        element.style.transition = 'background-color 1s ease-in-out';
        element.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
        
        // Remove highlight after delay
        setTimeout(() => {
            console.log('[scrollToElement] Removing highlight');
            if (element) {
                element.style.backgroundColor = originalBackground;
                element.style.transition = originalTransition;
            }
        }, 2000);
    });
}

/**
 * Finds all method elements in the DOM and returns a map of method signatures to their IDs
 */
export function buildMethodIndex(): Map<string, string> {
    const methodIndex = new Map<string, string>();
    const methodElements = document.querySelectorAll('.method');
    
    methodElements.forEach((element) => {
        const methodHeader = element.querySelector('.method-header');
        if (methodHeader && element.id) {
            const signature = methodHeader.textContent?.trim();
            if (signature) {
                methodIndex.set(signature, element.id);
            }
        }
    });
    
    return methodIndex;
}

/**
 * Finds all class elements in the DOM and returns a map of class names to their IDs
 */
export function buildClassIndex(): Map<string, string> {
    const classIndex = new Map<string, string>();
    const classElements = document.querySelectorAll('.dexclass');
    
    classElements.forEach((element) => {
        const classHeader = element.querySelector('.class-header .membername');
        if (classHeader && element.id) {
            const className = classHeader.textContent?.trim();
            if (className) {
                classIndex.set(className, element.id);
            }
        }
    });
    
    return classIndex;
}
