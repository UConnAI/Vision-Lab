"""Three small image experiments, using only the Python standard library.

Run: python python/opening_exercises.py
The browser page performs the same calculations in JavaScript. This file is
the readable Python version; no model weights or external images are needed.
"""

from math import isfinite

DIAGONAL_WEIGHTS = [[1, -1], [-1, 1]]
KERNELS = {
    "vertical": [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
    "horizontal": [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
    "mean": [[1 / 9] * 3 for _ in range(3)],
    "sharpen": [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
    "eyebrow": [[1, 1, 1], [0, 0, 0], [-1, -1, -1]],
    "bridge": [[-1, 2, -1], [-1, 2, -1], [-1, 2, -1]],
    "lower_edge": [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
}


def _shape(matrix, name):
    if not matrix or not matrix[0]:
        raise ValueError(f"{name} must have at least one row and column.")
    width = len(matrix[0])
    if any(len(row) != width for row in matrix):
        raise ValueError(f"{name} must be rectangular.")
    if any(isinstance(value, bool) or not isinstance(value, (int, float))
           or not isfinite(value) for row in matrix for value in row):
        raise ValueError(f"{name} must contain finite numbers.")
    return len(matrix), width


# region diagonal
def compare_four_pixels(top_left, top_right, bottom_left, bottom_right):
    # 1. Give each pixel a weight.
    # Bright pixels on the backslash diagonal add to the score.
    # Bright pixels on the other diagonal subtract from it.
    top_left_product = top_left * 1
    top_right_product = top_right * -1
    bottom_left_product = bottom_left * -1
    bottom_right_product = bottom_right * 1

    # 2. Add the four products to get one number.
    score = (top_left_product + top_right_product
             + bottom_left_product + bottom_right_product)

    # 3. Use that number to choose a label.
    if score > 0:
        label = "backslash"
    elif score < 0:
        label = "slash"
    else:
        label = "no preference"

    # 4. Keep the answer and the working together.
    terms = [top_left_product, top_right_product,
             bottom_left_product, bottom_right_product]
    return {"score": score, "label": label, "terms": terms}
# endregion


# region photo
def filter_photo_patch(gray_image, kernel, top, left):
    # A grayscale pixel is a brightness between 0 (black) and 1 (white).
    score = 0

    # Visit the nine positions in this 3 by 3 patch.
    for row_offset in range(3):
        for column_offset in range(3):
            pixel = gray_image[top + row_offset][left + column_offset]
            weight = kernel[row_offset][column_offset]
            product = pixel * weight
            score = score + product

    # ReLU removes negative responses. It does not recognize a face.
    if score < 0:
        score = 0
    return score
# endregion


def classify_diagonal(image):
    """Read four positions from a validated image, then use the same visible rule."""
    if _shape(image, "Image") != (2, 2):
        raise ValueError("This classifier needs a 2 by 2 image.")
    return compare_four_pixels(image[0][0], image[0][1], image[1][0], image[1][1])


# region convolution
def bright_square():
    """A 7 by 7 image with a 3 by 3 bright square in its center."""
    image = []
    for row in range(7):
        new_row = []
        for column in range(7):
            if 2 <= row < 5 and 2 <= column < 5:
                pixel = 1  # Inside the bright square.
            else:
                pixel = 0  # Outside the square.
            new_row.append(pixel)
        image.append(new_row)
    return image


def kernel_response(image, kernel, row, column, relu=False):
    """Multiply one patch by the kernel and add the products.

    This is stride-one valid cross-correlation: no padding or kernel flip.
    CNN libraries commonly call this operation convolution.
    """
    height, width = _shape(image, "Image")
    kernel_height, kernel_width = _shape(kernel, "Kernel")
    if not (isinstance(row, int) and isinstance(column, int)
            and 0 <= row <= height - kernel_height
            and 0 <= column <= width - kernel_width):
        raise ValueError("That complete kernel patch does not fit the image.")
    terms = []
    for dy in range(kernel_height):
        for dx in range(kernel_width):
            pixel = image[row + dy][column + dx]
            weight = kernel[dy][dx]
            product = pixel * weight
            term = {"dy": dy, "dx": dx, "pixel": pixel,
                    "weight": weight, "product": product}
            terms.append(term)
    raw = 0
    for term in terms:
        raw = raw + term["product"]
    output = raw
    if relu and raw < 0:
        output = 0
    return {"row": row, "column": column, "terms": terms,
            "raw": raw, "output": output}


def convolve(image, kernel, relu=False):
    """Reuse the same kernel at every complete image patch."""
    height, width = _shape(image, "Image")
    kernel_height, kernel_width = _shape(kernel, "Kernel")
    if height < kernel_height or width < kernel_width:
        raise ValueError("The kernel must fit inside the image.")
    responses = []
    # Move down one row at a time.
    for row in range(height - kernel_height + 1):
        output_row = []
        # Move right one column at a time.
        for column in range(width - kernel_width + 1):
            patch = kernel_response(image, kernel, row, column, relu)
            output_row.append(patch["output"])
        responses.append(output_row)
    return responses
# endregion


# region features
def synthetic_face():
    """A hand-drawn binary pattern, not a real face photograph or dataset."""
    rows = (
        "000111000", "011111110", "011111110", "010010010", "011101110",
        "011101110", "011000110", "011111110", "000111000",
    )
    image = []
    for row in rows:
        pixels = []
        for value in row:
            pixels.append(int(value))
        image.append(pixels)
    return image


def feature_image(name="face"):
    if name == "stripes":
        image = []
        for row in range(9):
            if row % 3 == 1:
                value = 0
            else:
                value = 1
            image.append([value] * 9)
        return image
    image = synthetic_face()
    if name == "rotated":
        rotated = []
        for column in range(9):
            new_row = []
            for row in range(8, -1, -1):
                new_row.append(image[row][column])
            rotated.append(new_row)
        return rotated
    if name != "face":
        raise ValueError("Choose face, rotated or stripes.")
    return image


def feature_matches(image, kernel, threshold=1.5):
    """Find strong local pattern responses, without assigning anatomical labels."""
    if not isinstance(threshold, (int, float)) or not isfinite(threshold):
        raise ValueError("Threshold must be finite.")
    responses = convolve(image, kernel, relu=True)
    matches = []
    # Visit every response, and keep only scores above the threshold.
    for row in range(len(responses)):
        for column in range(len(responses[row])):
            score = responses[row][column]
            if score > threshold:
                match = {"row": row, "column": column, "score": score}
                matches.append(match)
    return {"responses": responses, "matches": matches}
# endregion


if __name__ == "__main__":
    print("Backslash:", classify_diagonal([[1, -1], [-1, 1]]))
    print("Slash:", classify_diagonal([[-1, 1], [1, -1]]))
    print("Vertical-edge responses:")
    for values in convolve(bright_square(), KERNELS["vertical"]):
        print(values)
    for name in ("face", "rotated", "stripes"):
        result = feature_matches(feature_image(name), KERNELS["eyebrow"])
        print(name, "matching patches:", len(result["matches"]))
