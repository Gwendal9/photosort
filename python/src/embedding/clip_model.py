"""
CLIP-based image embedding extraction.

Uses OpenAI's CLIP model to generate semantic embeddings from images.
These embeddings capture the visual content and can be compared for similarity.
"""

import numpy as np
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel
from typing import Union
from pathlib import Path


class CLIPEmbedder:
    """Generates image embeddings using CLIP model."""

    def __init__(self, model_name: str = "openai/clip-vit-base-patch32"):
        """
        Initialize the CLIP embedder.

        Args:
            model_name: HuggingFace model identifier for CLIP.
        """
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = CLIPModel.from_pretrained(model_name).to(self.device)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.model.eval()

    def embed_image(self, image_path: Union[str, Path]) -> np.ndarray:
        """
        Generate embedding for a single image.

        Args:
            image_path: Path to the image file.

        Returns:
            Normalized embedding vector as numpy array.
        """
        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)

        with torch.no_grad():
            features = self.model.get_image_features(**inputs)

        # Normalize the embedding
        embedding = features.cpu().numpy().flatten()
        embedding = embedding / np.linalg.norm(embedding)

        return embedding

    def embed_batch(self, image_paths: list[Union[str, Path]]) -> list[np.ndarray]:
        """
        Generate embeddings for a batch of images.

        Args:
            image_paths: List of paths to image files.

        Returns:
            List of normalized embedding vectors.
        """
        images = [Image.open(p).convert("RGB") for p in image_paths]
        inputs = self.processor(images=images, return_tensors="pt", padding=True).to(
            self.device
        )

        with torch.no_grad():
            features = self.model.get_image_features(**inputs)

        embeddings = features.cpu().numpy()

        # Normalize each embedding
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        embeddings = embeddings / norms

        return [emb for emb in embeddings]
