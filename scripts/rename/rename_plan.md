Rename Plan (dry-run)

Goal: Replace 'moondev' with 'kairos' across codebase safely.

Rules:
- Don't touch node_modules, .git, or vendor directories
- Replace case-insensitively but keep original case (MoonDev -> Kairos, moondev -> kairos)
- Stop and review any lines that look like external links or vendor auth tokens

Steps:
1. Run rg -n "moondev" | sort > scripts/rename/dry_run_locations.txt
2. Manually review high-risk files (envs, dist, doc files, .git configs)
3. Prepare a mapping table: moondev -> kairos, MoonDev -> Kairos, moonDev -> kairos
4. Use a script to apply replacements only to files in repo (exclude patterns)
5. Run tests and builds in all packages
6. Commit changes to feature/rename-to-kairos and open PR with checklist

High Risk Files:
- any .env or config files (grep: .env, config.example.json)
- dist bundles (e.g., opencode-antigravity-auth/dist)
- vendor commit logs in .git directories
