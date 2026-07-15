#!/bin/bash

# Find and rename the .vsix file to remove version number
cd "$(dirname "$0")/.." || exit 1

OLD_FILE=$(find . -maxdepth 1 -name "thymeleaf-basic-preview-*.vsix" -type f)

if [ -n "$OLD_FILE" ]; then
    mv "$OLD_FILE" "./release/thymeleaf-basic-preview.vsix"
    echo "✓ Renamed to thymeleaf-basic-preview.vsix"
else
    echo "✗ No .vsix file found"
    exit 1
fi