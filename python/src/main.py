#!/usr/bin/env python3
"""
PhotoSort ML Sidecar

This sidecar process handles ML operations:
- Image embedding generation using CLIP
- Similarity calculation between embeddings
- Clustering of similar images

Communication with the Rust backend is done via JSON lines on stdin/stdout.
"""

import json
import sys
from typing import Any

from embedding.clip_model import CLIPEmbedder
from similarity.clustering import SimilarityCalculator


def send_message(msg_type: str, **kwargs) -> None:
    """Send a JSON message to stdout."""
    message = {"type": msg_type, **kwargs}
    print(json.dumps(message), flush=True)


def send_progress(current: int, total: int) -> None:
    """Send progress update."""
    send_message("progress", current=current, total=total)


def send_result(data: Any) -> None:
    """Send result data."""
    send_message("result", data=data)


def send_error(code: str, message: str) -> None:
    """Send error message."""
    send_message("error", code=code, message=message)


def handle_request(request: dict, embedder: CLIPEmbedder, calculator: SimilarityCalculator) -> None:
    """Handle a single request from the Rust backend."""
    action = request.get("action")
    params = request.get("params", {})

    try:
        if action == "embed_photos":
            # Generate embeddings for a list of photo paths
            paths = params.get("paths", [])
            embeddings = []

            for i, path in enumerate(paths):
                embedding = embedder.embed_image(path)
                embeddings.append({
                    "path": path,
                    "embedding": embedding.tolist()
                })
                send_progress(i + 1, len(paths))

            send_result(embeddings)

        elif action == "find_similar":
            # Find similar groups from embeddings
            embeddings = params.get("embeddings", [])
            threshold = params.get("threshold", 0.85)

            groups = calculator.find_groups(embeddings, threshold)
            send_result(groups)

        elif action == "calculate_similarity":
            # Calculate similarity between two embeddings
            embedding1 = params.get("embedding1")
            embedding2 = params.get("embedding2")

            similarity = calculator.cosine_similarity(embedding1, embedding2)
            send_result({"similarity": similarity})

        elif action == "ping":
            # Health check
            send_result({"status": "ok"})

        else:
            send_error("UNKNOWN_ACTION", f"Unknown action: {action}")

    except Exception as e:
        send_error("PROCESSING_ERROR", str(e))


def main() -> None:
    """Main entry point for the sidecar."""
    # Initialize ML models
    try:
        embedder = CLIPEmbedder()
        calculator = SimilarityCalculator()
    except Exception as e:
        send_error("INIT_ERROR", f"Failed to initialize ML models: {e}")
        sys.exit(1)

    send_result({"status": "ready"})

    # Process requests from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
            handle_request(request, embedder, calculator)
        except json.JSONDecodeError as e:
            send_error("PARSE_ERROR", f"Failed to parse request: {e}")


if __name__ == "__main__":
    main()
