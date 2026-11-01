import json
from PIL import Image, ImageChops
results = {}
for name in ['desktop', 'mobile']:
    original = Image.open(f'artifacts/original-{name}.png').convert('RGB')
    copy = Image.open(f'artifacts/standalone-{name}.png').convert('RGB')
    if original.size != copy.size:
        raise RuntimeError(f'{name}: screenshot dimensions differ')
    difference = ImageChops.difference(original, copy).convert('L').point(lambda p: 255 if p > 20 else 0)
    results[name] = {'same_dimensions': True, 'different_pixels_percent': round(difference.histogram()[255] * 100 / (original.width * original.height), 4)}
print(json.dumps(results))
