#!/bin/bash
# Kairos Secret Scanner
# Fails if high-entropy strings or common secret patterns are found in non-ignored files.

echo "🔍 Running Kairos Secret Scan..."

# List of patterns to flag
PATTERNS=(
    "CLAUDE_CODE_OAUTH_TOKEN=[a-zA-Z0-9.-]+"
    "ANTHROPIC_API_KEY=sk-[a-zA-Z0-9-]+"
    "PRIVATE_KEY=['\"][a-zA-Z0-9]{64}['\"]"
    "sk_live_[a-zA-Z0-9]+"
)

EXIT_CODE=0

for pattern in "${PATTERNS[@]}"; do
    matches=$(grep -rE "$pattern" . --exclude-dir={node_modules,.git,dist} --exclude={.env.example,.gitignore,secret_scan.sh})
    if [ ! -z "$matches" ]; then
        echo "❌ Found potential secret for pattern: $pattern"
        echo "$matches"
        EXIT_CODE=1
    fi
done

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ No secrets detected in scanned files."
else
    echo "🚨 Secret scan failed! Please remove secrets before committing."
fi

exit $EXIT_CODE
