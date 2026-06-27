#!/usr/bin/env python3
import argparse
import asyncio
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
VENV_PYTHON = BACKEND_DIR / "venv" / "bin" / "python"
if VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])

sys.path.insert(0, str(BACKEND_DIR))


class FakeSqlService:
    def __init__(self):
        self.calls = []

    def run_tool(self, tool_name, start_date="2026-05-01", end_date="2026-06-01"):
        self.calls.append((tool_name, start_date, end_date))
        rows = {
            "may_task_summary": [
                {"handled_tasks": 161, "existing_tasks": 159, "deleted_tasks": 2}
            ],
            "may_audit_events": [
                {"event_type": "Create", "events": 125, "tasks": 125},
                {"event_type": "Edit", "events": 208, "tasks": 81},
            ],
            "may_status_distribution": [
                {"current_status": "Prelogged", "tasks": 84, "pct": 52.8},
                {"current_status": "Logged", "tasks": 50, "pct": 31.4},
                {"current_status": "Done", "tasks": 14, "pct": 8.8},
            ],
            "may_oos_tasks": [
                {
                    "folder_no": "D00000193",
                    "test_name": "Dissolution",
                    "operator": "SYSADM",
                    "current_status": "OOS",
                }
            ],
            "may_top_tests": [{"test_name": "Appearance", "tasks": 18}],
            "may_data_quality": [
                {
                    "current_tasks": 159,
                    "missing_test_type": 158,
                    "missing_tmname": 159,
                    "missing_analyzeddate": 159,
                    "missing_done_testing_dt": 159,
                }
            ],
        }
        return {"tool": tool_name, "rows": rows[tool_name]}


def assert_contract_checks():
    from services.starlims_agent_service import StarlimsAgentService
    from services.starlims_sql_service import StarlimsSqlService

    async def run_checks():
        sql = FakeSqlService()
        service = StarlimsAgentService(sql_service=sql)

        run = await service.run("May 2026 STARLIMS Prelogged distribution")
        assert run is not None
        assert run.contract.intent == "status_distribution"
        assert sql.calls == [("may_status_distribution", "2026-05-01", "2026-06-01")]
        assert run.evaluation.approved is True
        assert "Prelogged" in run.prompt_context

        run = await service.run("Is STARLIMS TAT analysis possible with current fields?")
        assert run is not None
        assert run.contract.can_answer_directly is False
        assert "may_data_quality" in run.contract.tools
        assert "missing_done_testing_dt" in run.prompt_context

        run = await service.run("What does FDA guidance say about clinical trials?")
        assert run is None

        try:
            StarlimsSqlService().run_tool("drop_everything")
        except ValueError:
            return
        raise AssertionError("Unknown SQL tool was accepted")

    asyncio.run(run_checks())
    print("ok contract/evaluator checks")


def wait_for_backend_json(process, url: str, timeout_seconds: int):
    deadline = time.time() + timeout_seconds
    last_error = None
    while time.time() < deadline:
        if process.poll() is not None:
            output = read_process_output(process)
            raise RuntimeError(
                f"Backend exited before {url} was reachable.\n{output[-4000:]}"
            )
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            time.sleep(0.5)
    raise RuntimeError(f"Timed out waiting for {url}: {last_error}")


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) != 0


def start_backend(port: int):
    if not port_is_free(port):
        raise RuntimeError(f"Port {port} is already in use")

    env = os.environ.copy()
    env["PORT"] = str(port)
    env["PYTHONPATH"] = str(BACKEND_DIR)
    return subprocess.Popen(
        [sys.executable, "main.py"],
        cwd=BACKEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def stop_backend(process):
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


def read_process_output(process) -> str:
    if not process.stdout:
        return ""
    try:
        return process.stdout.read() or ""
    except Exception:
        return ""


def assert_backend_checks(port: int, timeout_seconds: int, allow_missing_sql: bool):
    process = start_backend(port)
    try:
        root = wait_for_backend_json(process, f"http://127.0.0.1:{port}/", timeout_seconds)
        assert root.get("message") == "FDA RAG API is running", root
        print("ok backend root")

        health = wait_for_backend_json(
            process, f"http://127.0.0.1:{port}/health/starlims", timeout_seconds
        )
        if health.get("status") != "connected":
            if allow_missing_sql and "not configured" in health.get("message", "").lower():
                print("warn STARLIMS SQL not configured; skipped DB health assertion")
                return
            raise AssertionError(f"STARLIMS health failed: {health}")

        rows = health["result"]["rows"]
        summary = rows[0]
        assert summary["handled_tasks"] == 161, summary
        assert summary["existing_tasks"] == 159, summary
        assert summary["deleted_tasks"] == 2, summary
        print("ok STARLIMS SQL health")

        agent_health = wait_for_backend_json(
            process,
            f"http://127.0.0.1:{port}/health/starlims-agent",
            timeout_seconds,
        )
        assert agent_health.get("status") == "approved", agent_health
        assert agent_health["contract"]["intent"] == "status_distribution", agent_health
        assert "may_status_distribution" in agent_health["contract"]["tools"], agent_health
        assert agent_health["evaluation"]["approved"] is True, agent_health
        print("ok STARLIMS agent app health")
    finally:
        stop_backend(process)
        if process.returncode not in (None, 0, -15):
            output = read_process_output(process)
            if output:
                print(output[-4000:], file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(
        description="Run the local evaluator checks for the STARLIMS agent feature."
    )
    parser.add_argument("--port", type=int, default=int(os.getenv("EVAL_BACKEND_PORT", "8011")))
    parser.add_argument("--timeout", type=int, default=45)
    parser.add_argument(
        "--allow-missing-sql",
        action="store_true",
        help="Allow /health/starlims to report missing SQL env vars.",
    )
    args = parser.parse_args()

    os.chdir(REPO_ROOT)
    assert_contract_checks()
    assert_backend_checks(args.port, args.timeout, args.allow_missing_sql)


if __name__ == "__main__":
    main()
