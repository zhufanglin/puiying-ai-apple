from pathlib import Path


PROMPT_DIR = Path(__file__).resolve().parents[3] / "apps" / "api" / "app" / "modules" / "apple" / "prompts"


def load_prompt(name: str) -> str:
    path = PROMPT_DIR / f"{Path(name).name}.md"
    if not path.is_file():
        raise FileNotFoundError(f"Prompt 不存在：{name}")
    return path.read_text(encoding="utf-8")

