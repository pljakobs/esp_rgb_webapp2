import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
EXPRESSION = re.compile(r"\$\{\{\s*(.*?)\s*\}\}", re.DOTALL)
PUBLISH_GATE = "${{ github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_repository.full_name == github.repository) }}"


def workflow(name):
    document = yaml.safe_load((ROOT / ".github/workflows" / name).read_text())
    if True in document and "on" not in document:
        document["on"] = document.pop(True)
    return document


def step(document, job, name):
    return next(value for value in document["jobs"][job]["steps"] if value.get("name") == name)


class WorkflowPolicyTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="workflow-policy-")
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        tools = self.directory / "tools"
        tools.mkdir()
        git = tools / "git"
        git.write_text("""#!/usr/bin/env python3
import os
import sys
if sys.argv[1:] == ['rev-parse', '--abbrev-ref', 'HEAD']:
    print(os.environ['CI_TEST_BRANCH'])
    raise SystemExit(0)
raise SystemExit('Forbidden git operation in policy test')
""")
        git.chmod(0o755)
        for name in ("curl", "wget", "ssh", "scp", "rsync", "docker", "podman", "sudo", "npm", "npx"):
            blocked = tools / name
            blocked.write_text("#!/bin/sh\necho 'Deployment/network command forbidden in policy tests' >&2\nexit 97\n")
            blocked.chmod(0o755)
        self.environment = {
            "PATH": str(tools) + os.pathsep + os.environ.get("PATH", os.defpath),
            "HOME": str(self.directory), "GITHUB_OUTPUT": str(self.directory / "output"),
        }

    def execute(self, selected, values=None, environment=None, success=True):
        values = values or {}

        def render(text):
            return EXPRESSION.sub(lambda match: str(values[match[1].strip()]), str(text))

        source = render(selected["run"])
        configured = {key: render(value) for key, value in selected.get("env", {}).items()}
        output = Path(self.environment["GITHUB_OUTPUT"])
        output.write_text("")
        result = subprocess.run([shutil.which("bash"), "--noprofile", "--norc", "-e"], input=source,
                                cwd=self.directory, env={**self.environment, **configured, **(environment or {})},
                                capture_output=True, text=True, timeout=10)
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return dict(line.split("=", 1) for line in output.read_text().splitlines() if "=" in line)

    def test_every_workflow_and_inline_shell_parses(self):
        for path in sorted((ROOT / ".github/workflows").iterdir()):
            if path.suffix not in {".yml", ".yaml"}:
                continue
            document = yaml.safe_load(path.read_text())
            self.assertIn("jobs", document, str(path))
            for job in document["jobs"].values():
                for selected in job.get("steps", []):
                    if "run" not in selected:
                        continue
                    with self.subTest(workflow=path.name, step=selected.get("name")):
                        source = EXPRESSION.sub("CI_EXPRESSION", selected["run"])
                        result = subprocess.run(["bash", "-n"], input=source, capture_output=True, text=True)
                        self.assertEqual(result.returncode, 0, result.stderr)

    def test_validation_is_unprivileged_and_runs_for_every_pr(self):
        document = workflow("validate-workflows.yml")
        events = document.get("on", document.get(True))
        self.assertIn("pull_request", events)
        self.assertFalse(events["pull_request"])
        self.assertEqual(document["permissions"], {"contents": "read"})
        self.assertNotIn("secrets.", json.dumps(document))
        self.assertEqual(document["jobs"]["validate"]["runs-on"], "ubuntu-latest")
        self.assertFalse(step(document, "validate", "Checkout")["with"]["persist-credentials"])

    def test_actual_branch_step(self):
        document = workflow("deploy.yml")
        for branch in ("develop", "testing", "stable", "experimental", "5.0/develop", "5.1/develop"):
            for event_name in ("workflow_dispatch", "workflow_run"):
                with self.subTest(branch=branch, event=event_name):
                    result = self.execute(step(document, "build", "Get branch name"), {
                        "github.event_name": event_name,
                        "github.event.inputs.branch": branch if event_name == "workflow_dispatch" else "",
                        "github.event.workflow_run.head_branch": branch if event_name == "workflow_run" else "",
                    })
                self.assertEqual(result["branch"], branch)

    def test_actual_webapp_version_step(self):
        source = self.directory / "src"
        source.mkdir()
        document = workflow("deploy.yml")
        mappings = [
            ("develop", "5.0", "develop", "5.0/develop"),
            ("testing", "5.0", "testing", "5.0/testing"),
            ("stable", "5.0", "prod", "5.0/prod"),
            ("experimental", "5.1", "develop", "5.1/develop"),
            ("5.0/prod", "5.0", "prod", "5.0/prod"),
            ("5.1/testing", "5.1", "testing", "5.1/testing"),
        ]
        for source_branch, release_line, stage, release_ref in mappings:
            with self.subTest(branch=source_branch):
                target = source / "version.js"
                target.write_text("__APP_VERSION__ __APP_BRANCH__ __BUILD_NUMBER__ __BUILD_DATE__")
                resolved = self.execute(step(document, "build", "Resolve release line and stage"), {
                    "steps.get_branch.outputs.branch": source_branch,
                })
                self.assertEqual((resolved["release_line"], resolved["stage"], resolved["release_ref"]),
                                 (release_line, stage, release_ref))
                self.assertEqual(resolved["min_firmware"], f"V{release_line}")
                self.assertEqual(resolved["max_firmware"], "")
                result = self.execute(step(document, "build", "Create version file"), {
                    "github.run_number": "42",
                    "steps.resolve_release.outputs.release_line": release_line,
                    "steps.resolve_release.outputs.stage": stage,
                    "steps.resolve_release.outputs.release_ref": release_ref,
                })
                expected_version = f"V{release_line}-42-{stage}"
                self.assertEqual(result["version"], expected_version)
                self.assertIn(f"{expected_version} {release_ref} 42 ", target.read_text())
                self.assertNotIn("__APP_", target.read_text())

    def test_webapp_publication_uses_its_own_firmware_line(self):
        document = workflow("deploy.yml")
        resolved = self.execute(step(document, "build", "Resolve release line and stage"), {
            "steps.get_branch.outputs.branch": "experimental",
        })
        self.assertEqual(resolved["release_ref"], "5.1/develop")
        self.assertEqual(resolved["min_firmware"], "V5.1")
        self.assertEqual(resolved["max_firmware"], "")
        outputs = document["jobs"]["build"]["outputs"]
        self.assertIn("steps.resolve_release.outputs.max_firmware", outputs["max_firmware"])
        remote_script = step(document, "publish", "Deploy webapp to lightinator.de")["run"]
        self.assertIn('MAX_FIRMWARE="${{ needs.build.outputs.max_firmware }}"', remote_script)
        self.assertIn('PUBLISH_ARGS+=(--max-firmware "$MAX_FIRMWARE")', remote_script)

    def test_external_spa_publish_does_not_require_firmware_bootstrap_pages(self):
        document = workflow("deploy.yml")
        names = {selected.get("name") for selected in document["jobs"]["build"]["steps"]}
        self.assertNotIn("Copy bootstrap HTML files into dist/spa", names)

    def test_publisher_requires_immutable_pin(self):
        document = workflow("deploy.yml")
        selected = step(document, "publish", "Validate publisher pin")
        for invalid in ("", "main", "f" * 39, "F" * 40, "f" * 41):
            with self.subTest(pin=invalid):
                self.execute(selected, environment={"DISTRIBUTION_PUBLISHER_SHA": invalid}, success=False)
        self.execute(selected, environment={"DISTRIBUTION_PUBLISHER_SHA": "f" * 40})
        checkout = step(document, "publish", "Checkout pinned distribution publisher")["with"]
        self.assertEqual(checkout["ref"], "${{ env.DISTRIBUTION_PUBLISHER_SHA }}")
        self.assertFalse(checkout["persist-credentials"])

    def test_publisher_bundle_is_checked_and_staged_per_run(self):
        document = workflow("deploy.yml")
        publish = document["jobs"]["publish"]
        names = {selected.get("name") for selected in publish["steps"]}
        self.assertIn("Validate publisher pin", names)
        self.assertIn("Checkout pinned distribution publisher", names)
        self.assertIn("Test pinned distribution publisher", names)
        text = json.dumps(publish)
        self.assertIn("publisher-webapp-${{ github.run_id }}-${{ github.run_attempt }}", text)
        self.assertIn("SOURCE_REVISION", text)
        self.assertIn("--publisher-contract", text)
        checkout = step(document, "publish", "Checkout pinned distribution publisher")["with"]
        self.assertEqual(checkout["repository"], "pljakobs/lightinator_server")
        self.assertFalse(checkout["persist-credentials"])

    def test_workflow_triggers_follow_current_supported_branches(self):
        tests = workflow("test.yml")
        deploy = workflow("deploy.yml")
        expected = ["experimental", "develop", "testing", "stable"]
        canonical = ["5.0/**", "5.1/**"]
        self.assertEqual(tests["on"]["push"]["branches"], expected + canonical)
        self.assertEqual(tests["on"]["pull_request"]["branches"], ["master"] + expected + canonical)
        self.assertEqual(deploy["on"]["workflow_run"]["branches"], expected + canonical)
        options = deploy["on"]["workflow_dispatch"]["inputs"]["branch"]["options"]
        self.assertEqual(options[:6], ["5.0/develop", "5.0/testing", "5.0/prod", "5.1/develop", "5.1/testing", "5.1/prod"])
        self.assertEqual(options[6:], ["stable", "testing", "develop", "experimental"])

    def test_deploy_outputs_require_a_successful_same_repository_push(self):
        document = workflow("deploy.yml")
        self.assertEqual(document["jobs"]["publish"]["needs"], "build")
        for name in ("build", "publish"):
            guard = " ".join(document["jobs"][name]["if"].split())
            self.assertEqual(guard, PUBLISH_GATE)
        publish = json.dumps(document["jobs"]["publish"])
        self.assertIn("${{ needs.build.outputs.branch }}", publish)
        self.assertIn("${{ needs.build.outputs.version }}", publish)

    def test_workflow_run_build_checks_out_the_tested_commit_sha(self):
        checkout = step(workflow("deploy.yml"), "build", "Checkout repository")["with"]
        self.assertEqual(
            checkout["ref"],
            "${{ github.event_name == 'workflow_dispatch' && github.event.inputs.branch || github.event.workflow_run.head_sha }}",
        )

    def test_pr_or_foreign_workflow_cannot_reach_privileged_publish_jobs(self):
        document = workflow("deploy.yml")
        for name in ("build", "publish"):
            self.assertEqual(" ".join(document["jobs"][name]["if"].split()), PUBLISH_GATE)


if __name__ == "__main__":
    unittest.main()