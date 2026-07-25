# Upload this build to GitHub

## Method A — GitHub website (easiest)

1. Open the `CADenceNS/cadence-northstar-build` repository.
2. Choose **Add file → Upload files**.
3. Extract this ZIP on your computer.
4. Drag all extracted files and folders into the GitHub upload area.
5. Enter commit message: `feat: initialize CADence NorthStar v0.1.0 foundation`
6. Select **Commit directly to the main branch**.
7. Click **Commit changes**.

## Method B — Command line

```bash
git clone https://github.com/CADenceNS/cadence-northstar-build.git
cd cadence-northstar-build
# Copy the extracted files into this folder
git add .
git commit -m "feat: initialize CADence NorthStar v0.1.0 foundation"
git push origin main
```
