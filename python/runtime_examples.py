"""Readable Python equivalents of two browser integration rules.

These functions calculate drawing settings and demonstrate resource ownership.
The live workshop still captures video and draws with browser APIs. No Python
camera or GUI package is needed to run these small examples.
"""

# region drawing_style
def drawing_style(brush_size, erasing=False):
    """Return the stroke width and the meaning of its compositing operation."""
    return {
        "width": brush_size * (3 if erasing else 1),
        "operation": "erase existing alpha" if erasing else "paint over",
    }


def erase_alpha(old_alpha, stroke_coverage):
    """Destination-out alpha: both inputs are between zero and one."""
    return old_alpha * (1 - stroke_coverage)


def paint_alpha(old_alpha, stroke_coverage):
    """Source-over alpha for the same coverage convention."""
    return stroke_coverage + old_alpha * (1 - stroke_coverage)
# endregion


# region resource_lifecycle
async def open_current_resource(open_resource, token, current_token):
    """Keep a resource only if its async request still belongs to this session.

    open_resource is an async callable. current_token is a callable that reads
    the latest session token. The supplied resource has a synchronous close().
    A real Python camera adapter would implement those operations itself.
    """
    resource = await open_resource()
    if token != current_token():
        resource.close()
        return None
    return resource
# endregion


if __name__ == "__main__":
    print("Eraser:", drawing_style(16, erasing=True))
    print("Fully erased alpha:", erase_alpha(1.0, 1.0))
    print("Half-covered erase:", erase_alpha(1.0, 0.5))
    print("Paint over transparent pixels:", paint_alpha(0.0, 0.5))
