"""Train three tiny center-regression CNNs on a video and supplied CSV estimates.

Install requirements.txt and requirements-cnn.txt, then run from this folder:
python tiny_cnn.py --video ../take-home-football-tracker/assets/single-ball.mp4 --positions data/soccer.csv

These are one-clip experiments, not pretrained object detectors. Only visible
rows are used. A regressor always outputs a center, including on an absent ball.
"""
import argparse
import json
import math
from pathlib import Path

SEED = 314
SPECS = {"Tiny A": [4], "Tiny B": [4, 8], "Tiny C": [8, 12]}


def build_model(filters):
    import torch
    from torch import nn
    torch.manual_seed(SEED)
    layers, channels, height, width = [], 3, 18, 32
    for count in filters:
        layers.extend([nn.Conv2d(channels, count, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2)])
        channels, height, width = count, height // 2, width // 2
    layers.extend([nn.Flatten(), nn.Linear(channels * height * width, 2), nn.Sigmoid()])
    return nn.Sequential(*layers)


def prepare_data(video_path, csv_path):
    import numpy as np
    import torch
    from render_trail import _opencv, load_positions
    cv2 = _opencv()
    rows = sorted((p for p in load_positions(csv_path).values() if p.visible), key=lambda p: p.frame)
    if len(rows) < 18:
        raise ValueError("At least 18 visible positions are needed.")
    rows = rows[::max(1, math.ceil(len(rows) / 72))]
    capture = cv2.VideoCapture(str(video_path))
    images, targets = [], []
    try:
        if not capture.isOpened():
            raise ValueError("Cannot open video. Check the video path and this interpreter's codec support.")
        width, height = capture.get(cv2.CAP_PROP_FRAME_WIDTH), capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
        for row in rows:
            if not (0 <= row.x < width and 0 <= row.y < height):
                raise ValueError("A visible coordinate lies outside the video.")
            if not capture.set(cv2.CAP_PROP_POS_FRAMES, row.frame):
                raise ValueError(f"Cannot seek to CSV frame {row.frame}. This decoder could not select the matching video frame; check the video/CSV pair and codec support before training.")
            ok, image = capture.read()
            if not ok:
                raise ValueError(f"Cannot decode frame {row.frame}.")
            image = cv2.cvtColor(cv2.resize(image, (32, 18)), cv2.COLOR_BGR2RGB)
            images.append(image.transpose(2, 0, 1).astype(np.float32) / 255)
            targets.append([row.x / width, row.y / height])
    finally:
        capture.release()
    x, y = torch.tensor(np.stack(images)), torch.tensor(targets, dtype=torch.float32)
    a, b = int(len(rows) * .6), int(len(rows) * .8)
    return (x[:a], y[:a]), (x[a:b], y[a:b]), (x[b:], y[b:]), (width, height)


def compare(video_path, csv_path, epochs=20):
    import time
    import torch
    torch.set_num_threads(1)
    train, validation, test, size = prepare_data(video_path, csv_path)
    scale = torch.tensor(size)

    def error(prediction):
        return float(torch.linalg.vector_norm((prediction - test[1]) * scale, dim=1).mean())

    baseline = train[1].mean(dim=0).expand_as(test[1])
    results = [{"method": "training-mean baseline", "parameters": 0, "test_error_px": error(baseline)}]
    for name, filters in SPECS.items():
        model = build_model(filters)
        optimizer = torch.optim.Adam(model.parameters(), lr=.005)
        best_loss, best_weights, started = float("inf"), None, time.perf_counter()
        for _ in range(epochs):
            model.train()
            for start in range(0, len(train[0]), 12):
                prediction = model(train[0][start:start + 12])
                loss = ((prediction - train[1][start:start + 12]) ** 2).mean()
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
            model.eval()
            with torch.no_grad():
                validation_loss = float(((model(validation[0]) - validation[1]) ** 2).mean())
            if validation_loss < best_loss:
                best_loss = validation_loss
                best_weights = {key: value.clone() for key, value in model.state_dict().items()}
        model.load_state_dict(best_weights)
        with torch.no_grad():
            test_error = error(model(test[0]))
        results.append({"method": name, "parameters": sum(p.numel() for p in model.parameters()),
                        "test_error_px": test_error, "seconds": time.perf_counter() - started})
    return {"seed": SEED, "split": [len(train[0]), len(validation[0]), len(test[0])],
            "metric": "agreement with held-out CSV estimates, not ground-truth accuracy", "results": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--positions", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=20)
    args = parser.parse_args()
    if args.epochs < 1:
        parser.error("Epochs must be positive.")
    print(json.dumps(compare(args.video, args.positions, args.epochs), indent=2))
