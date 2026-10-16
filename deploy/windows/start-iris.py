"""Prepare the cloud runtime, then run unmodified Iris on loopback."""
import json
import os
from pathlib import Path
import sys


def prepare_runtime(root: Path, environment) -> None:
    for key in ("OPENAI_API_KEY", "OPENAI_BASE_URL", "LLM_MODEL"):
        if not environment.get(key, "").strip():
            raise ValueError(f"Missing {key}; configure the private Iris environment file.")
    if not (root / "agent.yaml").is_file():
        raise ValueError("Missing cloud agent.yaml; run Prepare-Iris.ps1 first.")
    # Iris defaults to Ollama embeddings even with keyword retrieval configured.
    # Seed its supported runtime settings once; preserve later user changes.
    filename = root / "data" / "knowledge" / "runtime.json"
    filename.parent.mkdir(parents=True, exist_ok=True)
    try:
        with filename.open("x", encoding="utf-8") as handle:
            json.dump({
                "embedding_enabled": False, "semantic_split_enabled": False,
                "graph_enabled": False, "image_enabled": False,
                "reranker_enabled": False, "reranker_provider": "none",
            }, handle, indent=2)
    except FileExistsError:
        pass


if __name__ == "__main__":
    try:
        prepare_runtime(Path.cwd(), os.environ)
    except (ValueError, OSError) as error:
        print(f"[iris-deployment] {error}", file=sys.stderr)
        sys.exit(1)
    import uvicorn
    # This entry point lives in MyBlog; Iris modules live in the runtime cwd.
    sys.path.insert(0, str(Path.cwd()))
    uvicorn.run("server:app", host="127.0.0.1", port=8000)
