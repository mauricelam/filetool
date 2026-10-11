#!/bin/bash

action="$1"

# Run unit and integration tests.
if [ "$action" = "test" ]; then
  cargo test --verbose

# Check formatting.
elif [ "$action" = "fmt_check" ]; then
  if [[ "$TRAVIS_RUST_VERSION" == "stable" && "$TRAVIS_OS_NAME" == "linux" ]]; then
    rustup component add rustfmt &&
    cargo fmt --verbose -- --check
  fi

# Run Clippy.
elif [ "$action" = "clippy_check" ]; then
  if [[ "$TRAVIS_RUST_VERSION" == "stable" && "$TRAVIS_OS_NAME" == "linux" ]]; then
    rustup component add clippy &&
    cargo clippy --verbose
  fi

# Upload code coverage report for stable builds in Linux.
elif [ "$action" = "upload_code_coverage" ]; then
  echo "Code coverage upload disabled for hermeticity."

# Upload development documentation for the develop branch.
elif [ "$action" = "documentation" ]; then
  cargo doc -v --document-private-items &&
  echo "<meta http-equiv=refresh content=0;url=abxml/index.html>" > target/doc/index.html

fi
exit $?
