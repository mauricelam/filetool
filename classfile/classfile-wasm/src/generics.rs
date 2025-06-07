#![allow(unused)]

use nom::{
    branch::alt,
    bytes::complete::tag,
    character::complete::{char, one_of},
    combinator::{eof, map, opt},
    multi::many0,
    sequence::{delimited, preceded, terminated, tuple},
    Finish,
};

pub struct ClassSignature<'a> {
    type_params: Vec<TypeParameter<'a>>,
    super_class: ClassTypeSignature<'a>,
    interfaces: Vec<ClassTypeSignature<'a>>,
}

pub fn parse_class_signature(input: &str) -> Result<ClassSignature, nom::error::Error<&str>> {
    map(
        tuple((
            parse_type_params,
            parse_class_type_signature,
            many0(parse_class_type_signature),
            eof,
        )),
        |(type_params, super_class, interfaces, _)| ClassSignature {
            type_params,
            super_class,
            interfaces,
        },
    )(input)
    .finish()
    .map(|(_, sig)| sig)
}

#[derive(Debug, PartialEq, Eq)]
pub struct MethodSignature<'a> {
    type_params: Vec<TypeParameter<'a>>,
    params: Vec<JavaTypeSignature<'a>>,
    return_type: MethodReturnType<'a>,
    throws: Vec<ThrowsSignature<'a>>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ThrowsSignature<'a> {
    ClassType(ClassTypeSignature<'a>),
    TypeVariable(TypeVariableSignature<'a>),
}

pub fn parse_method_signature(input: &str) -> Result<MethodSignature, nom::error::Error<&str>> {
    map(
        tuple((
            parse_type_params,
            delimited(char('('), many0(parse_java_type_signature), char(')')),
            parse_method_return_type,
            many0(preceded(char('^'), parse_throws_signature)),
            eof,
        )),
        |(type_params, params, return_type, throws, _)| MethodSignature {
            type_params,
            params,
            return_type,
            throws,
        },
    )(input)
    .finish()
    .map(|(_, sig)| sig)
}

pub fn parse_throws_signature(input: &str) -> nom::IResult<&str, ThrowsSignature> {
    alt((
        map(parse_class_type_signature, ThrowsSignature::ClassType),
        map(parse_type_variable_signature, ThrowsSignature::TypeVariable),
    ))(input)
}

#[derive(Debug, PartialEq, Eq)]
pub enum MethodReturnType<'a> {
    Void,
    Type(JavaTypeSignature<'a>),
}

pub fn parse_method_return_type(input: &str) -> nom::IResult<&str, MethodReturnType> {
    alt((
        map(char('V'), |_| MethodReturnType::Void),
        map(parse_java_type_signature, MethodReturnType::Type),
    ))(input)
}

#[test]
fn test_parse_type_params() {
    let (rem, v) = parse_type_params("<T:Ljava/lang/Object;>").unwrap();
    assert_eq!(
        v,
        vec![TypeParameter {
            ident: "T",
            class_bound: Some(ReferenceTypeSignature::Class(ClassTypeSignature {
                class: "java/lang/Object",
                type_arguments: vec![]
            })),
            interface_bounds: vec![]
        }]
    );
    assert_eq!(rem, "");
}

#[allow(clippy::unwrap_used)]
#[test]
fn test_method() {
    let method_sig_str = "<T:Ljava/lang/Object;>(Landroidx/room/RoomDatabase;Z[Ljava/lang/String;Lkotlin/jvm/functions/Function1<-Landroidx/sqlite/SQLiteConnection;+TT;>;)Lio/reactivex/Observable<TT;>;";
    let method_sig = parse_method_signature(method_sig_str).unwrap();
    assert_eq!(
        method_sig,
        MethodSignature {
            type_params: vec![TypeParameter {
                ident: "T",
                class_bound: Some(ReferenceTypeSignature::Class(ClassTypeSignature {
                    class: "java/lang/Object",
                    type_arguments: vec![]
                })),
                interface_bounds: vec![]
            }],
            params: vec![
                JavaTypeSignature::Reference(Box::new(ReferenceTypeSignature::Class(
                    ClassTypeSignature {
                        class: "androidx/room/RoomDatabase",
                        type_arguments: vec![],
                    }
                ))),
                JavaTypeSignature::Primitive('Z'),
                JavaTypeSignature::Reference(Box::new(ReferenceTypeSignature::Class(
                    ClassTypeSignature {
                        class: "kotlin/jvm/functions/Function1",
                        type_arguments: vec![
                            TypeArgument::Super(ReferenceTypeSignature::Class(
                                ClassTypeSignature {
                                    class: "androidx/sqlite/SQLiteConnection",
                                    type_arguments: vec![],
                                }
                            )),
                            TypeArgument::Extend(ReferenceTypeSignature::TypeVariable(
                                TypeVariableSignature { ident: "T" }
                            ))
                        ],
                    }
                )))
            ],
            return_type: MethodReturnType::Type(JavaTypeSignature::Reference(Box::new(
                ReferenceTypeSignature::Class(ClassTypeSignature {
                    class: "io/reactivex/Observable",
                    type_arguments: vec![TypeArgument::Reference(
                        ReferenceTypeSignature::TypeVariable(TypeVariableSignature { ident: "T" })
                    )]
                })
            ))),
            throws: vec![]
        }
    )
}

pub fn parse_field_signature(
    input: &str,
) -> Result<ReferenceTypeSignature, nom::error::Error<&str>> {
    terminated(parse_reference_type_signature, eof)(input)
        .finish()
        .map(|(_, sig)| sig)
}

/// TypeParameters:
///   < TypeParameter {TypeParameter} >
fn parse_type_params(input: &str) -> nom::IResult<&str, Vec<TypeParameter>> {
    delimited(
        char('<'),
        nom::multi::many1(parse_type_parameter),
        char('>'),
    )(input)
}

#[derive(Debug, PartialEq, Eq)]
struct TypeParameter<'a> {
    ident: &'a str,
    class_bound: Option<ReferenceTypeSignature<'a>>,
    interface_bounds: Vec<ReferenceTypeSignature<'a>>,
}

/// TypeParameter:
///   Identifier ClassBound {InterfaceBound}
fn parse_type_parameter(input: &str) -> nom::IResult<&str, TypeParameter> {
    map(
        nom::sequence::tuple((parse_identifier, parse_class_bound, parse_interface_bounds)),
        |(ident, class_bound, interface_bounds)| TypeParameter {
            ident,
            class_bound,
            interface_bounds,
        },
    )(input)
}

fn parse_interface_bounds(input: &str) -> nom::IResult<&str, Vec<ReferenceTypeSignature>> {
    many0(nom::sequence::preceded(
        char(':'),
        parse_reference_type_signature,
    ))(input)
}

fn parse_class_bound(input: &str) -> nom::IResult<&str, Option<ReferenceTypeSignature>> {
    nom::sequence::preceded(char(':'), opt(parse_reference_type_signature))(input)
}

#[derive(Debug, PartialEq, Eq)]
pub enum ReferenceTypeSignature<'a> {
    Class(ClassTypeSignature<'a>),
    TypeVariable(TypeVariableSignature<'a>),
    Array(ArrayTypeSignature<'a>),
}

/// ReferenceTypeSignature:
///   ClassTypeSignature
///   TypeVariableSignature
///   ArrayTypeSignature
fn parse_reference_type_signature(input: &str) -> nom::IResult<&str, ReferenceTypeSignature> {
    nom::branch::alt((
        map(parse_class_type_signature, ReferenceTypeSignature::Class),
        map(
            parse_type_variable_signature,
            ReferenceTypeSignature::TypeVariable,
        ),
        map(parse_array_type_signature, ReferenceTypeSignature::Array),
    ))(input)
}

#[derive(Debug, PartialEq, Eq)]
pub struct ClassTypeSignature<'a> {
    class: &'a str,
    type_arguments: Vec<TypeArgument<'a>>,
}

/// ClassTypeSignature:
///   L [PackageSpecifier] SimpleClassTypeSignature {ClassTypeSignatureSuffix} ;
fn parse_class_type_signature(input: &str) -> nom::IResult<&str, ClassTypeSignature> {
    map(
        delimited(
            char('L'),
            tuple((parse_identifier, parse_type_arguments)),
            char(';'),
        ),
        |(class, type_arguments)| ClassTypeSignature {
            class,
            type_arguments,
        },
    )(input)
}

#[derive(Debug, PartialEq, Eq)]
pub struct TypeVariableSignature<'a> {
    ident: &'a str,
}

fn parse_type_variable_signature(input: &str) -> nom::IResult<&str, TypeVariableSignature> {
    map(delimited(char('T'), parse_identifier, char(';')), |ident| {
        TypeVariableSignature { ident }
    })(input)
}

#[derive(Debug, PartialEq, Eq)]
pub struct ArrayTypeSignature<'a> {
    element_type: JavaTypeSignature<'a>,
}

fn parse_array_type_signature(input: &str) -> nom::IResult<&str, ArrayTypeSignature> {
    map(preceded(char('['), parse_java_type_signature), |ty| {
        ArrayTypeSignature { element_type: ty }
    })(input)
}

#[derive(Debug, PartialEq, Eq)]
pub enum JavaTypeSignature<'a> {
    Primitive(char),
    Reference(Box<ReferenceTypeSignature<'a>>),
}

fn parse_java_type_signature(input: &str) -> nom::IResult<&str, JavaTypeSignature> {
    alt((
        map(one_of("ZBCSIJFD"), JavaTypeSignature::Primitive),
        map(parse_reference_type_signature, |r| {
            JavaTypeSignature::Reference(Box::new(r))
        }),
    ))(input)
}

/// TypeArguments:
///   < TypeArgument {TypeArgument} >
fn parse_type_arguments(input: &str) -> nom::IResult<&str, Vec<TypeArgument>> {
    delimited(char('<'), nom::multi::many1(parse_type_argument), char('>'))(input)
}

#[derive(Debug, PartialEq, Eq)]
pub enum TypeArgument<'a> {
    Wildcard,
    Extend(ReferenceTypeSignature<'a>),
    Super(ReferenceTypeSignature<'a>),
    Reference(ReferenceTypeSignature<'a>),
}

/// TypeArgument:
///   [WildcardIndicator] ReferenceTypeSignature
///   *
/// WildcardIndicator:
///   +
///   -
fn parse_type_argument(input: &str) -> nom::IResult<&str, TypeArgument> {
    nom::branch::alt((
        map(tag("*"), |_| TypeArgument::Wildcard),
        map(
            preceded(tag("+"), parse_reference_type_signature),
            TypeArgument::Extend,
        ),
        map(
            preceded(tag("-"), parse_reference_type_signature),
            TypeArgument::Super,
        ),
        map(parse_reference_type_signature, TypeArgument::Reference),
    ))(input)
}

fn parse_identifier(input: &str) -> nom::IResult<&str, &str> {
    nom::bytes::complete::is_not(";[<>:")(input)
}
