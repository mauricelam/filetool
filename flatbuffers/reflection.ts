import * as flatbuffers from 'flatbuffers';
import { Schema } from './reflection/schema';
import { Object_ } from './reflection/object';
import { Enum } from './reflection/enum';
import { EnumVal } from './reflection/enum-val';
import { Field } from './reflection/field';
import { Type } from './reflection/type';
import { KeyValue } from './reflection/key-value';
import { Service } from './reflection/service';
import { RPCCall } from './reflection/rpccall';
import { SchemaFile } from './reflection/schema-file';
import { BaseType } from './reflection/base-type';

export function decodeReflectionSchema(data: Uint8Array): any {
    const bb = new flatbuffers.ByteBuffer(data);
    const schema = Schema.getRootAsSchema(bb);
    return readSchema(schema);
}

function readSchema(schema: Schema): any {
    const objects = [];
    for (let i = 0; i < schema.objectsLength(); i++) {
        objects.push(readObject(schema.objects(i)!));
    }

    const enums = [];
    for (let i = 0; i < schema.enumsLength(); i++) {
        enums.push(readEnum(schema.enums(i)!));
    }

    const services = [];
    for (let i = 0; i < schema.servicesLength(); i++) {
        services.push(readService(schema.services(i)!));
    }

    const fbsFiles = [];
    for (let i = 0; i < schema.fbsFilesLength(); i++) {
        fbsFiles.push(readSchemaFile(schema.fbsFiles(i)!));
    }

    return {
        objects,
        enums,
        file_ident: schema.fileIdent(),
        file_ext: schema.fileExt(),
        root_table: schema.rootTable() ? readObject(schema.rootTable()!) : null,
        services,
        advanced_features: schema.advancedFeatures().toString(),
        fbs_files: fbsFiles
    };
}

function readObject(obj: Object_): any {
    const fields = [];
    for (let i = 0; i < obj.fieldsLength(); i++) {
        fields.push(readField(obj.fields(i)!));
    }

    const attributes = [];
    for (let i = 0; i < obj.attributesLength(); i++) {
        attributes.push(readKeyValue(obj.attributes(i)!));
    }

    const documentation = [];
    for (let i = 0; i < obj.documentationLength(); i++) {
        documentation.push(obj.documentation(i));
    }

    return {
        name: obj.name(),
        fields,
        is_struct: obj.isStruct(),
        minalign: obj.minalign(),
        bytesize: obj.bytesize(),
        attributes,
        documentation,
        declaration_file: obj.declarationFile()
    };
}

function readField(field: Field): any {
    const attributes = [];
    for (let i = 0; i < field.attributesLength(); i++) {
        attributes.push(readKeyValue(field.attributes(i)!));
    }

    const documentation = [];
    for (let i = 0; i < field.documentationLength(); i++) {
        documentation.push(field.documentation(i));
    }

    return {
        name: field.name(),
        type: readType(field.type()!),
        id: field.id(),
        offset: field.offset(),
        default_integer: field.defaultInteger().toString(),
        default_real: field.defaultReal(),
        deprecated: field.deprecated(),
        required: field.required(),
        key: field.key(),
        attributes,
        documentation,
        optional: field.optional(),
        padding: field.padding(),
        offset64: field.offset64()
    };
}

function readType(type: Type): any {
    return {
        base_type: BaseType[type.baseType()],
        element: BaseType[type.element()],
        index: type.index(),
        fixed_length: type.fixedLength(),
        base_size: type.baseSize(),
        element_size: type.elementSize()
    };
}

function readEnum(en: Enum): any {
    const values = [];
    for (let i = 0; i < en.valuesLength(); i++) {
        values.push(readEnumVal(en.values(i)!));
    }

    const attributes = [];
    for (let i = 0; i < en.attributesLength(); i++) {
        attributes.push(readKeyValue(en.attributes(i)!));
    }

    const documentation = [];
    for (let i = 0; i < en.documentationLength(); i++) {
        documentation.push(en.documentation(i));
    }

    return {
        name: en.name(),
        values,
        is_union: en.isUnion(),
        underlying_type: readType(en.underlyingType()!),
        attributes,
        documentation,
        declaration_file: en.declarationFile()
    };
}

function readEnumVal(ev: EnumVal): any {
    const documentation = [];
    for (let i = 0; i < ev.documentationLength(); i++) {
        documentation.push(ev.documentation(i));
    }

    const attributes = [];
    for (let i = 0; i < ev.attributesLength(); i++) {
        attributes.push(readKeyValue(ev.attributes(i)!));
    }

    return {
        name: ev.name(),
        value: ev.value().toString(),
        union_type: ev.unionType() ? readType(ev.unionType()!) : null,
        documentation,
        attributes
    };
}

function readKeyValue(kv: KeyValue): any {
    return {
        key: kv.key(),
        value: kv.value()
    };
}

function readService(svc: Service): any {
    const calls = [];
    for (let i = 0; i < svc.callsLength(); i++) {
        calls.push(readRPCCall(svc.calls(i)!));
    }

    const attributes = [];
    for (let i = 0; i < svc.attributesLength(); i++) {
        attributes.push(readKeyValue(svc.attributes(i)!));
    }

    const documentation = [];
    for (let i = 0; i < svc.documentationLength(); i++) {
        documentation.push(svc.documentation(i));
    }

    return {
        name: svc.name(),
        calls,
        attributes,
        documentation,
        declaration_file: svc.declarationFile()
    };
}

function readRPCCall(call: RPCCall): any {
    const attributes = [];
    for (let i = 0; i < call.attributesLength(); i++) {
        attributes.push(readKeyValue(call.attributes(i)!));
    }

    const documentation = [];
    for (let i = 0; i < call.documentationLength(); i++) {
        documentation.push(call.documentation(i));
    }

    return {
        name: call.name(),
        request: readObject(call.request()!),
        response: readObject(call.response()!),
        attributes,
        documentation
    };
}

function readSchemaFile(sf: SchemaFile): any {
    const includedFilenames = [];
    for (let i = 0; i < sf.includedFilenamesLength(); i++) {
        includedFilenames.push(sf.includedFilenames(i));
    }

    return {
        filename: sf.filename(),
        included_filenames: includedFilenames
    };
}
