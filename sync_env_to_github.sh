#!/bin/bash

# --- CONFIGURATION ---
ENV_FILE=".env"
# Optional: Define a specific repo. Leave empty "" for the current directory.
TARGET_REPO="taslimamindia/kassafamilyproject" 

# --- CHECK GITHUB CLI ---
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI ('gh') is not installed."
    exit 1
fi

# --- FUNCTION TO UPLOAD SECRETS ---
update_github_secret() {
    local name=$1
    local value=$2
    local repo_arg=""

    if [ -n "$TARGET_REPO" ]; then
        repo_arg="--repo $TARGET_REPO"
    fi

    echo -n "   🔒 Securing: $name ... "

    # --- MAJOR FIX ---
    # Pass the value directly into --body "$value"
    # This ensures the exact text is sent, not a dash '-'
    gh secret set "$name" $repo_arg --body "$value"

    if [ $? -eq 0 ]; then
        echo "✅ Updated"
    else
        echo "❌ Failed"
    fi
}

echo ""
echo "🚀 STARTING GITHUB SECRETS SYNCHRONIZATION"
if [ -n "$TARGET_REPO" ]; then
    echo "🎯 Target Repo: $TARGET_REPO"
fi
echo "-------------------------------------"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: File $ENV_FILE not found."
    exit 1
fi

# Ask for confirmation
echo "📂 Reading from: $ENV_FILE"
echo "⚠️  WARNING: You are about to overwrite existing SECRETS."
read -p "   Do you want to continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[oOyY]$ ]]; then
    echo "🚫 Operation cancelled."
    exit 1
fi

# --- PROCESS .ENV FILE (Advanced Parsing) ---
while IFS= read -r line || [[ -n "$line" ]]; do
    # Clean leading spaces
    line="${line#"${line%%[![:space:]]*}"}"

    # Ignore empty lines and comments
    if [[ -z "$line" ]] || [[ "$line" == \#* ]]; then
        continue
    fi

    # Remove 'export '
    if [[ "$line" == export* ]]; then
        line="${line#export }"
        line="${line#"${line%%[![:space:]]*}"}"
    fi

    # Regex Parsing Key=Value
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"

        # Clean Key
        key="${key%"${key##*[![:space:]]}"}"
        
        # Clean Value (leading spaces)
        value="${value#"${value%%[![:space:]]*}"}"

        # Handle quotes and inline comments
        if [[ "$value" == \"* ]]; then
            if [[ "$value" =~ ^\"(.*)\" ]]; then
                value="${BASH_REMATCH[1]}"
            fi
        elif [[ "$value" == \'* ]]; then
            if [[ "$value" =~ ^\'(.*)\' ]]; then
                value="${BASH_REMATCH[1]}"
            fi
        else
            value="${value%% #*}"
            value="${value%"${value##*[![:space:]]}"}"
        fi

        if [[ -n "$key" ]]; then
            update_github_secret "$key" "$value"
        fi
    fi

done < "$ENV_FILE"

echo "-------------------------------------"
echo "🎉 SYNCHRONIZATION COMPLETE!"