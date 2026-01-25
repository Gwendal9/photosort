"""
Similarity calculation and clustering for photo embeddings.

Uses cosine similarity and agglomerative clustering to group similar photos.
"""

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity
from typing import Any


class SimilarityCalculator:
    """Calculate similarity and cluster similar photos."""

    def cosine_similarity(
        self, embedding1: list[float], embedding2: list[float]
    ) -> float:
        """
        Calculate cosine similarity between two embeddings.

        Args:
            embedding1: First embedding vector.
            embedding2: Second embedding vector.

        Returns:
            Similarity score between 0 and 1.
        """
        v1 = np.array(embedding1)
        v2 = np.array(embedding2)

        dot_product = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(dot_product / (norm1 * norm2))

    def find_groups(
        self, photos_with_embeddings: list[dict[str, Any]], threshold: float = 0.85
    ) -> list[dict[str, Any]]:
        """
        Find groups of similar photos based on embeddings.

        Args:
            photos_with_embeddings: List of dicts with 'path' and 'embedding' keys.
            threshold: Minimum similarity to consider photos as similar.

        Returns:
            List of groups, each containing photo paths and average similarity.
        """
        if len(photos_with_embeddings) < 2:
            return []

        # Extract embeddings
        embeddings = np.array([p["embedding"] for p in photos_with_embeddings])
        paths = [p["path"] for p in photos_with_embeddings]

        # Calculate pairwise similarity matrix
        similarity_matrix = cosine_similarity(embeddings)

        # Convert similarity to distance for clustering
        # distance = 1 - similarity
        distance_matrix = 1 - similarity_matrix

        # Perform agglomerative clustering
        # distance_threshold is 1 - similarity_threshold
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=1 - threshold,
            metric="precomputed",
            linkage="average",
        )

        labels = clustering.fit_predict(distance_matrix)

        # Group photos by cluster label
        groups = {}
        for idx, label in enumerate(labels):
            if label not in groups:
                groups[label] = []
            groups[label].append(idx)

        # Build result groups (only include groups with 2+ photos)
        result = []
        group_id = 0

        for label, indices in groups.items():
            if len(indices) < 2:
                continue

            # Calculate average similarity within the group
            group_embeddings = embeddings[indices]
            group_similarity = cosine_similarity(group_embeddings)
            # Get average similarity (excluding diagonal)
            n = len(indices)
            total_sim = (group_similarity.sum() - n) / (n * (n - 1)) if n > 1 else 1.0

            result.append(
                {
                    "id": f"group_{group_id}",
                    "photo_paths": [paths[i] for i in indices],
                    "similarity": float(total_sim),
                }
            )
            group_id += 1

        # Sort by similarity (highest first)
        result.sort(key=lambda g: g["similarity"], reverse=True)

        return result
