use noak::AccessFlags;

pub(crate) fn format_class_type(access_flags: &AccessFlags) -> &'static str {
    if access_flags.contains(AccessFlags::ENUM) {
        "enum"
    } else if access_flags.contains(AccessFlags::INTERFACE) {
        "interface"
    } else if access_flags.contains(AccessFlags::ANNOTATION) {
        "@interface"
    } else {
        "class"
    }
}

pub(crate) fn parse_method_descriptor(method_descriptor: &str, package: &str) -> (Vec<String>, String) {
    assert!(method_descriptor.starts_with("("));
    let (args, return_type) = method_descriptor[1..].split_once(")").unwrap();
    let mut formatted_args = Vec::new();
    let mut rem_args = args;
    while !rem_args.is_empty() {
        let (f, rem) = format_type_token(rem_args, package);
        formatted_args.push(f);
        rem_args = rem;
    }
    (formatted_args, format_type(return_type, package))
}

pub(crate) fn format_type_token<'a>(token_str: &'a str, package: &str) -> (String, &'a str) {
    match token_str.chars().next().unwrap() {
        'Z' => ("boolean".into(), &token_str[1..]),
        'B' => ("byte".into(), &token_str[1..]),
        'C' => ("char".into(), &token_str[1..]),
        'S' => ("short".into(), &token_str[1..]),
        'I' => ("int".into(), &token_str[1..]),
        'J' => ("long".into(), &token_str[1..]),
        'F' => ("float".into(), &token_str[1..]),
        'D' => ("double".into(), &token_str[1..]),
        'V' => ("void".into(), &token_str[1..]),
        '[' => {
            let (t, rem) = format_type_token(&token_str[1..], package);
            (format!("{t}[]"), rem)
        }
        'L' => {
            let (classname, rem) = token_str[1..].split_once(';').unwrap();
            (format_classname(classname, package), rem)
        }
        _ => (format!("Error: Cannot parse {token_str:?}"), ""),
    }
}

pub(crate) fn format_type(type_str: &str, package: &str) -> String {
    let (t, rem) = format_type_token(type_str, package);
    assert_eq!(rem, "");
    t
}

pub(crate) fn format_classname(name: &str, package: &str) -> String {
    let (n_package, n_classname) = parse_class_name(name);
    if n_package == package || n_package.is_empty() {
        n_classname.into()
    } else {
        format!("{n_package}.{n_classname}")
    }
}

pub(crate) fn parse_class_name(name: &str) -> (String, &str) {
    if let Some((package, classname)) = name.rsplit_once("/") {
        (package.replace("/", "."), classname)
    } else {
        (String::new(), name)
    }
}
