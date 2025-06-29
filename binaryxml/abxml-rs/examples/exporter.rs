extern crate abxml;
extern crate byteorder;
extern crate env_logger;
extern crate log;
extern crate zip;

use std::{env, path::Path};

use anyhow::{Error, Context};

use abxml::apk::Apk;

fn main() {
    env_logger::try_init().unwrap();

    if let Err(ref e) = run() {
        println!("error: {}", e);

        for e in e.iter_causes() {
            println!("caused by: {}", e);
        }

        ::std::process::exit(1);
    }
}

fn run() -> Result<(), Error> {
    let apk_path = match env::args().nth(1) {
        Some(path) => path,
        None => {
            println!("Usage: exporter <apk> <path>");
            return Ok(());
        }
    };

    let output = match env::args().nth(2) {
        Some(path) => path,
        None => {
            println!("Usage: exporter <apk> <path>");
            return Ok(());
        }
    };

    let mut apk = Apk::from_path(&apk_path).context("error loading APK")?;
    apk.export(Path::new(&output), true)
        .context("APK could not be exported")?;

    Ok(())
}
