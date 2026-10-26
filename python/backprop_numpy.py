"""Exact NumPy counterpart of the lecture's fifteen-parameter CNN.

Run: python python/backprop_numpy.py
Requires NumPy. All constants are explicit; no random numbers are needed.
Column vectors: s = W @ h + c; W has shape (classes, features).
"""

import copy
import numpy as np


IMAGE = np.array([[1., 0., 2.], [0., 3., 1.], [2., 1., 0.]])


def initial_parameters():
    return {
        "kernel": np.array([[.2, -.1], [.1, .3]]),
        "convBias": .1,
        "dense": np.array([[.3, -.2, .1, .4], [-.1, .2, .3, -.2]]),
        "denseBias": np.array([.05, -.05]),
    }


def forward(parameters, target=1):
    """Cross-correlation -> ReLU -> flatten -> dense -> softmax/loss."""
    if target not in (0, 1):
        raise ValueError("Choose target 0 (A) or 1 (B).")
    z = np.empty((2, 2))
    for r in range(2):
        for c in range(2):
            patch = IMAGE[r:r + 2, c:c + 2]
            z[r, c] = np.sum(parameters["kernel"] * patch) + parameters["convBias"]
    activations = np.maximum(0, z)
    h = activations.reshape(4)  # A 1D NumPy array represents our column vector.
    logits = parameters["dense"] @ h + parameters["denseBias"]
    shifted = logits - logits.max()
    probabilities = np.exp(shifted) / np.exp(shifted).sum()
    loss = np.log(np.exp(shifted).sum()) - shifted[target]
    return dict(z=z, activations=activations, flat=h, logits=logits,
                probabilities=probabilities, loss=float(loss), target=target)


def backward(parameters, target=1):
    """Differentiate the same saved forward pass; weights are unchanged."""
    saved = forward(parameters, target)
    g = saved["probabilities"].copy()
    g[target] -= 1                         # dL/ds = p - y
    d_w = np.outer(g, saved["flat"])        # dL/dW = g h^T
    d_h = parameters["dense"].T @ g         # dL/dh = W^T g
    d_z = d_h.reshape(2, 2) * (saved["z"] > 0)
    contributions = np.empty((2, 2, 4))
    d_x = np.zeros_like(IMAGE)
    for u in range(2):
        for v in range(2):
            contributions[u, v] = (d_z * IMAGE[u:u + 2, v:v + 2]).ravel()
            d_x[u:u + 2, v:v + 2] += d_z * parameters["kernel"][u, v]
    return dict(forward=saved, dLogits=g, dense=d_w, denseBias=g.copy(),
                dFlat=d_h, dZ=d_z, kernel=contributions.sum(axis=2),
                convBias=float(d_z.sum()), contributions=contributions, input=d_x)


def sgd_step(parameters, target=1, learning_rate=.1):
    if not 0 < learning_rate <= 1:
        raise ValueError("Learning rate must be greater than 0 and at most 1.")
    gradients = backward(parameters, target)
    # Every proposed value uses one pre-update gradient snapshot.
    updated = {name: value - learning_rate * gradients[name]
               for name, value in parameters.items()}
    after = forward(updated, target)
    return dict(before=copy.deepcopy(parameters), updated=updated,
                gradients=gradients, beforeLoss=gradients["forward"]["loss"],
                afterLoss=after["loss"], after=after, learningRate=learning_rate)


def gradient_check(parameters, target=1, epsilon=1e-5):
    """Central differences check all 15 parameter derivatives independently."""
    if not 0 < epsilon <= .01:
        raise ValueError("Use a small positive gradient-check perturbation.")
    gradients = backward(parameters, target)
    entries = []
    for name, value in parameters.items():
        for index in np.ndindex(np.shape(value)):
            plus, minus = copy.deepcopy(parameters), copy.deepcopy(parameters)
            if index:
                plus[name][index] += epsilon
                minus[name][index] -= epsilon
                analytical = float(gradients[name][index])
            else:
                plus[name] += epsilon
                minus[name] -= epsilon
                analytical = float(gradients[name])
            numerical = (forward(plus, target)["loss"] - forward(minus, target)["loss"]) / (2 * epsilon)
            entries.append(dict(name=f"{name}{index}", analytical=analytical,
                                numerical=numerical, absoluteError=abs(analytical - numerical)))
    return dict(entries=entries,
                maxAbsoluteError=max(row["absoluteError"] for row in entries),
                nearReluKink=bool(np.any(np.abs(gradients["forward"]["z"]) < epsilon * 20)))


if __name__ == "__main__":
    np.set_printoptions(precision=6, suppress=True)
    parameters = initial_parameters()
    step = sgd_step(parameters)
    print("Initial logits:", step["gradients"]["forward"]["logits"])
    print("Shared kernel gradient:\n", step["gradients"]["kernel"])
    print("New shared kernel:\n", step["updated"]["kernel"])
    print(f"Loss: {step['beforeLoss']:.9f} -> {step['afterLoss']:.9f}")
    print("Max finite-difference error:", gradient_check(parameters)["maxAbsoluteError"])
