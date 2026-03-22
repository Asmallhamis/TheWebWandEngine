import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "scripts" / ".dev_version_counter.json"
OUTPUT_PATH = ROOT / "frontend" / "src" / "generated" / "version.ts"
APP_NAME = "TheWebWandEngine"


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    generated_at = now.strftime("%Y-%m-%d %H:%M:%S")

    state = load_state()
    if state.get("date") == date_str:
        counter = int(state.get("counter", 0)) + 1
    else:
        counter = 1

    state = {"date": date_str, "counter": counter, "generatedAt": generated_at}
    save_state(state)

    version = f"{date_str}.{counter}"
    label = f"{APP_NAME} • {version}"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        "export interface AppVersionInfo {\n"
        "  name: string;\n"
        "  version: string;\n"
        "  label: string;\n"
        "  generatedAt: string;\n"
        "}\n\n"
        f"export const APP_VERSION_INFO: AppVersionInfo = {{\n"
        f"  name: {APP_NAME!r},\n"
        f"  version: {version!r},\n"
        f"  label: {label!r},\n"
        f"  generatedAt: {generated_at!r},\n"
        "};\n",
        encoding="utf-8",
    )

    print(f"[version] Generated {version}")
    print(f"[version] Wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
