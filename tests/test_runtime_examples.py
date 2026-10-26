"""Check compositing endpoints and async resource ownership without a device."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
import runtime_examples as runtime


class RuntimeExampleTests(unittest.TestCase):
    def test_compositing_coverage_and_stroke_width(self):
        self.assertEqual(runtime.drawing_style(16, True)["width"], 48)
        self.assertEqual(runtime.drawing_style(16, False)["width"], 16)
        self.assertEqual(runtime.erase_alpha(1, 0), 1)
        self.assertEqual(runtime.erase_alpha(1, 1), 0)
        self.assertAlmostEqual(runtime.erase_alpha(0.8, 0.25), 0.6)
        self.assertEqual(runtime.paint_alpha(0, 0.5), 0.5)
        self.assertEqual(runtime.paint_alpha(1, 0.5), 1)

    def resource_result(self, latest_token):
        class Resource:
            closed = False

            def close(self):
                self.closed = True

        resource = Resource()

        async def open_resource():
            return resource

        pending = runtime.open_current_resource(open_resource, 1, lambda: latest_token)
        # This supplied opener completes immediately, so no device, socket or
        # event-loop scheduler is needed to inspect this ownership decision.
        with self.assertRaises(StopIteration) as result:
            pending.send(None)
        return resource, result.exception.value

    def test_current_request_keeps_resource_open(self):
        resource, kept = self.resource_result(1)
        self.assertIs(kept, resource)
        self.assertFalse(resource.closed)

    def test_superseded_request_closes_resource(self):
        resource, kept = self.resource_result(2)
        self.assertIsNone(kept)
        self.assertTrue(resource.closed)
