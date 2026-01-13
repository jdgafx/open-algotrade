#!/bin/bash

echo "🚀 Applying Open AlgoTrade branding..."

CANDIDATES="scripts/rename/dry_run_locations.txt"
EXCLUDES=(
    "node_modules"
    ".git"
    "vendor"
    "atc_bootcamp"
    "scripts/rename"
    "scripts/security"
    ".gitignore"
    "mapping.json"
)

should_exclude() {
    local target_path=$1
    for exclude_pattern in "${EXCLUDES[@]}"; do
        if [[ $target_path == *"$exclude_pattern"* ]]; then
            return 0
        fi
    done
    return 1
}

unique_files=$(cut -d: -f1 "$CANDIDATES" | sort -u)

for target_file in $unique_files; do
    if [ -f "$target_file" ]; then
        if should_exclude "$target_file"; then
            echo "⏭️ Skipping excluded file: $target_file"
            continue
        fi

        echo "✏️ Branding $target_file..."
        
        sed -i 's/moondev/open-algotrade/g' "$target_file"
        sed -i 's/MoonDev/Open AlgoTrade/g' "$target_file"
        sed -i 's/moonDev/openAlgoTrade/g' "$target_file"
        sed -i 's/moondev-algotrade/open-algotrade/g' "$target_file"
    fi
done

echo "📦 Updating package metadata..."
sed -i 's/"name": "moondev-command-center"/"name": "open-algotrade-web"/g' src/ui/package.json

echo "✅ Branding applied successfully."
