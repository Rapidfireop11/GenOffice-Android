# Preserved upstream CI workflow

The upstream CI workflow is preserved in this directory as `ci.yml`.

It is intentionally not active at `.github/workflows/ci.yml` in this repository because the authenticated repository integration used for the initial import does not have GitHub’s `workflows` permission. GitHub rejects pushes that create or modify active workflow files without that permission.

To activate the preserved workflow, a repository administrator can move `ci.yml` to `.github/workflows/ci.yml` in a GitHub session or through an access token that includes workflow permissions. Review the workflow before enabling it, because it comes from the upstream project.
