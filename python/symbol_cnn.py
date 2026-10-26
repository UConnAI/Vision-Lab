"""Train the lecture's 1,283-parameter Ring/Plus/X CNN with PyTorch.

Run: python python/symbol_cnn.py
Requires NumPy and PyTorch. Runs on CPU; downloads no data or model.
The image generator/split order mirror cnn-lab-core.mjs with seed 314.
PyTorch weights/initialization and floating-point kernels are independent of
TensorFlow.js: matching architecture/data does not imply identical training.
Generated-symbol test accuracy does not establish camera or drawing accuracy.
Loss API: https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html
"""

import math
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

SEED = 314
CLASS_NAMES = ("Ring", "Plus", "X")


def seeded_random(seed=SEED):
    """The same 32-bit LCG as the browser dataset generator."""
    state = seed & 0xffffffff
    while True:
        state = (1664525 * state + 1013904223) & 0xffffffff
        yield state / 4294967296


def make_image(label, random):
    cx, cy = 7.5 + (next(random) - .5) * 3, 7.5 + (next(random) - .5) * 3
    radius, thickness = 4 + next(random) * 1.5, .75 + next(random) * .45
    angle = (next(random) - .5) * .18
    pixels = np.empty((16, 16), dtype=np.float32)
    for y in range(16):
        for x in range(16):
            dx, dy = x - cx, y - cy
            u = dx * math.cos(angle) - dy * math.sin(angle)
            v = dx * math.sin(angle) + dy * math.cos(angle)
            if label == 0:
                distance = abs(math.hypot(u, v) - radius)
                ink = max(0., min(1., (thickness - distance) * 2))
            else:
                if label == 2:
                    u, v = (u - v) / math.sqrt(2), (u + v) / math.sqrt(2)
                distance = min(max(abs(u) - thickness, abs(v) - radius),
                               max(abs(v) - thickness, abs(u) - radius))
                ink = max(0., min(1., 1 - distance * 2))
            pixels[y, x] = max(0., min(1., ink + (next(random) - .5) * .08))
    return pixels


def make_splits(counts=(384, 96, 120), seed=SEED):
    random, splits = seeded_random(seed), []
    for count in counts:
        rows = [(make_image(i % 3, random), i % 3) for i in range(count)]
        for i in range(count - 1, 0, -1):
            j = math.floor(next(random) * (i + 1))
            rows[i], rows[j] = rows[j], rows[i]
        # PyTorch expects NCHW; the browser uses NHWC.
        images = torch.from_numpy(np.stack([row[0] for row in rows]))[:, None]
        labels = torch.tensor([row[1] for row in rows], dtype=torch.long)
        splits.append(TensorDataset(images, labels))
    return tuple(splits)


def create_model():
    model = nn.Sequential(
        nn.Conv2d(1, 8, kernel_size=3, padding=1), nn.ReLU(),
        nn.MaxPool2d(2),
        nn.Conv2d(8, 12, kernel_size=3), nn.ReLU(),
        nn.MaxPool2d(2), nn.Flatten(), nn.Linear(108, 3),
    )
    # Zero biases and Glorot weights match the browser's initializer family;
    # the two libraries use different random streams, not identical weights.
    for layer in model:
        if isinstance(layer, (nn.Conv2d, nn.Linear)):
            nn.init.xavier_uniform_(layer.weight)
            nn.init.zeros_(layer.bias)
    assert sum(p.numel() for p in model.parameters()) == 1283
    return model


def evaluate(model, dataset):
    model.eval()
    with torch.no_grad():
        images, labels = dataset.tensors
        logits = model(images)
        loss = nn.functional.cross_entropy(logits, labels).item()
        predictions = logits.argmax(dim=1)
        correct = int((predictions == labels).sum())
        matrix = torch.zeros((3, 3), dtype=torch.int64)
        for actual, predicted in zip(labels, predictions):
            matrix[actual, predicted] += 1
    return loss, correct, matrix


def train(epochs=12):
    torch.manual_seed(SEED)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    training, validation, test = make_splits()
    loader = DataLoader(training, batch_size=32, shuffle=False)
    model = create_model()
    optimizer = torch.optim.Adam(model.parameters(), lr=.01, eps=1e-7)
    criterion = nn.CrossEntropyLoss()  # Input is raw logits, not softmax.
    for epoch in range(epochs):
        model.train()
        for images, labels in loader:
            optimizer.zero_grad()
            loss = criterion(model(images), labels)
            loss.backward()
            optimizer.step()
        val_loss, correct, _ = evaluate(model, validation)
        print(f"Epoch {epoch + 1:02d}: validation loss {val_loss:.5f}, {correct}/{len(validation)} correct")
    test_loss, correct, matrix = evaluate(model, test)
    print(f"Held-out generated test: {correct}/{len(test)}, loss {test_loss:.5f}")
    print("Confusion matrix (true rows / predicted columns):\n", matrix.numpy())
    # Only prediction uses softmax, for display of class scores.
    with torch.no_grad():
        print("First test probabilities:", model(test.tensors[0][:1]).softmax(dim=1).numpy())
    return model


if __name__ == "__main__":
    train()
